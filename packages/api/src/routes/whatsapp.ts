/**
 * WhatsApp webhook and message routes
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/billingMiddleware.js';
import { sendWhatsAppMessage, getEffectiveWhatsAppCredentials } from '../lib/whatsapp.js';
import {
  findMerchantByPhoneNumberId,
  getSupabaseServiceClient,
  logger,
  parseMetaWebhook,
  verifyMetaSignature,
} from '@recete/shared';
import { addWhatsAppInboundJob } from '../queues.js';
import { processWhatsAppInboundEvent } from '../lib/whatsappInboundProcessor.js';

const whatsapp = new Hono();
export const whatsappWebhookRoutes = new Hono();

/**
 * Meta's webhook verification handshake (GET /webhooks/whatsapp). The token is
 * the one entered in the Meta app's WhatsApp webhook settings.
 */
function webhookVerificationHandler(c: Context) {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();
  if (
    verifyToken &&
    c.req.query('hub.mode') === 'subscribe' &&
    c.req.query('hub.verify_token') === verifyToken
  ) {
    return c.text(c.req.query('hub.challenge') ?? '', 200);
  }
  return c.json({ error: 'Invalid verification' }, 403);
}

/**
 * Inbound messages from every merchant's connected number (one Meta app, one
 * webhook). Signed with the app secret; the merchant is found by the
 * phone_number_id the message was sent to. There is deliberately no fallback
 * to "some" merchant: a message that cannot be attributed is dropped.
 */
async function webhookInboundHandler(c: Context) {
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appSecret) {
    return c.json({ error: 'WhatsApp webhook is not configured' }, 503);
  }

  const rawBody = await c.req.text();
  if (!verifyMetaSignature(rawBody, c.req.header('X-Hub-Signature-256'), appSecret)) {
    return c.json({ error: 'Invalid webhook signature' }, 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON webhook body' }, 400);
  }

  const messages = parseMetaWebhook(body);
  if (messages.length === 0) {
    // Delivery/read statuses and account updates: acknowledge so Meta stops retrying.
    return c.json({ message: 'Webhook received, no messages' }, 200);
  }

  const serviceClient = getSupabaseServiceClient();
  let queued = 0;
  let duplicates = 0;
  let skipped = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      const merchantId = message.phoneNumberId
        ? await findMerchantByPhoneNumberId(message.phoneNumberId)
        : null;
      if (!merchantId) {
        skipped += 1;
        logger.warn(
          { phoneNumberId: message.phoneNumberId || null },
          'Could not resolve merchant for incoming WhatsApp message'
        );
        continue;
      }

      const { data: inserted, error: insertError } = await serviceClient
        .from('whatsapp_inbound_events')
        .insert({
          merchant_id: merchantId,
          provider: 'meta',
          external_message_id: message.messageId,
          from_phone: message.from,
          phone_number_id: message.phoneNumberId || null,
          message_type: message.type,
          message_text: message.text || null,
          payload: { provider: 'meta', message },
          status: 'received',
          received_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        if ((insertError as { code?: string }).code === '23505') {
          duplicates += 1;
          continue;
        }
        failed += 1;
        logger.error({ insertError, merchantId }, 'Failed to persist whatsapp inbound event');
        continue;
      }

      const inboundEventId = inserted?.id as string;
      try {
        await addWhatsAppInboundJob({ inboundEventId, merchantId });
        await serviceClient
          .from('whatsapp_inbound_events')
          .update({ status: 'queued', queued_at: new Date().toISOString() })
          .eq('id', inboundEventId);
        queued += 1;
      } catch (queueError) {
        failed += 1;
        await serviceClient
          .from('whatsapp_inbound_events')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            last_error:
              queueError instanceof Error
                ? queueError.message
                : 'Failed to enqueue inbound message',
          })
          .eq('id', inboundEventId);
        logger.error(
          { queueError, inboundEventId, merchantId },
          'Failed to enqueue whatsapp inbound event'
        );
      }
    } catch (error) {
      failed += 1;
      logger.error(
        { error, messageId: message.messageId },
        'Error while ingesting WhatsApp inbound message'
      );
    }
  }

  // 500 on a storage failure so Meta redelivers; duplicates are then skipped.
  return c.json(
    { message: 'Webhook accepted', queued, duplicates, skipped, failed },
    failed > 0 ? 500 : 200
  );
}

whatsappWebhookRoutes.get('/whatsapp', webhookVerificationHandler);
whatsappWebhookRoutes.post('/whatsapp', webhookInboundHandler);

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
    return c.json(
      {
        ok: false,
        error: 'Internal server error',
      },
      500
    );
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
        message: 'No WhatsApp provider is connected',
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
    phoneNumberDisplay: credentials.phoneNumberDisplay ?? null,
  });
});

export default whatsapp;
