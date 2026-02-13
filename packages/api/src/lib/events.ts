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
  };
  order?: {
    status: string;
    created_at?: string;
    delivered_at?: string;
  };
  items?: Array<{
    external_product_id?: string;
    name: string;
    url?: string;
  }>;
  consent_status?: string;
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

    // Map topic to event type
    const eventTypeMap: Record<string, string> = {
      'orders/create': 'order_created',
      'orders/fulfilled': 'order_delivered',
      'orders/updated': 'order_updated',
      'orders/cancelled': 'order_cancelled',
    };

    let eventType = eventTypeMap[topic] || 'order_updated';

    // orders/updated: treat as order_delivered when order is fulfilled (GDPR-aware trigger)
    if (topic === 'orders/updated') {
      const fulfillmentStatus = (order.fulfillment_status || '').toLowerCase();
      const hasFulfillments = Array.isArray(order.fulfillments) && order.fulfillments.length > 0;
      const fulfilledSuccess = hasFulfillments && order.fulfillments.some((f: any) => (f.status || '').toString() === 'success');
      if (fulfillmentStatus === 'fulfilled' || fulfilledSuccess) {
        eventType = 'order_delivered';
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
    if (order.shipping_address) {
      const firstName = order.shipping_address.first_name || '';
      const lastName = order.shipping_address.last_name || '';
      customerName = `${firstName} ${lastName}`.trim() || undefined;
    } else if (order.customer) {
      const firstName = order.customer.first_name || '';
      const lastName = order.customer.last_name || '';
      customerName = `${firstName} ${lastName}`.trim() || undefined;
    }

    // Extract delivery date (from fulfillments)
    let deliveredAt: string | undefined;
    if (eventType === 'order_delivered' && order.fulfillments && order.fulfillments.length > 0) {
      const fulfilled = order.fulfillments.find((f: any) => (f.status || '').toString() === 'success');
      if (fulfilled?.updated_at) {
        deliveredAt = fulfilled.updated_at;
      } else if (order.updated_at) {
        deliveredAt = order.updated_at;
      }
    }

    // Extract marketing consent (GDPR/KVKK): Shopify customer.email_marketing_consent / sms_marketing_consent
    let consent_status: 'opt_in' | 'opt_out' | 'pending' = 'pending';
    const customer = order.customer;
    if (customer) {
      const emailState = (customer.email_marketing_consent?.state || '').toLowerCase();
      const smsState = (customer.sms_marketing_consent?.state || '').toLowerCase();
      if (emailState === 'subscribed' || smsState === 'subscribed') {
        consent_status = 'opt_in';
      } else if (emailState === 'not_subscribed' || smsState === 'not_subscribed') {
        consent_status = 'opt_out';
      }
    }

    // Extract line items
    const items = (order.line_items || []).map((item: any) => ({
      external_product_id: item.product_id?.toString(),
      name: item.name || item.title || 'Unknown Product',
      url: item.product_exists
        ? `https://${order.shop || ''}/products/${item.product_id}`
        : undefined,
    }));

    return {
      merchant_id: merchantId,
      integration_id: integrationId,
      source: 'shopify',
      event_type: eventType,
      occurred_at: order.updated_at || order.created_at || new Date().toISOString(),
      external_order_id: order.name || order.id?.toString() || `shopify-${order.id}`,
      customer: phone || customerName ? { phone, name: customerName } : undefined,
      order: {
        status: order.financial_status || order.fulfillment_status || 'unknown',
        created_at: order.created_at,
        delivered_at: deliveredAt,
      },
      items: items.length > 0 ? items : undefined,
      consent_status,
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
