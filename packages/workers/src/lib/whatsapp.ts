/**
 * WhatsApp Business API integration (Meta Cloud API)
 * Copied from API package to avoid cross-package source imports.
 */

import { getSupabaseServiceClient } from '@recete/shared';

export interface WhatsAppMessage {
  to: string; // E.164 phone number
  text: string;
  preview_url?: boolean;
}

export interface WhatsAppSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppWebhookMessage {
  from: string; // Phone number
  messageId: string;
  timestamp: string;
  text?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contacts';
}

export async function sendWhatsAppMessage(
  message: WhatsAppMessage,
  accessToken: string,
  phoneNumberId: string
): Promise<WhatsAppSendResponse> {
  try {
    if (!message.to.startsWith('+')) {
      return {
        success: false,
        error: 'Phone number must be in E.164 format (e.g., +905551234567)',
      };
    }

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.to,
      type: 'text',
      text: {
        preview_url: message.preview_url || false,
        body: message.text,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data: any = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data?.error?.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: data?.messages?.[0]?.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export function verifyWhatsAppWebhook(
  mode: string | null,
  token: string | null,
  challenge: string | null,
  verifyToken: string
): string | null {
  if (mode === 'subscribe' && token === verifyToken) {
    return challenge || '';
  }
  return null;
}

export function parseWhatsAppWebhook(body: any): WhatsAppWebhookMessage[] {
  const messages: WhatsAppWebhookMessage[] = [];

  if (!body.entry || !Array.isArray(body.entry)) {
    return messages;
  }

  for (const entry of body.entry) {
    if (!entry.changes || !Array.isArray(entry.changes)) {
      continue;
    }

    for (const change of entry.changes) {
      if (change.value?.messages && Array.isArray(change.value.messages)) {
        for (const message of change.value.messages) {
          messages.push({
            from: message.from,
            messageId: message.id,
            timestamp: message.timestamp,
            text: message.text?.body,
            type: message.type || 'text',
          });
        }
      }
    }
  }

  return messages;
}

export async function getWhatsAppCredentials(_merchantId: string): Promise<{
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
} | null> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!accessToken || !phoneNumberId || !verifyToken) {
    return null;
  }

  return {
    accessToken,
    phoneNumberId,
    verifyToken,
  };
}

/**
 * Resolve which merchant's WhatsApp credentials to use (merchant's own vs corporate).
 * Reads persona_settings.whatsapp_sender_mode from merchants table.
 */
export async function getEffectiveWhatsAppCredentials(merchantId: string): Promise<{
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
} | null> {
  const serviceClient = getSupabaseServiceClient();
  const { data: merchant } = await serviceClient
    .from('merchants')
    .select('persona_settings')
    .eq('id', merchantId)
    .single();

  const mode = (merchant?.persona_settings as Record<string, unknown>)?.whatsapp_sender_mode;
  const useCorporate = mode === 'corporate';
  const effectiveMerchantId = useCorporate && process.env.DEFAULT_MERCHANT_ID
    ? process.env.DEFAULT_MERCHANT_ID
    : merchantId;

  return getWhatsAppCredentials(effectiveMerchantId);
}

