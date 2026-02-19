
import { describe, it, expect } from 'vitest';
import { normalizeShopifyEvent } from './events.js';

describe('normalizeShopifyEvent', () => {
  const merchantId = 'test_merchant_id';
  const integrationId = 'test_integration_id';

  it('should normalize email_marketing_consent to opt_in', () => {
    const shopifyEvent = {
      id: 123456789,
      customer: {
        id: 987654321,
        email_marketing_consent: {
          state: 'subscribed',
        },
      },
    };

    const result = normalizeShopifyEvent(merchantId, integrationId, shopifyEvent, 'orders/create');
    expect(result).not.toBeNull();
    expect(result?.consent_status).toBe('opt_in');
  });

  it('should normalize sms_marketing_consent to opt_in', () => {
    const shopifyEvent = {
      id: 123456789,
      customer: {
        id: 987654321,
        sms_marketing_consent: {
          state: 'subscribed',
        },
      },
    };

    const result = normalizeShopifyEvent(merchantId, integrationId, shopifyEvent, 'orders/create');
    expect(result).not.toBeNull();
    expect(result?.consent_status).toBe('opt_in');
  });

  it('should normalize not_subscribed to opt_out', () => {
    const shopifyEvent = {
      id: 123456789,
      customer: {
        id: 987654321,
        email_marketing_consent: {
          state: 'not_subscribed',
        },
      },
    };

    const result = normalizeShopifyEvent(merchantId, integrationId, shopifyEvent, 'orders/create');
    expect(result).not.toBeNull();
    expect(result?.consent_status).toBe('opt_out');
  });

  it('should normalize orders/updated with fulfilled status to order_delivered', () => {
    const shopifyEvent = {
      id: 123456789,
      fulfillment_status: 'fulfilled',
      updated_at: '2023-01-01T12:00:00Z',
    };

    const result = normalizeShopifyEvent(merchantId, integrationId, shopifyEvent, 'orders/updated');
    expect(result).not.toBeNull();
    expect(result?.event_type).toBe('order_delivered');
  });

  it('should normalize orders/updated with successful fulfillment to order_delivered', () => {
    const shopifyEvent = {
      id: 123456789,
      fulfillment_status: 'partial', // status might not be 'fulfilled' yet on top level
      fulfillments: [
        { status: 'success', updated_at: '2023-01-01T12:00:00Z' }
      ],
      updated_at: '2023-01-01T12:00:00Z',
    };

    const result = normalizeShopifyEvent(merchantId, integrationId, shopifyEvent, 'orders/updated');
    expect(result).not.toBeNull();
    expect(result?.event_type).toBe('order_delivered');
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
