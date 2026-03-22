import { getSupabaseServiceClient, logger } from '@recete/shared';
import {
  addMessageToConversation,
  findUserByPhone,
  getConversationHistory,
  getOrCreateConversation,
  updateConversationState,
} from './conversation.js';
import { generateAIResponse } from './aiAgent.js';
import {
  canMerchantUseAiVision,
  recordMerchantPhotoAnalysis,
} from './merchantPlanFeatures.js';
import { analyzeCustomerImage } from './aiVision.js';
import { getEffectiveWhatsAppCredentials, type WhatsAppWebhookMessage } from './whatsapp.js';
import { sendTrackedWhatsAppMessage } from './whatsappOutbox.js';
import { findPendingTemplateEvent, handleDeliveryTemplateReply } from './deliveryTemplateService.js';

type InboundStatus = 'received' | 'queued' | 'processing' | 'processed' | 'failed' | 'ignored';

type InboundEventRow = {
  id: string;
  merchant_id: string;
  provider: 'meta' | 'twilio';
  from_phone: string;
  phone_number_id?: string | null;
  message_type: string;
  message_text?: string | null;
  payload?: {
    message?: WhatsAppWebhookMessage;
  } | null;
  status: InboundStatus;
  attempts: number;
};

async function setInboundStatus(
  inboundEventId: string,
  status: InboundStatus,
  patch?: Partial<{
    last_error: string | null;
    queued_at: string | null;
    processing_started_at: string | null;
    processed_at: string | null;
    failed_at: string | null;
    attempts: number;
  }>
) {
  const serviceClient = getSupabaseServiceClient();
  const nowIso = new Date().toISOString();
  const payload: Record<string, unknown> = {
    status,
    updated_at: nowIso,
    ...patch,
  };
  if (status === 'processed' && payload.processed_at === undefined) payload.processed_at = nowIso;
  if (status === 'failed' && payload.failed_at === undefined) payload.failed_at = nowIso;
  if (status === 'processing' && payload.processing_started_at === undefined) payload.processing_started_at = nowIso;
  await serviceClient
    .from('whatsapp_inbound_events')
    .update(payload)
    .eq('id', inboundEventId);
}

function buildUnknownUserMessage(input: string): string {
  const hasTurkishChars = /[çğışöüÇĞİŞÖÜ]/i.test(input);
  return hasTurkishChars
    ? 'Merhaba! Size nasıl yardımcı olabilirim? Lütfen sipariş numaranızı paylaşın.'
    : 'Hello! How can I help you? Please share your order number.';
}

function buildAiFallbackMessage(input: string): string {
  const hasTurkishChars = /[çğışöüÇĞİŞÖÜ]/i.test(input);
  return hasTurkishChars
    ? 'Şu an size yardımcı olamıyorum. Lütfen kısa süre sonra tekrar deneyin.'
    : 'I am unable to assist you at the moment. Please try again shortly.';
}

function buildInboundConversationMessage(inbound: InboundEventRow, fallbackText: string) {
  if (inbound.message_type !== 'image') {
    return fallbackText;
  }

  const caption = inbound.payload?.message?.image?.caption || fallbackText;
  return caption
    ? `[Customer image] ${caption}`
    : '[Customer image received with no caption]';
}

export async function processWhatsAppInboundEvent(
  inboundEventId: string,
  expectedMerchantId?: string
): Promise<{ result: string }> {
  const serviceClient = getSupabaseServiceClient();
  const { data: row, error } = await serviceClient
    .from('whatsapp_inbound_events')
    .select('id, merchant_id, provider, from_phone, phone_number_id, message_type, message_text, payload, status, attempts')
    .eq('id', inboundEventId)
    .single();

  if (error || !row) {
    throw new Error(`Inbound event not found: ${inboundEventId}`);
  }

  const inbound = row as InboundEventRow;
  if (expectedMerchantId && inbound.merchant_id !== expectedMerchantId) {
    throw new Error('Inbound event merchant mismatch');
  }

  if (inbound.status === 'processed' || inbound.status === 'ignored') {
    return { result: 'already_finalized' };
  }

  await setInboundStatus(inbound.id, 'processing', {
    attempts: (inbound.attempts || 0) + 1,
    processing_started_at: new Date().toISOString(),
    last_error: null,
    failed_at: null,
  });

  try {
    const messageText = (inbound.message_text || '').trim();
    const merchantId = inbound.merchant_id;
    const phone = inbound.from_phone;
    const isImageMessage = inbound.message_type === 'image';
    const userMessageForConversation = buildInboundConversationMessage(inbound, messageText);

    if (!isImageMessage && (inbound.message_type !== 'text' || !messageText)) {
      await setInboundStatus(inbound.id, 'ignored', {
        last_error: null,
        processed_at: new Date().toISOString(),
      });
      return { result: 'ignored_non_text_or_empty' };
    }

    const credentials = await getEffectiveWhatsAppCredentials(merchantId);
    if (!credentials) {
      await setInboundStatus(inbound.id, 'failed', { last_error: 'WhatsApp credentials not configured' });
      return { result: 'failed_missing_credentials' };
    }

    if (isImageMessage) {
      const aiVisionEnabled = await canMerchantUseAiVision(merchantId);
      if (!aiVisionEnabled) {
        await setInboundStatus(inbound.id, 'ignored', {
          last_error: 'Image received on a plan or shop setting without AI vision access',
          processed_at: new Date().toISOString(),
        });
        return { result: 'ignored_image_plan_blocked' };
      }
    }

    const user = await findUserByPhone(phone, merchantId);
    if (!user) {
      const defaultText = buildUnknownUserMessage(userMessageForConversation);
      const sendResult = await sendTrackedWhatsAppMessage({
        merchantId,
        inboundEventId: inbound.id,
        to: phone,
        text: defaultText,
        previewUrl: false,
        messageKind: 'unknown_user_default',
        credentials,
      });

      if (sendResult.success) {
        await setInboundStatus(inbound.id, 'processed', {
          last_error: null,
          processed_at: new Date().toISOString(),
        });
        return { result: 'processed_unknown_user_default_sent' };
      }

      await setInboundStatus(inbound.id, 'failed', {
        last_error: sendResult.error || 'Failed to send default unknown-user reply',
      });
      return { result: 'failed_unknown_user_default_send' };
    }

    const { data: latestOrder } = await serviceClient
      .from('orders')
      .select('id')
      .eq('user_id', user.userId)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const orderId = latestOrder?.id as string | undefined;
    const conversationId = await getOrCreateConversation(user.userId, orderId, merchantId);

    await addMessageToConversation(conversationId, 'user', userMessageForConversation);

    // Intercept: check if this is a reply to a delivery template quick-reply
    if (!isImageMessage && messageText) {
      const pendingTemplate = await findPendingTemplateEvent(user.userId, merchantId);
      if (pendingTemplate) {
        const replyResult = await handleDeliveryTemplateReply({
          templateEvent: pendingTemplate,
          messageText,
          conversationId,
          credentials,
          inboundEventId: inbound.id,
        });

        if (replyResult.handled) {
          await setInboundStatus(inbound.id, 'processed', {
            last_error: null,
            processed_at: new Date().toISOString(),
          });
          return { result: `processed_delivery_template_${replyResult.action}` };
        }
        // Not a recognized quick reply — fall through to normal AI flow
      }
    }

    const { data: convData } = await serviceClient
      .from('conversations')
      .select('conversation_status')
      .eq('id', conversationId)
      .single();

    if (convData?.conversation_status === 'human') {
      await setInboundStatus(inbound.id, 'processed', {
        last_error: null,
        processed_at: new Date().toISOString(),
      });
      return { result: 'processed_human_mode_no_ai' };
    }

    if (isImageMessage) {
      let merchantName: string | null = null;
      try {
        const { data: merchantRecord } = await serviceClient
          .from('merchants')
          .select('name')
          .eq('id', merchantId)
          .maybeSingle();
        merchantName = (merchantRecord as { name?: string } | null)?.name || null;
      } catch {
        merchantName = null;
      }

      let visionReply: string;
      try {
        visionReply = await analyzeCustomerImage({
          merchantId,
          merchantName,
          message: inbound.payload?.message || {
            from: phone,
            messageId: inbound.id,
            timestamp: new Date().toISOString(),
            text: messageText || undefined,
            type: 'image',
          },
          credentials,
        });
      } catch (visionError) {
        logger.error(
          { visionError, conversationId, merchantId, inboundEventId: inbound.id },
          'AI vision generation failed'
        );
        const fallbackText = buildAiFallbackMessage(userMessageForConversation);
        const fallbackSend = await sendTrackedWhatsAppMessage({
          merchantId,
          inboundEventId: inbound.id,
          conversationId,
          userId: user.userId,
          to: phone,
          text: fallbackText,
          previewUrl: false,
          messageKind: 'ai_fallback',
          credentials,
        });

        if (fallbackSend.success) {
          await addMessageToConversation(conversationId, 'assistant', fallbackText);
          await setInboundStatus(inbound.id, 'processed', {
            last_error: null,
            processed_at: new Date().toISOString(),
          });
          return { result: 'processed_image_fallback_sent' };
        }

        await setInboundStatus(inbound.id, 'failed', {
          last_error: fallbackSend.error || 'Vision analysis failed and fallback message send failed',
        });
        return { result: 'failed_image_ai_and_fallback' };
      }

      const primarySend = await sendTrackedWhatsAppMessage({
        merchantId,
        inboundEventId: inbound.id,
        conversationId,
        userId: user.userId,
        to: phone,
        text: visionReply,
        previewUrl: false,
        messageKind: 'ai_primary',
        credentials,
      });

      if (!primarySend.success) {
        await setInboundStatus(inbound.id, 'failed', {
          last_error: primarySend.error || 'Failed to send AI vision response',
        });
        return { result: 'failed_image_ai_send' };
      }

      await addMessageToConversation(conversationId, 'assistant', visionReply);
      void recordMerchantPhotoAnalysis({
        merchantId,
        externalEventId: inbound.id,
        description: 'Customer photo analyzed with AI vision',
      }).catch((usageError) => {
        logger.error(
          { usageError, merchantId, inboundEventId: inbound.id },
          'Failed to report AI vision photo usage to Shopify shell'
        );
      });

      await setInboundStatus(inbound.id, 'processed', {
        last_error: null,
        processed_at: new Date().toISOString(),
      });
      return { result: 'processed_image_ai_sent' };
    }

    const history = await getConversationHistory(conversationId);
    let aiResponse;
    try {
      aiResponse = await generateAIResponse(
        messageText,
        merchantId,
        user.userId,
        conversationId,
        orderId,
        history
      );
    } catch (llmError) {
      logger.error({ llmError, conversationId, merchantId, inboundEventId: inbound.id }, 'LLM generation failed');
      const fallbackText = buildAiFallbackMessage(messageText);
      const fallbackSend = await sendTrackedWhatsAppMessage({
        merchantId,
        inboundEventId: inbound.id,
        conversationId,
        userId: user.userId,
        to: phone,
        text: fallbackText,
        previewUrl: false,
        messageKind: 'ai_fallback',
        credentials,
      });

      if (fallbackSend.success) {
        await addMessageToConversation(conversationId, 'assistant', fallbackText);
        await serviceClient
          .from('conversations')
          .update({
            escalation_status: 'pending',
            escalation_requested_at: new Date().toISOString(),
            conversation_status: 'human',
          })
          .eq('id', conversationId);
        await setInboundStatus(inbound.id, 'processed', {
          last_error: null,
          processed_at: new Date().toISOString(),
        });
        return { result: 'processed_ai_fallback_sent' };
      }

      await setInboundStatus(inbound.id, 'failed', {
        last_error: fallbackSend.error || 'LLM failed and fallback message send failed',
      });
      return { result: 'failed_ai_and_fallback' };
    }

    await updateConversationState(conversationId, aiResponse.intent);
    const primarySend = await sendTrackedWhatsAppMessage({
      merchantId,
      inboundEventId: inbound.id,
      conversationId,
      userId: user.userId,
      to: phone,
      text: aiResponse.response,
      previewUrl: false,
      messageKind: 'ai_primary',
      credentials,
    });

    if (!primarySend.success) {
      await setInboundStatus(inbound.id, 'failed', {
        last_error: primarySend.error || 'Failed to send AI response',
      });
      return { result: 'failed_ai_send' };
    }

    await addMessageToConversation(conversationId, 'assistant', aiResponse.response);

    if (aiResponse.upsellTriggered && aiResponse.upsellMessage) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const upsellSend = await sendTrackedWhatsAppMessage({
        merchantId,
        inboundEventId: inbound.id,
        conversationId,
        userId: user.userId,
        to: phone,
        text: aiResponse.upsellMessage,
        previewUrl: true,
        messageKind: 'ai_upsell',
        credentials,
      });

      if (upsellSend.success) {
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

    if (aiResponse.requiresHuman) {
      await serviceClient
        .from('conversations')
        .update({
          escalation_status: 'pending',
          escalation_requested_at: new Date().toISOString(),
          conversation_status: 'human',
        })
        .eq('id', conversationId);
    }

    await setInboundStatus(inbound.id, 'processed', {
      last_error: null,
      processed_at: new Date().toISOString(),
    });
    return { result: 'processed_ai_sent' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    logger.error({ error, inboundEventId: inbound.id }, 'Failed to process WhatsApp inbound event');
    await setInboundStatus(inbound.id, 'failed', {
      last_error: message,
      failed_at: new Date().toISOString(),
    });
    return { result: 'failed_unhandled' };
  }
}
