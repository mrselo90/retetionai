/**
 * WhatsApp via Meta's Cloud API, with numbers connected by each merchant
 * through Embedded Signup. There is no shared Recete number: every merchant
 * sends from their own WhatsApp Business number.
 *
 * Shared by the API and the workers so both send the same way. Credentials
 * live on the merchant's `integrations` row (provider 'whatsapp'); the access
 * token is stored encrypted with ENCRYPTION_KEY and only decrypted here.
 */

import * as crypto from 'crypto';
import { getSupabaseServiceClient } from './supabase.js';

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

export interface WhatsAppCredentials {
  // 'meta': the provider value the whatsapp_* message tables accept.
  provider: 'meta';
  accessToken: string;
  phoneNumberId: string;
  wabaId?: string;
  phoneNumberDisplay?: string;
}

/** Normalised inbound message, as stored in whatsapp_inbound_events.payload. */
export interface WhatsAppWebhookMessage {
  from: string;
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

/** auth_data stored on the merchant's integrations row (provider 'whatsapp'). */
export interface WhatsAppCloudAuthData {
  provider: 'meta_cloud';
  waba_id: string;
  phone_number_id: string;
  phone_number_display?: string | null;
  verified_name?: string | null;
  access_token_enc: string;
  coexistence?: boolean;
  connected_at?: string;
}

export function getMetaGraphVersion(): string {
  return process.env.META_GRAPH_VERSION?.trim() || 'v21.0';
}

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${getMetaGraphVersion()}/${path.replace(/^\//, '')}`;
}

// ---------------------------------------------------------------------------
// Secret encryption (same AES-256-GCM format as phone numbers)
// ---------------------------------------------------------------------------

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  // No throwaway fallback: a token encrypted with a random key is lost on the
  // next restart, which would silently disconnect the merchant's WhatsApp.
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('ENCRYPTION_KEY is missing or invalid; cannot store WhatsApp credentials');
  }
  return Buffer.from(key, 'hex');
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted}`;
}

export function decryptSecret(value: string): string {
  const [ivHex, tagHex, encrypted] = value.split(':');
  if (!ivHex || !tagHex || encrypted === undefined) throw new Error('Invalid encrypted secret');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

/**
 * The merchant's connected WhatsApp number, or null when they have not
 * connected one (or its stored token cannot be read).
 */
export async function getEffectiveWhatsAppCredentials(
  merchantId: string
): Promise<WhatsAppCredentials | null> {
  const serviceClient = getSupabaseServiceClient();
  const { data: row } = await serviceClient
    .from('integrations')
    .select('auth_data')
    .eq('merchant_id', merchantId)
    .eq('provider', 'whatsapp')
    .eq('status', 'active')
    .maybeSingle();

  const auth = row?.auth_data as Partial<WhatsAppCloudAuthData> | null | undefined;
  if (!auth || auth.provider !== 'meta_cloud' || !auth.phone_number_id || !auth.access_token_enc) {
    return null;
  }

  try {
    return {
      provider: 'meta',
      accessToken: decryptSecret(auth.access_token_enc),
      phoneNumberId: auth.phone_number_id,
      wabaId: auth.waba_id,
      phoneNumberDisplay: auth.phone_number_display ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Recete-originated messages used to go from a shared corporate number. There
 * is none any more, so those notifications are not sent over WhatsApp.
 */
export async function getCorporateWhatsAppCredentials(): Promise<WhatsAppCredentials | null> {
  return null;
}

/** Merchant that owns a connected phone number id (for inbound webhooks). */
export async function findMerchantByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  if (!phoneNumberId) return null;
  const serviceClient = getSupabaseServiceClient();
  const { data } = await serviceClient
    .from('integrations')
    .select('merchant_id')
    .eq('provider', 'whatsapp')
    .eq('status', 'active')
    .contains('auth_data', { phone_number_id: phoneNumberId })
    .limit(1);
  return (data?.[0]?.merchant_id as string | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const seconds = Number.parseInt(headerValue, 10);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const dateValue = Date.parse(headerValue);
  if (Number.isFinite(dateValue)) {
    const delayMs = dateValue - Date.now();
    return delayMs > 0 ? delayMs : undefined;
  }
  return undefined;
}

export function classifyMetaError(
  status: number,
  data: any,
  retryAfterMs?: number
): WhatsAppSendResponse {
  const metaError = data?.error || {};
  const message = metaError?.message || `HTTP ${status}`;
  const code = metaError?.code !== undefined ? String(metaError.code) : undefined;
  const subcode =
    metaError?.error_subcode !== undefined ? String(metaError.error_subcode) : undefined;
  const errorCode = subcode ? `${code ?? String(status)}:${subcode}` : (code ?? String(status));
  const base = {
    success: false as const,
    provider: 'meta',
    error: message,
    errorCode,
    httpStatus: status,
  };

  if (status === 429 || code === '130429' || code === '131056') {
    return {
      ...base,
      retryable: true,
      rateLimited: true,
      retryAfterMs,
      failureCategory: 'rate_limit',
    };
  }
  if (status >= 500) {
    return { ...base, retryable: true, retryAfterMs, failureCategory: 'temporary' };
  }
  return { ...base, retryable: false, failureCategory: 'permanent' };
}

export async function sendWhatsAppMessage(
  message: WhatsAppMessage,
  credentials: WhatsAppCredentials
): Promise<WhatsAppSendResponse> {
  if (!message.to.startsWith('+')) {
    return {
      success: false,
      provider: 'meta',
      error: 'Phone number must be in E.164 format (e.g., +905551234567)',
      retryable: false,
      failureCategory: 'permanent',
    };
  }

  try {
    const response = await fetch(graphUrl(`${credentials.phoneNumberId}/messages`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        // Cloud API takes the number without the leading "+".
        to: message.to.replace(/^\+/, ''),
        type: 'text',
        text: { preview_url: message.preview_url || false, body: message.text },
      }),
    });
    const data = (await response.json().catch(() => ({}))) as any;
    if (!response.ok) {
      return classifyMetaError(
        response.status,
        data,
        parseRetryAfterMs(response.headers.get('Retry-After'))
      );
    }
    return { success: true, provider: 'meta', messageId: data?.messages?.[0]?.id };
  } catch (error) {
    return {
      success: false,
      provider: 'meta',
      error: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
      failureCategory: 'temporary',
    };
  }
}

// ---------------------------------------------------------------------------
// Inbound webhooks
// ---------------------------------------------------------------------------

/** X-Hub-Signature-256 check against the Meta app secret. */
export function verifyMetaSignature(
  rawBody: string,
  header: string | undefined,
  appSecret: string
): boolean {
  if (!header || !appSecret) return false;
  const [algo, digest] = header.trim().split('=');
  if (algo !== 'sha256' || !digest) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest();
  const received = Buffer.from(digest.trim(), 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

const KNOWN_MESSAGE_TYPES = new Set<WhatsAppWebhookMessage['type']>([
  'text',
  'image',
  'video',
  'audio',
  'document',
  'location',
  'contacts',
]);

/** Customer messages from a Cloud API webhook body; delivery statuses are skipped. */
export function parseMetaWebhook(body: any): WhatsAppWebhookMessage[] {
  const messages: WhatsAppWebhookMessage[] = [];
  if (!body?.entry || !Array.isArray(body.entry)) return messages;

  for (const entry of body.entry) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const phoneNumberId: string | undefined = change?.value?.metadata?.phone_number_id;
      for (const message of Array.isArray(change?.value?.messages) ? change.value.messages : []) {
        messages.push({
          // Cloud API sends numbers without "+"; the rest of the app uses E.164.
          from: String(message.from || '').startsWith('+') ? message.from : `+${message.from}`,
          messageId: message.id,
          timestamp: message.timestamp,
          text:
            message.text?.body ?? message.button?.text ?? message.interactive?.button_reply?.title,
          // Quick-reply buttons and interactive replies arrive as their own
          // types; they carry text, so treat them as text messages.
          type: KNOWN_MESSAGE_TYPES.has(message.type) ? message.type : 'text',
          phoneNumberId,
          image:
            message.type === 'image'
              ? {
                  providerMediaId: message.image?.id,
                  mimeType: message.image?.mime_type,
                  caption: message.image?.caption,
                  sha256: message.image?.sha256,
                }
              : undefined,
        });
      }
    }
  }
  return messages;
}

/** Download an inbound image as a data URL, for AI vision. */
export async function downloadMetaImageDataUrl(
  message: WhatsAppWebhookMessage,
  credentials: WhatsAppCredentials
): Promise<string> {
  const mediaId = message.image?.providerMediaId?.trim();
  if (!mediaId) throw new Error('Image message is missing a media id');

  const metaResponse = await fetch(graphUrl(mediaId), {
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
  });
  if (!metaResponse.ok) {
    throw new Error(`Failed to fetch media metadata (${metaResponse.status})`);
  }
  const metadata = (await metaResponse.json()) as { url?: string; mime_type?: string };
  if (!metadata.url) throw new Error('Media metadata did not include a download url');

  const response = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
  });
  if (!response.ok) throw new Error(`Failed to download image (${response.status})`);

  const mimeType = metadata.mime_type || message.image?.mimeType || 'image/jpeg';
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}
