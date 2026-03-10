/**
 * Webhook Endpoints Integration Tests
 * Tests for webhook endpoints (Shopify, generic, WhatsApp)
 */

// IMPORTANT: Import middleware mocks BEFORE importing routes
import './middleware-mocks';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import webhookRoutes from '../../routes/webhooks';
import { getSupabaseServiceClient } from '@recete/shared';
import { mockSupabaseClient } from '../mocks';
import { createTestIntegration, createTestShopifyEvent } from '../fixtures';
import { testRequest } from './setup';
import * as crypto from 'crypto';
import { addCommerceEventJob } from '../../queues';

// Mock dependencies
vi.mock('@recete/shared', async () => {
  const actual = await vi.importActual('@recete/shared');
  return {
    ...actual,
    getSupabaseServiceClient: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('../../queues', () => ({
  addCommerceEventJob: vi.fn(),
}));

describe('POST /webhooks/commerce/shopify', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/webhooks', webhookRoutes);
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
    (addCommerceEventJob as any).mockResolvedValue({ id: 'job-123' });
  });

  it('should verify HMAC and process Shopify webhook', async () => {
    const integration = createTestIntegration('test-merchant-id');
    const shopifyEvent = createTestShopifyEvent();
    const rawBody = JSON.stringify(shopifyEvent);
    const secret = process.env.SHOPIFY_API_SECRET || 'test-secret';
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64');

    // Mock: find integration by provider/status/shop
    const integrationBuilder = mockSupabaseClient.from('integrations');
    const selectBuilder = {
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    };
    integrationBuilder.select = vi.fn().mockReturnValue(selectBuilder);
    selectBuilder.eq = vi.fn()
      .mockReturnValueOnce(selectBuilder)
      .mockReturnValueOnce(selectBuilder);
    selectBuilder.contains = vi.fn().mockReturnValue(selectBuilder);
    selectBuilder.maybeSingle = vi.fn().mockResolvedValue({
      data: integration,
      error: null,
    });

    // Mock: insert external event
    const eventBuilder = mockSupabaseClient.from('external_events');
    eventBuilder.insert.mockReturnValue(eventBuilder);
    eventBuilder.select.mockReturnValue(eventBuilder);
    eventBuilder.single.mockResolvedValue({
      data: {
        id: 'event-id',
        merchant_id: 'test-merchant-id',
        integration_id: integration.id,
        source: 'shopify',
        event_type: 'order_created',
      },
      error: null,
    });

    const response = await testRequest(app, 'POST', '/webhooks/commerce/shopify', {
      body: shopifyEvent,
      headers: {
        'x-shopify-shop-domain': 'test-shop.myshopify.com',
        'x-shopify-topic': 'orders/create',
        'x-shopify-hmac-sha256': hmac,
      },
    });

    // Should process webhook successfully
    expect(response.status).toBe(200);
    expect(addCommerceEventJob).toHaveBeenCalled();
  });

  it('should reject webhook with invalid HMAC', async () => {
    const shopifyEvent = createTestShopifyEvent();
    const invalidHmac = 'invalid-hmac';

    const response = await testRequest(app, 'POST', '/webhooks/commerce/shopify', {
      body: shopifyEvent,
      headers: {
        'x-shopify-shop-domain': 'test-shop.myshopify.com',
        'x-shopify-topic': 'orders/create',
        'x-shopify-hmac-sha256': invalidHmac,
      },
    });

    expect(response.status).toBe(401);
    expect(response.data).toHaveProperty('error');
  });

  it('should reject webhook with missing headers', async () => {
    const shopifyEvent = createTestShopifyEvent();

    const response = await testRequest(app, 'POST', '/webhooks/commerce/shopify', {
      body: shopifyEvent,
      headers: {
        // Missing required headers
      },
    });

    expect(response.status).toBe(400);
    expect(response.data).toHaveProperty('error');
  });

  it('should ignore opt-out customers and return 200 without storing event', async () => {
    const integration = createTestIntegration('test-merchant-id');
    const shopifyEvent = createTestShopifyEvent({
      customer: {
        id: 999,
        email: 'customer@example.com',
        phone: '+905551112233',
        buyer_accepts_marketing: false,
        sms_marketing_consent: {
          state: 'not_subscribed',
        },
      },
    });
    const rawBody = JSON.stringify(shopifyEvent);
    const secret = process.env.SHOPIFY_API_SECRET || 'test-secret';
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64');

    const integrationBuilder = mockSupabaseClient.from('integrations');
    const selectBuilder = {
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    };
    integrationBuilder.select = vi.fn().mockReturnValue(selectBuilder);
    selectBuilder.eq = vi.fn()
      .mockReturnValueOnce(selectBuilder)
      .mockReturnValueOnce(selectBuilder);
    selectBuilder.contains = vi.fn().mockReturnValue(selectBuilder);
    selectBuilder.maybeSingle = vi.fn().mockResolvedValue({
      data: integration,
      error: null,
    });

    const response = await testRequest(app, 'POST', '/webhooks/commerce/shopify', {
      body: shopifyEvent,
      headers: {
        'x-shopify-shop-domain': 'test-shop.myshopify.com',
        'x-shopify-topic': 'orders/create',
        'x-shopify-hmac-sha256': hmac,
      },
    });

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ ignored: true });
    expect(mockSupabaseClient.from('external_events').insert).not.toHaveBeenCalled();
    expect(addCommerceEventJob).not.toHaveBeenCalled();
  });
});
