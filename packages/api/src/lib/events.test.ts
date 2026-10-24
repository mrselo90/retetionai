
import { describe, it, expect } from 'vitest';
import { normalizeShopifyEvent } from './events.js';

describe('normalizeShopifyEvent', () => {
  const merchantId = 'test_merchant_id';
  const integrationId = 'test_integration_id';

  it('does not derive WhatsApp consent from email or SMS marketing consent', () => {
    const shopifyEvent = {
      id: 123456789,
      name: '#1001',
      created_at: '2026-10-01T10:00:00Z',
      customer: {
        id: 42,
        phone: '+447700900123',
        email_marketing_consent: { state: 'subscribed' },
        sms_marketing_consent: { state: 'subscribed' },
      },
    };

    const result = normalizeShopifyEvent(merchantId, integrationId, shopifyEvent, 'orders/create');
    // WhatsApp consent is read from Shopify when the event is processed
    // (lib/whatsappConsent.ts), not inferred from other channels.
    expect(result?.consent_status).toBeUndefined();
  });

  it('should normalize orders/updated with fulfilled status to order_shipped', () => {
    const shopifyEvent = {
      id: 123456789,
      fulfillment_status: 'fulfilled',
      updated_at: '2023-01-01T12:00:00Z',
    };

    const result = normalizeShopifyEvent(merchantId, integrationId, shopifyEvent, 'orders/updated');
    expect(result).not.toBeNull();
    // Fulfilled means handed to the carrier; delivery comes later (deliveryTiming.ts).
    expect(result?.event_type).toBe('order_shipped');
  });

  it('should normalize orders/updated with successful fulfillment to order_shipped, with when it shipped', () => {
    const shopifyEvent = {
      id: 123456789,
      fulfillment_status: 'partial', // status might not be 'fulfilled' yet on top level
      fulfillments: [
        { status: 'success', created_at: '2023-01-01T11:00:00Z', updated_at: '2023-01-01T12:00:00Z' }
      ],
      updated_at: '2023-01-01T12:00:00Z',
    };

    const result = normalizeShopifyEvent(merchantId, integrationId, shopifyEvent, 'orders/updated');
    expect(result).not.toBeNull();
    expect(result?.event_type).toBe('order_shipped');
    expect(result?.order).toMatchObject({ shipped_at: '2023-01-01T11:00:00Z' });
    expect(result?.order?.delivered_at).toBeUndefined();
  });

  it('should normalize orders/fulfilled to order_shipped and orders/cancelled to order_cancelled', () => {
    const order = { id: 1, name: '#1001', updated_at: '2023-01-01T12:00:00Z' };
    expect(normalizeShopifyEvent(merchantId, integrationId, order, 'orders/fulfilled')?.event_type).toBe('order_shipped');
    expect(normalizeShopifyEvent(merchantId, integrationId, order, 'orders/cancelled')?.event_type).toBe('order_cancelled');
  });

  it('should keep orders/updated as order_updated if not fulfilled', () => {
    const shopifyEvent = {
      id: 123456789,
      fulfillment_status: null,
      updated_at: '2023-01-01T12:00:00Z',
    };

    const result = normalizeShopifyEvent(merchantId, integrationId, shopifyEvent, 'orders/updated');
    expect(result).not.toBeNull();
    expect(result?.event_type).toBe('order_updated');
  });
});
