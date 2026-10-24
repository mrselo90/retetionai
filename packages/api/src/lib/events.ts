/**
 * Event normalization utilities
 * Converts platform-specific events to normalized format
 */

import * as crypto from 'crypto';

export interface NormalizedEvent {
  merchant_id: string;
  integration_id?: string;
  source: string;
  event_type: string;
  occurred_at: string;
  external_order_id: string;
  customer?: {
    phone?: string;
    name?: string;
    email?: string;
    shopify_customer_id?: string;
  };
  order?: {
    status: string;
    created_at?: string;
    /** Handed to the carrier (orders/fulfilled). */
    shipped_at?: string;
    delivered_at?: string;
    /** carrier: a delivered fulfillment event; estimated: no carrier report by the fallback (deliveryTiming.ts). */
    delivery_source?: 'carrier' | 'estimated';
  };
  items?: Array<{
    external_product_id?: string;
    name: string;
    url?: string;
  }>;
  consent_status?: string;
  customer_locale?: string;
}

/**
 * Generate idempotency key
 * Format: source + event_type + external_order_id + occurred_at (or event_id)
 */
export function generateIdempotencyKey(
  source: string,
  eventType: string,
  externalOrderId: string,
  occurredAt: string,
  eventId?: string
): string {
  const base = `${source}:${eventType}:${externalOrderId}:${occurredAt}`;
  if (eventId) {
    return crypto.createHash('sha256').update(`${base}:${eventId}`).digest('hex');
  }
  return crypto.createHash('sha256').update(base).digest('hex');
}

/**
 * Normalize Shopify order event
 */
export function normalizeShopifyEvent(
  merchantId: string,
  integrationId: string,
  shopifyEvent: any,
  topic: string
): NormalizedEvent | null {
  try {
    const order = shopifyEvent;
    if (!order || !order.id) {
      return null;
    }

    // Map topic to event type. orders/fulfilled means handed to the carrier,
    // not delivered: delivery comes from a fulfillment event or the fallback
    // (deliveryTiming.ts).
    const eventTypeMap: Record<string, string> = {
      'orders/create': 'order_created',
      'orders/fulfilled': 'order_shipped',
      'orders/updated': 'order_updated',
      'orders/cancelled': 'order_cancelled',
    };

    let eventType = eventTypeMap[topic] || 'order_updated';

    // orders/updated: a fulfilled order has shipped
    if (topic === 'orders/updated') {
      const fulfillmentStatus = (order.fulfillment_status || '').toLowerCase();
      const hasFulfillments = Array.isArray(order.fulfillments) && order.fulfillments.length > 0;
      const fulfilledSuccess = hasFulfillments && order.fulfillments.some((f: any) => (f.status || '').toString() === 'success');
      if (fulfillmentStatus === 'fulfilled' || fulfilledSuccess) {
        eventType = 'order_shipped';
      }
    }

    // Extract customer phone (priority: shipping > billing > customer)
    let phone: string | undefined;
    if (order.shipping_address?.phone) {
      try {
        phone = normalizePhone(order.shipping_address.phone);
      } catch {
        phone = undefined;
      }
    } else if (order.billing_address?.phone) {
      try {
        phone = normalizePhone(order.billing_address.phone);
      } catch {
        phone = undefined;
      }
    } else if (order.customer?.phone) {
      try {
        phone = normalizePhone(order.customer.phone);
      } catch {
        phone = undefined;
      }
    }

    // Extract customer name
    let customerName: string | undefined;
    const customerEmail =
      typeof order.customer?.email === 'string' && order.customer.email.trim().length > 0
        ? order.customer.email.trim().toLowerCase()
        : undefined;
    const shopifyCustomerId =
      order.customer?.id !== undefined && order.customer?.id !== null
        ? String(order.customer.id)
        : undefined;
    if (order.shipping_address) {
      const firstName = order.shipping_address.first_name || '';
      const lastName = order.shipping_address.last_name || '';
      customerName = `${firstName} ${lastName}`.trim() || undefined;
    } else if (order.customer) {
      const firstName = order.customer.first_name || '';
      const lastName = order.customer.last_name || '';
      customerName = `${firstName} ${lastName}`.trim() || undefined;
    }

    // When it was handed to the carrier (from fulfillments)
    let shippedAt: string | undefined;
    if (eventType === 'order_shipped') {
      const fulfilled = (order.fulfillments || []).find((f: any) => (f.status || '').toString() === 'success');
      shippedAt = fulfilled?.created_at || fulfilled?.updated_at || order.updated_at || undefined;
    }

    // WhatsApp consent isn't derived from the order: email/SMS marketing consent
    // doesn't cover WhatsApp. processNormalizedEvent reads the customer's
    // WhatsApp marketing consent from Shopify instead (lib/whatsappConsent.ts).

    // Extract line items
    const items = (order.line_items || []).map((item: any) => ({
      external_product_id: item.product_id?.toString(),
      name: item.name || item.title || 'Unknown Product',
      url: item.product_exists
        ? `https://${order.shop || ''}/products/${item.product_id}`
        : undefined,
    }));

    const customerLocale =
      typeof order.customer_locale === 'string' && order.customer_locale.trim().length > 0
        ? order.customer_locale.trim().toLowerCase()
        : undefined;

    return {
      merchant_id: merchantId,
      integration_id: integrationId,
      source: 'shopify',
      event_type: eventType,
      occurred_at: order.updated_at || order.created_at || new Date().toISOString(),
      external_order_id: order.name || order.id?.toString() || `shopify-${order.id}`,
      customer: phone || customerName || customerEmail || shopifyCustomerId
        ? {
            phone,
            name: customerName,
            email: customerEmail,
            shopify_customer_id: shopifyCustomerId,
          }
        : undefined,
      order: {
        status: order.financial_status || order.fulfillment_status || 'unknown',
        created_at: order.created_at,
        shipped_at: shippedAt,
      },
      items: items.length > 0 ? items : undefined,
      customer_locale: customerLocale,
    };
  } catch (error) {
    console.error('Error normalizing Shopify event:', error);
    return null;
  }
}

/**
 * Normalize phone number to E.164 format (basic)
 */
export function normalizePhone(phone: string): string {
  const input = (phone || '').trim();
  if (!input) {
    throw new Error('Invalid phone');
  }

  // Remove all non-digit characters except +
  let cleaned = input.replace(/[^\d+]/g, '');

  // If starts with 0, replace with country code (Turkey: +90)
  if (cleaned.startsWith('0')) {
    cleaned = '+90' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+')) {
    // Assume Turkey if no country code
    cleaned = '+90' + cleaned;
  }

  // Basic validation: must be + and at least 10 digits afterwards
  const digits = cleaned.replace(/[^\d]/g, '');
  if (!cleaned.startsWith('+') || digits.length < 10) {
    throw new Error('Invalid phone');
  }

  return cleaned;
}
