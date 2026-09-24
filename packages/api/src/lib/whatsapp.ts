/**
 * WhatsApp messaging — provider-free.
 *
 * The Twilio and Meta Cloud API integrations were removed on 2026-09-24 at the
 * owner's request. Until a new provider is connected here, nothing can send or
 * receive WhatsApp messages: getEffectiveWhatsAppCredentials() reports "not
 * configured" (null) and sendWhatsAppMessage() fails without retrying, so every
 * caller takes the "WhatsApp not configured" path it already has.
 *
 * The rest of the messaging product (conversations, scheduling, consent, AI
 * replies, the inbox/outbox tables) is provider-independent and unchanged; a
 * new provider only needs to implement the two functions below.
 */

export interface WhatsAppMessage {
  to: string; // E.164 phone number
  text: string;
  preview_url?: boolean;
}

export interface WhatsAppSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
  retryable?: boolean;
  rateLimited?: boolean;
  retryAfterMs?: number;
  errorCode?: string;
  httpStatus?: number;
  failureCategory?: 'rate_limit' | 'temporary' | 'permanent';
}

/** A connected WhatsApp sender. None exist while no provider is integrated. */
export interface WhatsAppCredentials {
  provider: string;
  phoneNumberDisplay?: string;
}

/** Normalised inbound message, as stored in whatsapp_inbound_events.payload. */
export interface WhatsAppWebhookMessage {
  from: string; // Phone number
  messageId: string;
  timestamp: string;
  text?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contacts';
  phoneNumberId?: string;
  image?: {
    providerMediaId?: string;
    mimeType?: string;
    caption?: string;
    sha256?: string;
    url?: string;
  };
}

export const WHATSAPP_NOT_CONFIGURED = 'No WhatsApp provider is connected';

export async function sendWhatsAppMessage(
  _message: WhatsAppMessage,
  _credentials: WhatsAppCredentials
): Promise<WhatsAppSendResponse> {
  return {
    success: false,
    error: WHATSAPP_NOT_CONFIGURED,
    retryable: false,
    failureCategory: 'permanent',
  };
}

export async function getEffectiveWhatsAppCredentials(
  _merchantId: string
): Promise<WhatsAppCredentials | null> {
  return null;
}

export async function getCorporateWhatsAppCredentials(): Promise<WhatsAppCredentials | null> {
  return null;
}
