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

describe('POST /webhooks/commerce/shopify', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/webhooks', webhookRoutes);
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
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

    // Mock: find integration
    // The code does: serviceClient.from('integrations').select(...).eq(...).eq(...)
    // Chain: from -> select -> eq -> eq -> (returns promise)
    const integrationBuilder = mockSupabaseClient.from('integrations');
    const selectBuilder = {
      eq: vi.fn().mockReturnThis(),
    };
    integrationBuilder.select = vi.fn().mockReturnValue(selectBuilder);
    // First eq for provider, second eq for status
    selectBuilder.eq = vi.fn()
      .mockReturnValueOnce(selectBuilder) // First eq('provider', 'shopify')
      .mockResolvedValueOnce({ // Second eq('status', 'active')
        data: [integration],
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
});
