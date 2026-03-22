/**
 * Delivery template service
 * Sends Twilio WhatsApp templates after order delivery and handles quick reply responses.
 */

import { getSupabaseServiceClient, logger } from '@recete/shared';
import {
  sendTwilioWhatsAppTemplate,
  getEffectiveWhatsAppCredentials,
  type TwilioWhatsAppCredentials,
  type WhatsAppCredentials,
} from './whatsapp.js';
import { sendTrackedWhatsAppMessage } from './whatsappOutbox.js';

// ---------------------------------------------------------------------------
// Template Content SIDs (Twilio Console)
// ---------------------------------------------------------------------------

const DEFAULT_CONTENT_SID_EN = 'HX48bf74194a186264d64a86098b4d1bed';
const DEFAULT_CONTENT_SID_HU = 'HXa96141ffeaea9bdf1bc47bc26c97d4df';

function getContentSid(lang: TemplateLang): string {
  if (lang === 'hu') {
    return process.env.TWILIO_TEMPLATE_DELIVERED_HU?.trim() || DEFAULT_CONTENT_SID_HU;
  }
  return process.env.TWILIO_TEMPLATE_DELIVERED_EN?.trim() || DEFAULT_CONTENT_SID_EN;
}

function getTemplateName(lang: TemplateLang): string {
  return lang === 'hu' ? 'delivered_message_hu' : 'delivered_message_en';
}

// ---------------------------------------------------------------------------
// Language helpers
// ---------------------------------------------------------------------------

export type TemplateLang = 'en' | 'hu';

export function resolveTemplateLanguage(locale?: string | null): TemplateLang {
  if (!locale) return 'en';
  const lower = locale.trim().toLowerCase();
  if (lower === 'hu' || lower.startsWith('hu-') || lower.startsWith('hu_')) {
    return 'hu';
  }
  return 'en';
}

// ---------------------------------------------------------------------------
// Quick reply matching
// ---------------------------------------------------------------------------

const POSITIVE_PATTERNS_EN = [
  'yes, help me',
  'yes help me',
  'yes',
  'help me',
  'yes please',
];

const POSITIVE_PATTERNS_HU = [
  'igen, kérem',
  'igen kérem',
  'igen',
  'kérem',
];

const NEGATIVE_PATTERNS_EN = [
  'no thanks',
  'no, thanks',
  'no thank you',
  'no',
];

const NEGATIVE_PATTERNS_HU = [
  'nem, köszönöm',
  'nem köszönöm',
  'nem',
  'köszönöm, nem',
];

function normalizeReplyText(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!?]+$/g, '');
}

export function isPositiveReply(text: string): boolean {
  const normalized = normalizeReplyText(text);
  return [...POSITIVE_PATTERNS_EN, ...POSITIVE_PATTERNS_HU].some(
    (pattern) => normalized === pattern
  );
}

export function isNegativeReply(text: string): boolean {
  const normalized = normalizeReplyText(text);
  return [...NEGATIVE_PATTERNS_EN, ...NEGATIVE_PATTERNS_HU].some(
    (pattern) => normalized === pattern
  );
}

// ---------------------------------------------------------------------------
// Product list message builder
// ---------------------------------------------------------------------------

export function buildProductListMessage(
  productNames: string[],
  lang: TemplateLang
): string {
  const numbered = productNames.length > 0
    ? productNames.map((name, i) => `${i + 1}. ${name}`).join('\n')
    : lang === 'hu' ? '(nincs termékinfo)' : '(no product info available)';

  if (lang === 'hu') {
    return (
      'Köszönöm. Segítek a rendelésedben lévő termékek használatában.\n\n' +
      'A következő termékeket vásároltad:\n' +
      numbered +
      '\n\nMelyik termékkel kapcsolatban szeretnél először segítséget?'
    );
  }
  return (
    'Thanks. I can help you with the products in your order.\n\n' +
    'You purchased:\n' +
    numbered +
    '\n\nWhich product would you like help with first?'
  );
}

function buildNegativeCloseMessage(lang: TemplateLang): string {
  if (lang === 'hu') {
    return 'Semmi gond. Ha később segítségre van szükséged, írj nekünk itt.';
  }
  return 'No problem. If you need help later, just send us a message here.';
}

// ---------------------------------------------------------------------------
// Send delivery template
// ---------------------------------------------------------------------------

export interface SendDeliveryTemplateInput {
  merchantId: string;
  userId: string;
  orderId: string;
  customerPhone: string;
  customerFirstName: string;
  locale?: string | null;
  items: Array<{ external_product_id?: string; name: string }>;
}

export async function sendDeliveryTemplate(
  input: SendDeliveryTemplateInput
): Promise<{ sent: boolean; reason?: string }> {
  const {
    merchantId,
    userId,
    orderId,
    customerPhone,
    customerFirstName,
    locale,
    items,
  } = input;

  if (!customerPhone) {
    logger.info({ orderId, merchantId }, '[delivery-template] No phone, skipping');
    return { sent: false, reason: 'no_phone' };
  }

  const serviceClient = getSupabaseServiceClient();

  // Guard: opt-in
  const { data: user } = await serviceClient
    .from('users')
    .select('consent_status')
    .eq('id', userId)
    .eq('merchant_id', merchantId)
    .single();

  if (user?.consent_status !== 'opt_in') {
    logger.info({ orderId, userId, consent: user?.consent_status }, '[delivery-template] No opt-in, skipping');
    return { sent: false, reason: 'no_opt_in' };
  }

  // Guard: dedup — UNIQUE(merchant_id, order_id) will reject, but check first to avoid noisy errors
  const { data: existing } = await serviceClient
    .from('delivery_template_events')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('order_id', orderId)
    .maybeSingle();

  if (existing) {
    logger.info({ orderId, merchantId }, '[delivery-template] Already sent for this order, skipping');
    return { sent: false, reason: 'already_sent' };
  }

  // Guard: active 24h window — if we recently sent any outbound to this phone, skip template
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentOutbound } = await serviceClient
    .from('delivery_template_events')
    .select('id')
    .eq('to_phone', customerPhone)
    .eq('merchant_id', merchantId)
    .eq('reply_status', 'pending')
    .gte('template_sent_at', twentyFourHoursAgo)
    .limit(1)
    .maybeSingle();

  if (recentOutbound) {
    logger.info({ orderId, merchantId }, '[delivery-template] Active template window exists, skipping');
    return { sent: false, reason: 'active_window' };
  }

  // Resolve credentials — must be Twilio for template sends
  const credentials = await getEffectiveWhatsAppCredentials(merchantId);
  if (!credentials || credentials.provider !== 'twilio') {
    logger.warn({ orderId, merchantId, provider: credentials?.provider }, '[delivery-template] Twilio credentials required for template sends');
    return { sent: false, reason: 'not_twilio' };
  }

  const lang = resolveTemplateLanguage(locale);
  const contentSid = getContentSid(lang);
  const templateName = getTemplateName(lang);
  const windowEnd = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Record BEFORE sending so we always have a dedup record, even if the process crashes after send
  const { data: inserted, error: insertError } = await serviceClient
    .from('delivery_template_events')
    .insert({
      merchant_id: merchantId,
      user_id: userId,
      order_id: orderId,
      to_phone: customerPhone,
      template_name: templateName,
      template_language: lang,
      provider_message_id: null,
      conversation_window_open_until: windowEnd,
      reply_status: 'pending',
      support_status: 'template_sent',
    })
    .select('id')
    .single();

  if (insertError) {
    if ((insertError as any).code === '23505') {
      logger.info({ orderId, merchantId }, '[delivery-template] Duplicate insert caught');
      return { sent: false, reason: 'already_sent' };
    }
    logger.error({ insertError, orderId, merchantId }, '[delivery-template] Failed to record template event');
    return { sent: false, reason: 'db_insert_failed' };
  }

  const eventId = inserted.id;

  const sendResult = await sendTwilioWhatsAppTemplate({
    to: customerPhone,
    contentSid,
    contentVariables: { '1': customerFirstName || (lang === 'hu' ? 'Kedves Vásárló' : 'Valued Customer') },
    credentials: credentials as TwilioWhatsAppCredentials,
  });

  if (!sendResult.success) {
    logger.error({ orderId, merchantId, error: sendResult.error }, '[delivery-template] Template send failed');
    await serviceClient
      .from('delivery_template_events')
      .update({ reply_status: 'error', support_status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', eventId);
    return { sent: false, reason: 'send_failed' };
  }

  // Update with provider message ID and mark as awaiting reply
  await serviceClient
    .from('delivery_template_events')
    .update({
      provider_message_id: sendResult.messageId || null,
      support_status: 'awaiting_reply',
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId);

  if (items.length === 0) {
    logger.warn({ orderId, merchantId }, '[delivery-template] Template sent but order has no line items');
  }

  logger.info(
    { orderId, merchantId, templateName, lang, messageId: sendResult.messageId },
    '[delivery-template] Template sent successfully'
  );

  return { sent: true };
}

// ---------------------------------------------------------------------------
// Handle inbound reply to delivery template
// ---------------------------------------------------------------------------

export interface DeliveryTemplateEvent {
  id: string;
  merchant_id: string;
  user_id: string;
  order_id: string;
  to_phone: string;
  template_name: string;
  template_language: string;
  reply_status: string;
  support_status: string;
  conversation_window_open_until: string | null;
}

/**
 * Find a pending delivery template event for a given user+merchant.
 */
export async function findPendingTemplateEvent(
  userId: string,
  merchantId: string
): Promise<DeliveryTemplateEvent | null> {
  const serviceClient = getSupabaseServiceClient();
  const { data } = await serviceClient
    .from('delivery_template_events')
    .select('id, merchant_id, user_id, order_id, to_phone, template_name, template_language, reply_status, support_status, conversation_window_open_until')
    .eq('user_id', userId)
    .eq('merchant_id', merchantId)
    .in('reply_status', ['pending'])
    .order('template_sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  // Check if the 24h window has expired
  const windowEnd = data.conversation_window_open_until;
  if (windowEnd && new Date(windowEnd) < new Date()) {
    await serviceClient
      .from('delivery_template_events')
      .update({ reply_status: 'expired', support_status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', data.id);
    return null;
  }

  return data as DeliveryTemplateEvent;
}

export type TemplateReplyResult =
  | { handled: true; action: 'positive' | 'negative' }
  | { handled: false };

/**
 * Handle a quick reply to a delivery template.
 * Returns { handled: true } if the message was consumed, false if it should fall through to AI.
 */
export async function handleDeliveryTemplateReply(params: {
  templateEvent: DeliveryTemplateEvent;
  messageText: string;
  conversationId: string;
  credentials: WhatsAppCredentials;
  inboundEventId: string;
}): Promise<TemplateReplyResult> {
  const { templateEvent, messageText, conversationId, credentials, inboundEventId } = params;
  const serviceClient = getSupabaseServiceClient();
  const lang = templateEvent.template_language as TemplateLang;
  const nowIso = new Date().toISOString();

  if (isPositiveReply(messageText)) {
    // Fetch order products from external_events payload
    const productNames = await getOrderProductNames(templateEvent.order_id, templateEvent.merchant_id);

    const listMessage = buildProductListMessage(productNames, lang);

    // Send product list as free-form message
    const sendResult = await sendTrackedWhatsAppMessage({
      merchantId: templateEvent.merchant_id,
      inboundEventId,
      conversationId,
      userId: templateEvent.user_id,
      to: templateEvent.to_phone,
      text: listMessage,
      previewUrl: false,
      messageKind: 'delivery_template_followup',
      credentials,
    });

    if (!sendResult.success) {
      logger.error(
        { error: sendResult.error, orderId: templateEvent.order_id },
        '[delivery-template] Failed to send product list follow-up'
      );
    }

    // Update template event state
    await serviceClient
      .from('delivery_template_events')
      .update({
        reply_status: 'positive',
        reply_received_at: nowIso,
        support_status: 'product_list_sent',
        updated_at: nowIso,
      })
      .eq('id', templateEvent.id);

    return { handled: true, action: 'positive' };
  }

  if (isNegativeReply(messageText)) {
    const closeMessage = buildNegativeCloseMessage(lang);

    await sendTrackedWhatsAppMessage({
      merchantId: templateEvent.merchant_id,
      inboundEventId,
      conversationId,
      userId: templateEvent.user_id,
      to: templateEvent.to_phone,
      text: closeMessage,
      previewUrl: false,
      messageKind: 'delivery_template_followup',
      credentials,
    });

    await serviceClient
      .from('delivery_template_events')
      .update({
        reply_status: 'negative',
        reply_received_at: nowIso,
        support_status: 'closed',
        updated_at: nowIso,
      })
      .eq('id', templateEvent.id);

    return { handled: true, action: 'negative' };
  }

  // Not a recognized quick reply — fall through to normal AI flow
  return { handled: false };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrderProductNames(orderId: string, merchantId: string): Promise<string[]> {
  const serviceClient = getSupabaseServiceClient();

  // Look up the order to get external_order_id
  const { data: order } = await serviceClient
    .from('orders')
    .select('external_order_id')
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .single();

  if (!order?.external_order_id) return [];

  // Query external_events filtered by external_order_id inside JSONB payload
  const { data: events } = await serviceClient
    .from('external_events')
    .select('payload')
    .eq('merchant_id', merchantId)
    .contains('payload', { external_order_id: order.external_order_id } as any)
    .order('received_at', { ascending: false })
    .limit(5);

  if (!events || events.length === 0) return [];

  for (const evt of events) {
    const payload = evt.payload as any;
    if (Array.isArray(payload?.items)) {
      const names = payload.items
        .map((item: any) => (typeof item.name === 'string' ? item.name.trim() : ''))
        .filter(Boolean);
      if (names.length > 0) return names;
    }
  }

  return [];
}
