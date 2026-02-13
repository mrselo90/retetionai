/**
 * Events Module Tests
 * Tests for event normalization and processing
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeShopifyEvent,
  generateIdempotencyKey,
  normalizePhone,
} from './events';
import { createTestShopifyEvent, createTestNormalizedEvent } from '../test/fixtures';

describe('normalizePhone', () => {
  it('should normalize phone with country code', () => {
    const normalized = normalizePhone('+905551112233');
    expect(normalized).toBe('+905551112233');
  });

  it('should add country code for Turkish numbers', () => {
    const normalized = normalizePhone('5551112233');
    expect(normalized).toBe('+905551112233');
  });

  it('should handle phone with spaces and dashes', () => {
    const normalized = normalizePhone('+90 555 111 22 33');
    expect(normalized).toBe('+905551112233');
  });

  it('should handle US phone numbers', () => {
    const normalized = normalizePhone('+1-555-123-4567');
    expect(normalized).toBe('+15551234567');
  });

  it('should throw for invalid phone', () => {
    expect(() => normalizePhone('invalid')).toThrow();
  });

  it('should throw for empty string', () => {
    expect(() => normalizePhone('')).toThrow();
  });
});

describe('normalizeShopifyEvent', () => {
  const merchantId = 'test-merchant-id';
  const integrationId = 'test-integration-id';

  it('should normalize order_created event', () => {
    const shopifyEvent = createTestShopifyEvent({
      shipping_address: { phone: '+905551112233', first_name: 'Test', last_name: 'Customer' },
    });

    const normalized = normalizeShopifyEvent(
      merchantId,
      integrationId,
      shopifyEvent,
      'orders/create'
    );

    expect(normalized).toBeDefined();
    expect(normalized?.merchant_id).toBe(merchantId);
    expect(normalized?.integration_id).toBe(integrationId);
    expect(normalized?.source).toBe('shopify');
    expect(normalized?.event_type).toBe('order_created');
    expect(normalized?.external_order_id).toBeDefined();
    expect(normalized?.customer?.phone).toBe('+905551112233');
  });

  it('should map orders/fulfilled to order_delivered', () => {
    const shopifyEvent = createTestShopifyEvent({
      fulfillments: [{ status: 'success', updated_at: new Date().toISOString() }],
      shipping_address: { phone: '+905551112233' },
    });

    const normalized = normalizeShopifyEvent(
      merchantId,
      integrationId,
      shopifyEvent,
      'orders/fulfilled'
    );

    expect(normalized).toBeDefined();
    expect(normalized?.event_type).toBe('order_delivered');
  });

  it('should extract customer phone from order', () => {
    const shopifyEvent = createTestShopifyEvent({
      shipping_address: { phone: '+905551112233' },
    });

    const normalized = normalizeShopifyEvent(
      merchantId,
      integrationId,
      shopifyEvent,
      'orders/create'
    );

    expect(normalized?.customer.phone).toBe('+905551112233');
  });

  it('should extract product information from line items', () => {
    const shopifyEvent = createTestShopifyEvent({
      line_items: [
        {
          id: 789,
          product_id: 456,
          name: 'Test Product',
          quantity: 1,
          price: '99.99',
        },
      ],
    });

    const normalized = normalizeShopifyEvent(
      merchantId,
      integrationId,
      shopifyEvent,
      'orders/create'
    );

    expect(normalized?.items).toBeDefined();
    expect(normalized?.items).toHaveLength(1);
    expect(normalized?.items[0].name).toBe('Test Product');
  });

  it('should default unknown topics to order_updated', () => {
    const shopifyEvent = createTestShopifyEvent();
    const normalized = normalizeShopifyEvent(
      merchantId,
      integrationId,
      shopifyEvent,
      'unsupported/event'
    );

    expect(normalized).toBeDefined();
    expect(normalized?.event_type).toBe('order_updated');
  });

  it('should handle missing phone number', () => {
    const shopifyEvent = createTestShopifyEvent({
      shipping_address: { phone: null },
    });

    const normalized = normalizeShopifyEvent(
      merchantId,
      integrationId,
      shopifyEvent,
      'orders/create'
    );

    // Should still normalize but without phone
    expect(normalized).toBeDefined();
    expect(normalized?.customer?.phone).toBeUndefined();
  });
});

describe('generateIdempotencyKey', () => {
  it('should generate idempotency key', () => {
    const key = generateIdempotencyKey('shopify', 'order_created', 'ORD-123', new Date().toISOString(), '123');
    
    expect(key).toBeDefined();
    expect(key).toMatch(/^[0-9a-f]{64}$/i);
  });

  it('should generate same key for same inputs', () => {
    const occurredAt = new Date().toISOString();
    const key1 = generateIdempotencyKey('shopify', 'order_created', 'ORD-123', occurredAt, '123');
    const key2 = generateIdempotencyKey('shopify', 'order_created', 'ORD-123', occurredAt, '123');
    
    expect(key1).toBe(key2);
  });

  it('should generate different keys for different inputs', () => {
    const occurredAt = new Date().toISOString();
    const key1 = generateIdempotencyKey('shopify', 'order_created', 'ORD-123', occurredAt, '123');
    const key2 = generateIdempotencyKey('shopify', 'order_created', 'ORD-124', occurredAt, '124');
    
    expect(key1).not.toBe(key2);
  });

  it('should handle missing external_id', () => {
    const key = generateIdempotencyKey('shopify', 'order_created', 'ORD-123', new Date().toISOString(), undefined);
    
    expect(key).toBeDefined();
    expect(key).toMatch(/^[0-9a-f]{64}$/i);
  });
});
