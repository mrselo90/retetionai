/**
 * WhatsApp Business API integration
 * Handles sending messages and receiving webhooks (Meta Cloud API and Twilio WhatsApp)
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

export type WhatsAppProvider = 'meta' | 'twilio';

export interface MetaWhatsAppCredentials {
  provider: 'meta';
  accessToken: string;
  phoneNumberId: string;
  verifyToken?: string;
  phoneNumberDisplay?: string;
}

export interface TwilioWhatsAppCredentials {
  provider: 'twilio';
  accountSid: string;
  authToken: string;
  fromNumber: string; // E.164 or whatsapp:+E164
  phoneNumberDisplay?: string;
}

export type WhatsAppCredentials = MetaWhatsAppCredentials | TwilioWhatsAppCredentials;

export interface WhatsAppWebhookMessage {
  from: string; // Phone number
  messageId: string;
  timestamp: string;
  text?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contacts';
}

/**
 * Send WhatsApp message via configured provider
 */
export async function sendWhatsAppMessage(
  message: WhatsAppMessage,
  credentials: WhatsAppCredentials
): Promise<WhatsAppSendResponse>;
export async function sendWhatsAppMessage(
  message: WhatsAppMessage,
  accessToken: string,
  phoneNumberId: string
): Promise<WhatsAppSendResponse>;
export async function sendWhatsAppMessage(
  message: WhatsAppMessage,
  credentialsOrAccessToken: WhatsAppCredentials | string,
  phoneNumberId?: string
): Promise<WhatsAppSendResponse> {
  if (typeof credentialsOrAccessToken === 'object' && credentialsOrAccessToken !== null) {
    return sendWhatsAppMessageWithCredentials(
      message,
      credentialsOrAccessToken
    );
  }

  return sendWhatsAppMessageWithCredentials(message, {
    provider: 'meta',
    accessToken: credentialsOrAccessToken,
    phoneNumberId: phoneNumberId || '',
  });
}

async function sendWhatsAppMessageWithCredentials(
  message: WhatsAppMessage,
  credentials: WhatsAppCredentials
): Promise<WhatsAppSendResponse> {
  if (credentials.provider === 'twilio') {
    return sendTwilioWhatsAppMessage(message, credentials);
  }
  return sendMetaWhatsAppMessage(message, credentials);
}

async function sendMetaWhatsAppMessage(
  message: WhatsAppMessage,
  credentials: MetaWhatsAppCredentials
): Promise<WhatsAppSendResponse> {
  try {
    // Validate phone number (E.164 format)
    if (!message.to.startsWith('+')) {
      return {
        success: false,
        error: 'Phone number must be in E.164 format (e.g., +905551234567)',
      };
    }

    if (!credentials.accessToken || !credentials.phoneNumberId) {
      return {
        success: false,
        error: 'Meta WhatsApp credentials are incomplete',
      };
    }

    const url = `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`;

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
        Authorization: `Bearer ${credentials.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as any;

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
    console.error('WhatsApp send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function toTwilioWhatsAppAddress(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`;
}

function stripTwilioWhatsAppPrefix(phone: string): string {
  return phone.startsWith('whatsapp:') ? phone.slice('whatsapp:'.length) : phone;
}

async function sendTwilioWhatsAppMessage(
  message: WhatsAppMessage,
  credentials: TwilioWhatsAppCredentials
): Promise<WhatsAppSendResponse> {
  try {
    if (!message.to.startsWith('+')) {
      return {
        success: false,
        error: 'Phone number must be in E.164 format (e.g., +905551234567)',
      };
    }

    if (!credentials.accountSid || !credentials.authToken || !credentials.fromNumber) {
      return {
        success: false,
        error: 'Twilio WhatsApp credentials are incomplete',
      };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`;
    const form = new URLSearchParams();
    form.set('From', toTwilioWhatsAppAddress(credentials.fromNumber));
    form.set('To', toTwilioWhatsAppAddress(message.to));
    form.set('Body', message.text);

    const basicAuth = Buffer.from(
      `${credentials.accountSid}:${credentials.authToken}`,
      'utf8'
    ).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: form.toString(),
    });

    const raw = await response.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { message: raw };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data?.message || data?.error_message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: data?.sid,
    };
  } catch (error) {
    console.error('Twilio WhatsApp send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify WhatsApp webhook (for GET request)
 */
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

/**
 * Parse incoming WhatsApp webhook message
 */
export function parseWhatsAppWebhook(
  body: any,
  provider?: WhatsAppProvider
): WhatsAppWebhookMessage[] {
  const detectedProvider = provider || detectWhatsAppWebhookProvider(body);
  if (detectedProvider === 'twilio') {
    return parseTwilioWhatsAppWebhook(body);
  }

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

function detectWhatsAppWebhookProvider(body: any): WhatsAppProvider {
  if (
    body &&
    typeof body === 'object' &&
    ('MessageSid' in body || 'SmsMessageSid' in body || 'WaId' in body)
  ) {
    return 'twilio';
  }
  return 'meta';
}

function parseTwilioWhatsAppWebhook(body: any): WhatsAppWebhookMessage[] {
  if (!body || typeof body !== 'object') {
    return [];
  }

  const fromRaw = typeof body.From === 'string' ? body.From.trim() : '';
  const messageId =
    (typeof body.MessageSid === 'string' && body.MessageSid.trim()) ||
    (typeof body.SmsMessageSid === 'string' && body.SmsMessageSid.trim()) ||
    '';
  const text = typeof body.Body === 'string' ? body.Body : undefined;
  const numMediaRaw = typeof body.NumMedia === 'string' ? body.NumMedia : '0';
  const numMedia = Number.parseInt(numMediaRaw, 10) || 0;

  // Status callbacks can hit the same URL; only treat inbound WA messages as chat input.
  if (!fromRaw || !fromRaw.startsWith('whatsapp:') || !messageId) {
    return [];
  }

  if (!text && numMedia === 0) {
    return [];
  }

  const type: WhatsAppWebhookMessage['type'] = numMedia > 0 ? 'image' : 'text';

  return [
    {
      from: stripTwilioWhatsAppPrefix(fromRaw),
      messageId,
      timestamp: new Date().toISOString(),
      text,
      type,
    },
  ];
}

/** auth_data shape for integrations where provider = 'whatsapp' */
export interface WhatsAppAuthData {
  wa_provider?: 'meta' | 'twilio';
  provider_type?: 'meta' | 'twilio';
  phone_number_id?: string;
  access_token?: string;
  verify_token?: string;
  account_sid?: string;
  auth_token?: string;
  from_number?: string;
  phone_number_display?: string;
}

function parseWhatsAppAuthData(auth: WhatsAppAuthData | null): WhatsAppCredentials | null {
  if (!auth || typeof auth !== 'object') return null;

  const declaredProvider =
    auth.wa_provider ||
    auth.provider_type ||
    (auth.account_sid && auth.auth_token && auth.from_number ? 'twilio' : undefined);

  if (declaredProvider === 'twilio') {
    if (!auth.account_sid || !auth.auth_token || !auth.from_number) {
      return null;
    }
    return {
      provider: 'twilio',
      accountSid: auth.account_sid,
      authToken: auth.auth_token,
      fromNumber: auth.from_number,
      phoneNumberDisplay: auth.phone_number_display,
    };
  }

  if (auth.access_token && auth.phone_number_id) {
    return {
      provider: 'meta',
      accessToken: auth.access_token,
      phoneNumberId: auth.phone_number_id,
      verifyToken: auth.verify_token,
      phoneNumberDisplay: auth.phone_number_display,
    };
  }

  return null;
}

function getEnvWhatsAppCredentials(): WhatsAppCredentials | null {
  const providerPreference = (process.env.WHATSAPP_PROVIDER || '').trim().toLowerCase();

  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioAuthToken =
    process.env.TWILIO_WHATSAPP_AUTH_TOKEN?.trim() || process.env.TWILIO_AUTH_TOKEN?.trim();
  const twilioFromNumber =
    process.env.TWILIO_WHATSAPP_NUMBER?.trim() || process.env.TWILIO_WHATSAPP_FROM?.trim();

  const metaAccessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const metaPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const metaVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  const twilioCreds =
    twilioAccountSid && twilioAuthToken && twilioFromNumber
      ? ({
          provider: 'twilio',
          accountSid: twilioAccountSid,
          authToken: twilioAuthToken,
          fromNumber: twilioFromNumber,
        } satisfies TwilioWhatsAppCredentials)
      : null;

  const metaCreds =
    metaAccessToken && metaPhoneNumberId
      ? ({
          provider: 'meta',
          accessToken: metaAccessToken,
          phoneNumberId: metaPhoneNumberId,
          verifyToken: metaVerifyToken,
        } satisfies MetaWhatsAppCredentials)
      : null;

  if (providerPreference === 'twilio') return twilioCreds;
  if (providerPreference === 'meta') return metaCreds;

  return twilioCreds || metaCreds;
}

/**
 * Get WhatsApp credentials: first from merchant's WhatsApp integration, else env (corporate).
 */
export async function getWhatsAppCredentials(merchantId: string): Promise<WhatsAppCredentials | null> {
  const serviceClient = getSupabaseServiceClient();
  const { data: row } = await serviceClient
    .from('integrations')
    .select('auth_data')
    .eq('merchant_id', merchantId)
    .eq('provider', 'whatsapp')
    .in('status', ['active', 'pending'])
    .single();

  const auth = row?.auth_data as WhatsAppAuthData | null;
  const integrationCreds = parseWhatsAppAuthData(auth);
  if (integrationCreds) {
    return integrationCreds;
  }

  return getEnvWhatsAppCredentials();
}

/** Merchant preference: use own WhatsApp number vs platform corporate number */
export type WhatsAppSenderMode = 'merchant_own' | 'corporate';

/**
 * Resolve which merchant's WhatsApp credentials to use for sending.
 * Reads persona_settings.whatsapp_sender_mode: 'merchant_own' = this merchant; 'corporate' = DEFAULT_MERCHANT_ID.
 */
export async function getEffectiveWhatsAppCredentials(
  merchantId: string
): Promise<WhatsAppCredentials | null> {
  const serviceClient = getSupabaseServiceClient();
  const { data: merchant } = await serviceClient
    .from('merchants')
    .select('persona_settings')
    .eq('id', merchantId)
    .single();

  const mode = (merchant?.persona_settings as any)?.whatsapp_sender_mode;
  const useCorporate = mode === 'corporate';
  const effectiveMerchantId = useCorporate && process.env.DEFAULT_MERCHANT_ID
    ? process.env.DEFAULT_MERCHANT_ID
    : merchantId;

  return getWhatsAppCredentials(effectiveMerchantId);
}
