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
import {
  findUserByPhone,
  getOrCreateConversation,
  addMessageToConversation,
  getConversationHistory,
  updateConversationState,
} from '../lib/conversation.js';
import { generateAIResponse } from '../lib/aiAgent.js';

const whatsapp = new Hono();

/**
 * WhatsApp webhook verification (GET)
 * Meta requires this for webhook setup
 */
whatsapp.get('/webhooks/whatsapp', async (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  // For MVP, use environment variable
  // In production, this should be per-merchant
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
});

/**
 * WhatsApp webhook receiver (POST)
 * Receives incoming messages from WhatsApp
 */
whatsapp.post('/webhooks/whatsapp', verifyWhatsAppWebhookSignature, async (c) => {
  try {
    const body = c.get('whatsappWebhookBody');
    const webhookProvider = c.get('whatsappWebhookProvider') as 'meta' | 'twilio' | undefined;
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid webhook body' }, 400);
    }

    // Parse webhook messages
    const messages = parseWhatsAppWebhook(body, webhookProvider);

    if (messages.length === 0) {
      // Might be a status update or other webhook event
      return c.json({ message: 'Webhook received, no messages' }, 200);
    }

    const serviceClient = getSupabaseServiceClient();

    // Process each message
    for (const message of messages) {
      try {
        // Normalize phone number
        const normalizedPhone = message.from;

        // --- MULTI-TENANT MERCHANT LOOKUP ---
        // For Meta: use phone_number_id from webhook metadata to find the merchant.
        // Fallback to DEFAULT_MERCHANT_ID for single-tenant / backward compat setups.
        let merchantId: string | null = null;

        if (message.phoneNumberId) {
          merchantId = await findMerchantByPhoneNumberId(message.phoneNumberId);
        }

        if (!merchantId) {
          merchantId = process.env.DEFAULT_MERCHANT_ID ?? null;
        }

        if (!merchantId) {
          logger.warn({ phone: normalizedPhone, phoneNumberId: message.phoneNumberId }, 'Could not resolve merchant for incoming WhatsApp message, skipping');
          continue;
        }

        const user = await findUserByPhone(normalizedPhone, merchantId);

        if (!user) {
          logger.info({ phone: normalizedPhone, merchantId }, 'User not found for incoming WhatsApp message');
          // Send default response for unknown users
          const credentials = await getEffectiveWhatsAppCredentials(merchantId);
          if (credentials && message.text) {
            // Basic language detection: check for Turkish characters
            const hasTurkishChars = /[çğışöüÇĞİŞÖÜ]/i.test(message.text);
            const defaultText = hasTurkishChars
              ? 'Merhaba! Size nasıl yardımcı olabilirim? Lütfen sipariş numaranızı paylaşın.'
              : 'Hello! How can I help you? Please share your order number.';
            await sendWhatsAppMessage({ to: normalizedPhone, text: defaultText }, credentials);
          }
          continue;
        }

        const { data: latestOrder } = await serviceClient
          .from('orders')
          .select('id')
          .eq('user_id', user.userId)
          .eq('merchant_id', merchantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const orderId = latestOrder?.id;

        // Get or create conversation (with merchant isolation)
        const conversationId = await getOrCreateConversation(
          user.userId,
          orderId,
          merchantId
        );

        // Check conversation status - skip AI if in human mode
        const { data: convData } = await serviceClient
          .from('conversations')
          .select('conversation_status')
          .eq('id', conversationId)
          .single();

        // Add user message to conversation
        if (message.text) {
          await addMessageToConversation(
            conversationId,
            'user',
            message.text
          );
        }

        if (convData?.conversation_status === 'human') {
          logger.info({ conversationId }, 'Conversation in human mode, skipping AI response');
          continue;
        }

        // Get conversation history before generating AI response
        const history = await getConversationHistory(conversationId);

        // Generate AI response
        const credentials = await getEffectiveWhatsAppCredentials(merchantId);
        if (!credentials) {
          logger.error({ merchantId }, 'WhatsApp credentials not configured');
          continue;
        }

        if (message.text) {
          let aiResponse;
          try {
            aiResponse = await generateAIResponse(
              message.text,
              merchantId,
              user.userId,
              conversationId,
              orderId,
              history
            );
          } catch (llmError) {
            // LLM failure: send fallback message so user is not left without response
            logger.error({ llmError, conversationId, merchantId }, 'LLM generation failed, sending fallback response');
            const hasTurkishChars = /[çğışöüÇĞİŞÖÜ]/i.test(message.text);
            const fallbackText = hasTurkishChars
              ? 'Şu an size yardımcı olamıyorum. Lütfen kısa süre sonra tekrar deneyin.'
              : 'I am unable to assist you at the moment. Please try again shortly.';
            await sendWhatsAppMessage({ to: normalizedPhone, text: fallbackText }, credentials);
            await serviceClient
              .from('conversations')
              .update({
                escalation_status: 'pending',
                escalation_requested_at: new Date().toISOString(),
                conversation_status: 'human',
              })
              .eq('id', conversationId);
            continue;
          }

          // Update conversation state
          await updateConversationState(conversationId, aiResponse.intent);

          // Add assistant response to conversation
          await addMessageToConversation(
            conversationId,
            'assistant',
            aiResponse.response
          );

          // Send response via WhatsApp
          const sendResult = await sendWhatsAppMessage(
            {
              to: normalizedPhone,
              text: aiResponse.response,
              preview_url: false,
            },
            credentials
          );

          if (!sendResult.success) {
            logger.error({ error: sendResult.error, phone: normalizedPhone }, 'Failed to send WhatsApp response');
          } else {
            if (aiResponse.guardrailBlocked) {
              logger.info({ reason: aiResponse.guardrailReason, phone: normalizedPhone }, 'Guardrail blocked response');
            } else {
              logger.info({ phone: normalizedPhone, conversationId }, 'AI response sent successfully');
            }
          }

          // Send upsell message if triggered
          if (aiResponse.upsellTriggered && aiResponse.upsellMessage) {
            // Wait a bit before sending upsell (2 seconds)
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const upsellResult = await sendWhatsAppMessage(
              {
                to: normalizedPhone,
                text: aiResponse.upsellMessage,
                preview_url: true, // Enable preview for product links
              },
              credentials
            );

            if (upsellResult.success) {
              logger.info({ phone: normalizedPhone }, 'Upsell message sent');

              // Mark upsell as sent in scheduled_tasks
              await serviceClient
                .from('scheduled_tasks')
                .insert({
                  user_id: user.userId,
                  order_id: orderId ?? null,
                  task_type: 'upsell',
                  execute_at: new Date().toISOString(),
                  status: 'completed',
                });
            }
          }

          // Handle human escalation: write escalation state to DB for dashboard tracking
          if (aiResponse.requiresHuman) {
            logger.info({ conversationId, merchantId }, 'Human escalation required, writing to DB');
            await serviceClient
              .from('conversations')
              .update({
                escalation_status: 'pending',
                escalation_requested_at: new Date().toISOString(),
                conversation_status: 'human',
              })
              .eq('id', conversationId);
          }
        }
      } catch (error) {
        logger.error({ error, phone: message.from }, 'Error processing WhatsApp message');
        // Continue processing other messages
      }
    }

    return c.json({ message: 'Webhook processed' }, 200);
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
