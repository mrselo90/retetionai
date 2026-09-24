/**
 * WhatsApp webhook and message routes
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/billingMiddleware.js';
import { sendWhatsAppMessage, getEffectiveWhatsAppCredentials } from '../lib/whatsapp.js';
import { logger } from '@recete/shared';
import { processWhatsAppInboundEvent } from '../lib/whatsappInboundProcessor.js';

// The Twilio/Meta webhook receivers (GET/POST /webhooks/whatsapp and
// /api/whatsapp/webhooks/whatsapp) were removed with those providers. Inbound
// messages are processed from whatsapp_inbound_events by the endpoint below,
// whichever provider fills that table in future.
const whatsapp = new Hono();

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
