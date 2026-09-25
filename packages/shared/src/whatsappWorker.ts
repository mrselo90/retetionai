/**
 * WhatsApp through each store's linked device (packages/wa-worker).
 *
 * The merchant links their own WhatsApp number by scanning a QR code, the way
 * WhatsApp Web is linked; the Go worker holds that session and sends for them.
 * This is not the official WhatsApp Business Platform.
 *
 * The API and the workers both send through here, so they classify failures
 * the same way. The worker listens on loopback; WA_WORKER_URL and
 * WA_WORKER_SECRET must be set in both processes.
 */

import { getSupabaseServiceClient } from './supabase.js';

export const WHATSAPP_PROVIDER = 'whatsmeow' as const;

export interface WhatsAppMessage {
  /** E.164 phone number, or the exact chat JID a customer wrote from (may be an @lid). */
  to: string;
  text: string;
  preview_url?: boolean;
  /**
   * A person typed this (a merchant replying from the dashboard). Automated
   * messages are paced like a person and count against the line's daily cap;
   * a typed reply goes out as is.
   */
  typedByPerson?: boolean;
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

/** A merchant's linked number, as the send path needs it. */
export interface WhatsAppCredentials {
  provider: string;
  merchantId: string;
  phoneNumberDisplay?: string;
}

/** Normalised inbound message, as stored in whatsapp_inbound_events.payload. */
export interface WhatsAppWebhookMessage {
  from: string; // Phone number, or the chat JID when WhatsApp withheld the number
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

export const WHATSAPP_NOT_CONFIGURED = 'WhatsApp is not connected for this store';

export type WhatsAppConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'qr'
  | 'connected'
  | 'logged_out';

export interface WhatsAppConnectionRow {
  merchant_id: string;
  status: WhatsAppConnectionStatus;
  phone_e164: string | null;
  qr: string | null;
  last_error: string | null;
  connected_at: string | null;
  first_paired_at: string | null;
  updated_at: string | null;
}

export function getWaWorkerConfig(): { url: string; secret: string } | null {
  const url = process.env.WA_WORKER_URL?.trim().replace(/\/+$/, '');
  const secret = process.env.WA_WORKER_SECRET?.trim();
  return url && secret ? { url, secret } : null;
}

export class WaWorkerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

/**
 * One call to the worker. Throws WaWorkerError on a non-2xx answer and on a
 * network failure (status 0).
 */
export async function callWaWorker<T = Record<string, unknown>>(
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {}
): Promise<T> {
  const config = getWaWorkerConfig();
  if (!config) throw new WaWorkerError('WA_WORKER_URL / WA_WORKER_SECRET not set', 0);

  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'x-wa-worker-secret': config.secret,
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
    });
  } catch (error) {
    throw new WaWorkerError(error instanceof Error ? error.message : 'worker unreachable', 0);
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new WaWorkerError(String(data.error ?? `HTTP ${response.status}`), response.status, data);
  }
  return data as T;
}

/**
 * Map a worker failure onto the categories the callers already act on:
 * retryable failures are thrown back to BullMQ, permanent ones mark the task
 * failed.
 */
export function classifyWorkerFailure(error: unknown): WhatsAppSendResponse {
  const base = { success: false as const, provider: WHATSAPP_PROVIDER };
  if (!(error instanceof WaWorkerError)) {
    return {
      ...base,
      error: error instanceof Error ? error.message : 'Unknown send failure',
      retryable: true,
      failureCategory: 'temporary',
    };
  }
  const code = typeof error.body.error === 'string' ? error.body.error : error.message;
  const common = { ...base, error: code, errorCode: code, httpStatus: error.status };

  switch (error.status) {
    case 429: {
      const retryAfterMs = Number(error.body.retryAfterMs);
      return {
        ...common,
        retryable: true,
        rateLimited: true,
        retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
        failureCategory: 'rate_limit',
      };
    }
    case 400:
    case 422:
      // Bad recipient / not on WhatsApp: retrying cannot change the answer.
      return { ...common, retryable: false, failureCategory: 'permanent' };
    case 409:
      // Not connected. Often a reconnect in progress, sometimes an unlinked
      // phone; a few retries cover the first, the task fails for the second.
      return { ...common, retryable: true, failureCategory: 'temporary' };
    default:
      // 0 (worker down), 5xx: a restart or a WhatsApp hiccup.
      return { ...common, retryable: true, failureCategory: 'temporary' };
  }
}

export async function sendWhatsAppMessage(
  message: WhatsAppMessage,
  credentials: WhatsAppCredentials
): Promise<WhatsAppSendResponse> {
  if (!credentials?.merchantId) {
    return {
      success: false,
      error: WHATSAPP_NOT_CONFIGURED,
      retryable: false,
      failureCategory: 'permanent',
    };
  }
  try {
    const result = await callWaWorker<{ id?: string }>('/send', {
      method: 'POST',
      body: {
        merchantId: credentials.merchantId,
        to: message.to,
        body: message.text,
        humanize: !message.typedByPerson,
      },
      // Humanized sends queue per line and "type" for a few seconds each.
      timeoutMs: 120_000,
    });
    return { success: true, messageId: result.id, provider: WHATSAPP_PROVIDER };
  } catch (error) {
    return classifyWorkerFailure(error);
  }
}

export async function getWhatsAppConnection(
  merchantId: string
): Promise<WhatsAppConnectionRow | null> {
  const { data, error } = await getSupabaseServiceClient()
    .from('whatsapp_connections')
    .select(
      'merchant_id, status, phone_e164, qr, last_error, connected_at, first_paired_at, updated_at'
    )
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (error) throw new Error(`whatsapp_connections lookup failed: ${error.message}`);
  return (data as WhatsAppConnectionRow | null) ?? null;
}

/**
 * The merchant's linked number, or null when none is connected. A read failure
 * also answers null — every caller treats that as "not configured" — but is
 * logged by the caller's path, never mistaken for a connected line.
 */
export async function getEffectiveWhatsAppCredentials(
  merchantId: string
): Promise<WhatsAppCredentials | null> {
  if (!getWaWorkerConfig()) return null;
  let row: WhatsAppConnectionRow | null;
  try {
    row = await getWhatsAppConnection(merchantId);
  } catch {
    return null;
  }
  if (!row || row.status !== 'connected') return null;
  return {
    provider: WHATSAPP_PROVIDER,
    merchantId,
    phoneNumberDisplay: row.phone_e164 ?? undefined,
  };
}

/**
 * A customer's photo as a data URL, fetched from WhatsApp through the worker.
 * `media` is the download descriptor the inbound event carried
 * (payload.message.image.providerMediaId). Throws when it cannot be had.
 */
export async function fetchWhatsAppImageDataUrl(
  merchantId: string,
  media: string
): Promise<string> {
  const result = await callWaWorker<{ mimeType?: string; data?: string }>('/media', {
    method: 'POST',
    body: { merchantId, media },
    timeoutMs: 30_000,
  });
  if (!result.data) throw new Error('wa-worker returned no image data');
  return `data:${result.mimeType || 'image/jpeg'};base64,${result.data}`;
}

/**
 * Unlink a store's number on WhatsApp's side and drop the stored session. For
 * uninstall and data deletion: holding the keys to a WhatsApp account for a
 * store that left is not acceptable. Best effort — returns false instead of
 * throwing, so it never blocks the flow it is part of; callers log the miss.
 */
export async function unlinkWhatsAppBestEffort(merchantId: string): Promise<boolean> {
  if (!getWaWorkerConfig()) return true;
  try {
    await callWaWorker('/disconnect', { method: 'POST', body: { merchantId } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Recete has no number of its own: every message goes from the store's linked
 * line. Platform notifications to merchants therefore have no WhatsApp sender.
 */
export async function getCorporateWhatsAppCredentials(): Promise<WhatsAppCredentials | null> {
  return null;
}
