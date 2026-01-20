/**
 * WhatsApp webhook and message routes
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import {
  sendWhatsAppMessage,
  verifyWhatsAppWebhook,
  parseWhatsAppWebhook,
  getWhatsAppCredentials,
} from '../lib/whatsapp';
import { getSupabaseServiceClient, logger } from '@glowguide/shared';
import {
  findUserByPhone,
  getOrCreateConversation,
  addMessageToConversation,
  getConversationHistory,
  updateConversationState,
} from '../lib/conversation';
import { generateAIResponse } from '../lib/aiAgent';
import { incrementMessageCount } from '../lib/usageTracking';

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
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'glowguide_verify_token';

  const challengeResponse = verifyWhatsAppWebhook(mode, token, challenge, verifyToken);

  if (challengeResponse !== null) {
    return c.text(challengeResponse, 200);
  }

  return c.json({ error: 'Invalid verification' }, 403);
});

/**
 * WhatsApp webhook receiver (POST)
 * Receives incoming messages from WhatsApp
 */
whatsapp.post('/webhooks/whatsapp', async (c) => {
  try {
    const body = await c.req.json();

    // Parse webhook messages
    const messages = parseWhatsAppWebhook(body);

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

        // Find merchant (for MVP, use first merchant or env var)
        // In production, you'd need to determine merchant from phone number
        // For now, we'll use a default merchant or get from webhook metadata
        const defaultMerchantId = process.env.DEFAULT_MERCHANT_ID;
        if (!defaultMerchantId) {
          console.warn('DEFAULT_MERCHANT_ID not set, skipping message');
          continue;
        }

        // Find user by phone
        const user = await findUserByPhone(normalizedPhone, defaultMerchantId);

        if (!user) {
          console.log(`User not found for phone: ${normalizedPhone}`);
          // Send default response for unknown users
          const credentials = await getWhatsAppCredentials(defaultMerchantId);
          if (credentials && message.text) {
            await sendWhatsAppMessage(
              {
                to: normalizedPhone,
                text: 'Merhaba! Size nasıl yardımcı olabilirim? Lütfen sipariş numaranızı paylaşın.',
              },
              credentials.accessToken,
              credentials.phoneNumberId
            );
          }
          continue;
        }

        // Get user's latest order
        const { data: latestOrder } = await serviceClient
          .from('orders')
          .select('id')
          .eq('user_id', user.userId)
          .eq('merchant_id', defaultMerchantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const orderId = latestOrder?.id;

        // Get or create conversation
        const conversationId = await getOrCreateConversation(
          user.userId,
          orderId
        );

        // Add user message to conversation
        if (message.text) {
          await addMessageToConversation(
            conversationId,
            'user',
            message.text
          );
        }

        // Get conversation history
        const history = await getConversationHistory(conversationId);

        // Generate AI response
        const credentials = await getWhatsAppCredentials(defaultMerchantId);
        if (!credentials) {
          console.error('WhatsApp credentials not configured');
          continue;
        }

        if (message.text) {
          const aiResponse = await generateAIResponse(
            message.text,
            defaultMerchantId,
            user.userId,
            conversationId,
            orderId,
            history
          );

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
            credentials.accessToken,
            credentials.phoneNumberId
          );

          if (!sendResult.success) {
            console.error('Failed to send WhatsApp response:', sendResult.error);
          } else {
            if (aiResponse.guardrailBlocked) {
              console.log(
                `🛡️ Guardrail blocked response (${aiResponse.guardrailReason}) to ${normalizedPhone}`
              );
            } else {
              console.log(`✅ Sent AI response to ${normalizedPhone}`);
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
              credentials.accessToken,
              credentials.phoneNumberId
            );

            if (upsellResult.success) {
              console.log(`💰 Sent upsell message to ${normalizedPhone}`);

              // Mark upsell as sent in scheduled_tasks
              await serviceClient
                .from('scheduled_tasks')
                .insert({
                  user_id: user.userId,
                  order_id: orderId,
                  task_type: 'upsell',
                  execute_at: new Date().toISOString(),
                  status: 'completed',
                });
            }
          }

          // Log escalation if required
          if (aiResponse.requiresHuman) {
            console.log(
              `🚨 Human escalation required for conversation ${conversationId}`
            );
            // TODO: Create escalation record in database
          }
        }
      } catch (error) {
        console.error('Error processing WhatsApp message:', error);
        // Continue processing other messages
      }
    }

    return c.json({ message: 'Webhook processed' }, 200);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
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
  const credentials = await getWhatsAppCredentials(merchantId);

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
    credentials.accessToken,
    credentials.phoneNumberId
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
whatsapp.get('/test', authMiddleware, async (c) => {
  const merchantId = c.get('merchantId');

  const credentials = await getWhatsAppCredentials(merchantId);

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
    phoneNumberId: credentials.phoneNumberId,
    // Don't expose access token
  });
});

export default whatsapp;
