/**
 * WhatsApp webhook and message routes
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/billingMiddleware.js';
import { verifyWhatsAppWebhookSignature } from '../middleware/whatsappWebhookSignature.js';
import {
  sendWhatsAppMessage,
  verifyWhatsAppWebhook,
  parseWhatsAppWebhook,
  getEffectiveWhatsAppCredentials,
  findMerchantByPhoneNumberId,
} from '../lib/whatsapp.js';
import { getSupabaseServiceClient, logger } from '@recete/shared';
import { addWhatsAppInboundJob } from '../queues.js';
import { processWhatsAppInboundEvent } from '../lib/whatsappInboundProcessor.js';

const whatsapp = new Hono();
export const whatsappWebhookRoutes = new Hono();

async function webhookVerificationHandler(c: any) {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'recete_verify_token';
  const challengeResponse = verifyWhatsAppWebhook(
    mode ?? null,
    token ?? null,
    challenge ?? null,
    verifyToken
  );

  if (challengeResponse !== null) {
    return c.text(challengeResponse, 200);
  }

  return c.json({ error: 'Invalid verification' }, 403);
}

async function webhookInboundHandler(c: any) {
  try {
    const body = c.get('whatsappWebhookBody');
    const webhookProvider = c.get('whatsappWebhookProvider') as 'meta' | 'twilio' | undefined;
    const provider = webhookProvider || 'meta';

    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid webhook body' }, 400);
    }

    const messages = parseWhatsAppWebhook(body, webhookProvider);
    if (messages.length === 0) {
      return c.json({ message: 'Webhook received, no messages' }, 200);
    }

    const serviceClient = getSupabaseServiceClient();
    let queued = 0;
    let duplicates = 0;
    let skipped = 0;
    let queueErrors = 0;
    let fatalSchemaError: string | null = null;

    for (const message of messages) {
      let merchantId: string | null = null;
      try {
        if (message.phoneNumberId) {
          merchantId = await findMerchantByPhoneNumberId(message.phoneNumberId);
        }
        if (!merchantId) merchantId = process.env.DEFAULT_MERCHANT_ID ?? null;

        if (!merchantId) {
          skipped += 1;
          logger.warn(
            { from: message.from, phoneNumberId: message.phoneNumberId || null },
            'Could not resolve merchant for incoming WhatsApp message'
          );
          continue;
        }

        const insertPayload = {
          merchant_id: merchantId,
          provider,
          external_message_id: message.messageId,
          from_phone: message.from,
          phone_number_id: message.phoneNumberId || null,
          message_type: message.type,
          message_text: message.text || null,
          payload: {
            provider,
            message,
          },
          status: 'received',
          received_at: new Date().toISOString(),
        };

        const { data: inserted, error: insertError } = await serviceClient
          .from('whatsapp_inbound_events')
          .insert(insertPayload)
          .select('id')
          .single();

        if (insertError) {
          const code = (insertError as any)?.code;
          if (code === '42P01' || code === '42703') {
            fatalSchemaError = `whatsapp_inbound_events schema missing (${code})`;
            logger.error({ insertError }, 'WhatsApp inbound schema is missing');
            break;
          }
          if ((insertError as any).code === '23505') {
            duplicates += 1;
            continue;
          }
          queueErrors += 1;
          logger.error({ insertError, merchantId, messageId: message.messageId }, 'Failed to persist whatsapp inbound event');
          continue;
        }

        const inboundEventId = inserted?.id as string;
        try {
          await addWhatsAppInboundJob({
            inboundEventId,
            merchantId,
          });
          await serviceClient
            .from('whatsapp_inbound_events')
            .update({
              status: 'queued',
              queued_at: new Date().toISOString(),
            })
            .eq('id', inboundEventId);
          queued += 1;
        } catch (queueError) {
          queueErrors += 1;
          await serviceClient
            .from('whatsapp_inbound_events')
            .update({
              status: 'failed',
              failed_at: new Date().toISOString(),
              last_error: queueError instanceof Error ? queueError.message : 'Failed to enqueue inbound message',
            })
            .eq('id', inboundEventId);
          logger.error({ queueError, inboundEventId, merchantId }, 'Failed to enqueue whatsapp inbound event');
        }
      } catch (error) {
        queueErrors += 1;
        logger.error({ error, from: message.from, messageId: message.messageId }, 'Error while ingesting WhatsApp inbound message');
      }
    }

    if (fatalSchemaError) {
      return c.json({
        error: 'WhatsApp inbound schema is not ready',
        message: fatalSchemaError,
      }, 500);
    }

    return c.json({
      message: 'Webhook accepted',
      queued,
      duplicates,
      skipped,
      queueErrors,
    }, 200);
  } catch (error) {
    logger.error({ error }, 'WhatsApp webhook error');
    return c.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/**
 * WhatsApp webhook verification (GET)
 * Meta requires this for webhook setup
 */
whatsapp.get('/webhooks/whatsapp', webhookVerificationHandler);
whatsappWebhookRoutes.get('/whatsapp', webhookVerificationHandler);

/**
 * WhatsApp webhook receiver (POST)
 * Receives incoming messages from WhatsApp
 */
whatsapp.post('/webhooks/whatsapp', verifyWhatsAppWebhookSignature, webhookInboundHandler);
whatsappWebhookRoutes.post('/whatsapp', verifyWhatsAppWebhookSignature, webhookInboundHandler);

/**
 * Internal queue worker processing endpoint
 * POST /api/whatsapp/inbound-events/:id/process
 */
whatsapp.post('/inbound-events/:id/process', authMiddleware, async (c) => {
  const authMethod = c.get('authMethod') as string | undefined;
  if (authMethod !== 'internal') {
    return c.json({ error: 'Forbidden: internal auth required' }, 403);
  }

  const inboundEventId = c.req.param('id');
  const merchantId = c.get('merchantId') as string;
  if (!inboundEventId) {
    return c.json({ error: 'inbound event id is required' }, 400);
  }

  try {
    const result = await processWhatsAppInboundEvent(inboundEventId, merchantId);
    return c.json({ ok: true, result }, 200);
  } catch (error) {
    logger.error({ error, inboundEventId, merchantId }, 'Failed to process inbound event');
    return c.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Send WhatsApp message (authenticated)
 * POST /api/whatsapp/send
 */
whatsapp.post('/send', authMiddleware, async (c) => {
  const merchantId = c.get('merchantId');
  const body = await c.req.json();

  const { to, text, preview_url } = body;

  if (!to || !text) {
    return c.json({ error: 'to and text are required' }, 400);
  }

  // Get WhatsApp credentials
  const credentials = await getEffectiveWhatsAppCredentials(merchantId);

  if (!credentials) {
    return c.json(
      {
        error: 'WhatsApp not configured',
        message: 'Please configure WhatsApp Business API credentials',
      },
      400
    );
  }

  // Send message
  const result = await sendWhatsAppMessage(
    {
      to,
      text,
      preview_url,
    },
    credentials
  );

  if (!result.success) {
    return c.json(
      {
        error: 'Failed to send message',
        details: result.error,
      },
      500
    );
  }

  return c.json({
    message: 'Message sent successfully',
    messageId: result.messageId,
  });
});

/**
 * Test WhatsApp connection
 * GET /api/whatsapp/test
 */
whatsapp.get('/test', authMiddleware, requireActiveSubscription as any, async (c) => {
  const merchantId = c.get('merchantId');

  const credentials = await getEffectiveWhatsAppCredentials(merchantId);

  if (!credentials) {
    return c.json(
      {
        configured: false,
        message: 'WhatsApp credentials not found',
      },
      200
    );
  }

  return c.json({
    configured: true,
    provider: credentials.provider,
    ...(credentials.provider === 'meta'
      ? { phoneNumberId: credentials.phoneNumberId }
      : { fromNumber: credentials.fromNumber }),
  });
});

export default whatsapp;
