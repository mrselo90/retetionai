import { getSupabaseServiceClient, logger } from '@recete/shared';
import { recordMerchantBillableChat } from './merchantPlanFeatures.js';
import { sendWhatsAppMessage, type WhatsAppCredentials } from './whatsapp.js';

export type WhatsAppOutboxMessageKind =
  | 'unknown_user_default'
  | 'ai_primary'
  | 'ai_fallback'
  | 'ai_upsell'
  | 'manual'
  | 'delivery_template'
  | 'delivery_template_followup';

export interface SendTrackedWhatsAppMessageInput {
  merchantId: string;
  inboundEventId?: string;
  conversationId?: string;
  userId?: string;
  to: string;
  text: string;
  previewUrl?: boolean;
  messageKind: WhatsAppOutboxMessageKind;
  credentials: WhatsAppCredentials;
}

export interface SendTrackedWhatsAppMessageResult {
  success: boolean;
  outboxId?: string;
  providerMessageId?: string;
  error?: string;
  alreadySent?: boolean;
}

type OutboxRow = {
  id: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  provider_message_id?: string | null;
};

function isBillableAiMessageKind(messageKind: WhatsAppOutboxMessageKind) {
  return messageKind === 'ai_primary' || messageKind === 'ai_fallback';
}

function isSchemaMissingError(error: unknown): boolean {
  const code = (error as any)?.code;
  return code === '42P01' || code === '42703';
}

async function resolveExistingOutboxRow(input: SendTrackedWhatsAppMessageInput): Promise<OutboxRow | null> {
  if (!input.inboundEventId) return null;
  const serviceClient = getSupabaseServiceClient();

  const { data, error } = await serviceClient
    .from('whatsapp_outbound_events')
    .select('id, status, attempts, provider_message_id')
    .eq('merchant_id', input.merchantId)
    .eq('inbound_event_id', input.inboundEventId)
    .eq('message_kind', input.messageKind)
    .maybeSingle();

  if (error) return null;
  return (data as OutboxRow | null) ?? null;
}

export async function sendTrackedWhatsAppMessage(
  input: SendTrackedWhatsAppMessageInput
): Promise<SendTrackedWhatsAppMessageResult> {
  const serviceClient = getSupabaseServiceClient();
  const provider = input.credentials.provider;
  const nowIso = new Date().toISOString();

  let existing = await resolveExistingOutboxRow(input);
  if (existing?.status === 'sent') {
    return {
      success: true,
      outboxId: existing.id,
      providerMessageId: existing.provider_message_id ?? undefined,
      alreadySent: true,
    };
  }

  let outboxId = existing?.id;
  let currentAttempts = existing?.attempts ?? 0;

  if (!outboxId) {
    const insertPayload = {
      merchant_id: input.merchantId,
      inbound_event_id: input.inboundEventId ?? null,
      conversation_id: input.conversationId ?? null,
      user_id: input.userId ?? null,
      provider,
      to_phone: input.to,
      message_kind: input.messageKind,
      message_text: input.text,
      preview_url: Boolean(input.previewUrl),
      status: 'pending',
      requested_at: nowIso,
    };

    const { data: inserted, error: insertError } = await serviceClient
      .from('whatsapp_outbound_events')
      .insert(insertPayload)
      .select('id, attempts')
      .single();

    if (insertError) {
      if (isSchemaMissingError(insertError)) {
        const direct = await sendWhatsAppMessage(
          {
            to: input.to,
            text: input.text,
            preview_url: Boolean(input.previewUrl),
          },
          input.credentials
        );
        return {
          success: direct.success,
          providerMessageId: direct.messageId,
          error: direct.error,
        };
      }
      if ((insertError as any).code === '23505') {
        existing = await resolveExistingOutboxRow(input);
        if (existing?.status === 'sent') {
          return {
            success: true,
            outboxId: existing.id,
            providerMessageId: existing.provider_message_id ?? undefined,
            alreadySent: true,
          };
        }
        if (!existing?.id) {
          return {
            success: false,
            error: 'Failed to resolve outbox row after duplicate key',
          };
        }
        outboxId = existing.id;
        currentAttempts = existing.attempts;
      } else {
        return {
          success: false,
          error: `Failed to create outbox row: ${insertError.message}`,
        };
      }
    } else {
      outboxId = inserted?.id as string;
      currentAttempts = (inserted?.attempts as number | undefined) ?? 0;
    }
  }

  if (!outboxId) {
    return {
      success: false,
      error: 'Outbox row id is missing',
    };
  }

  const sendResult = await sendWhatsAppMessage(
    {
      to: input.to,
      text: input.text,
      preview_url: Boolean(input.previewUrl),
    },
    input.credentials
  );

  const nextAttempts = currentAttempts + 1;
  if (!sendResult.success) {
    const errorText = sendResult.error || 'Failed to send WhatsApp message';
    const { error: updateFailedError } = await serviceClient
      .from('whatsapp_outbound_events')
      .update({
        status: 'failed',
        attempts: nextAttempts,
        error_text: errorText,
        failed_at: new Date().toISOString(),
      })
      .eq('id', outboxId);
    if (updateFailedError && !isSchemaMissingError(updateFailedError)) {
      logger.warn({ updateFailedError, outboxId }, 'Failed to update whatsapp outbox failure state');
    }
    return {
      success: false,
      outboxId,
      error: errorText,
    };
  }

  const { error: updateSentError } = await serviceClient
    .from('whatsapp_outbound_events')
    .update({
      status: 'sent',
      attempts: nextAttempts,
      provider_message_id: sendResult.messageId || null,
      error_text: null,
      sent_at: new Date().toISOString(),
      failed_at: null,
    })
    .eq('id', outboxId);
  if (updateSentError && !isSchemaMissingError(updateSentError)) {
    logger.warn({ updateSentError, outboxId }, 'Failed to update whatsapp outbox sent state');
  }

  logger.info(
    {
      outboxId,
      inboundEventId: input.inboundEventId || null,
      messageKind: input.messageKind,
      provider,
    },
    'whatsapp_outbox_sent'
  );

  if (isBillableAiMessageKind(input.messageKind)) {
    const usageEventId = outboxId;
    void recordMerchantBillableChat({
      merchantId: input.merchantId,
      externalEventId: usageEventId,
      description: `Billable AI chat (${input.messageKind})`,
    }).catch((error) => {
      logger.error(
        {
          error,
          merchantId: input.merchantId,
          outboxId,
          messageKind: input.messageKind,
        },
        'Failed to report billable AI chat to Shopify shell',
      );
    });
  }

  return {
    success: true,
    outboxId,
    providerMessageId: sendResult.messageId,
  };
}
