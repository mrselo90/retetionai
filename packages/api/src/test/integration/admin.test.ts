/**
 * Admin Test Kit Integration Tests
 * Covers super-admin Shopify scenario catalog and runner endpoints.
 */

import './middleware-mocks';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import adminRoutes from '../../routes/admin';
import { getSupabaseServiceClient } from '@recete/shared';
import { mockSupabaseClient } from '../mocks';
import { testRequest } from './setup';
import { processNormalizedEvent } from '../../lib/orderProcessor';
import {
  addMessageToConversation,
  findUserByPhone,
  getConversationHistory,
  getOrCreateConversation,
} from '../../lib/conversation';
import { generateAIResponse } from '../../lib/aiAgent';

vi.mock('@recete/shared', async () => {
  const actual = await vi.importActual('@recete/shared');
  return {
    ...actual,
    getSupabaseServiceClient: vi.fn(),
    getRedisClient: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock('../../middleware/adminAuth', () => ({
  adminAuthMiddleware: vi.fn(async (_c: any, next: () => Promise<void>) => {
    await next();
  }),
}));

vi.mock('../../lib/orderProcessor', () => ({
  processNormalizedEvent: vi.fn(),
}));

vi.mock('../../lib/conversation', () => ({
  addMessageToConversation: vi.fn(),
  findUserByPhone: vi.fn(),
  getConversationHistory: vi.fn(),
  getOrCreateConversation: vi.fn(),
}));

vi.mock('../../lib/aiAgent', () => ({
  generateAIResponse: vi.fn(),
}));

describe('Admin Shopify scenario runner', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/admin', adminRoutes);
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
  });

  it('GET /api/admin/test-kit/shopify-scenarios should return scenario catalog', async () => {
    const response = await testRequest(app, 'GET', '/api/admin/test-kit/shopify-scenarios', {
      merchantId: 'super-admin-merchant',
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.scenarios)).toBe(true);
    expect(response.data.scenarios.length).toBeGreaterThan(0);
    expect(response.data.scenarios.map((s: any) => s.id)).toContain('shopify_usage_how_tr');
  });

  it('POST /api/admin/test-kit/shopify-scenarios/run should validate unknown scenario id', async () => {
    const merchantsQ = mockSupabaseClient.from('merchants') as any;
    merchantsQ.__setDefaultResult({
      data: { id: 'm-1', name: 'Merchant 1', subscription_plan: 'starter', subscription_status: 'active' },
      error: null,
    });

    const response = await testRequest(app, 'POST', '/api/admin/test-kit/shopify-scenarios/run', {
      merchantId: 'super-admin-merchant',
      body: {
        merchantId: 'm-1',
        customerPhone: '+905551112233',
        scenarioIds: ['unknown_scenario'],
      },
    });

    expect(response.status).toBe(400);
    expect(String(response.data.error || '')).toContain('Unknown scenario IDs');
  });

  it('POST /api/admin/test-kit/shopify-scenarios/run should run selected scenario and return summary', async () => {
    const merchantsQ = mockSupabaseClient.from('merchants') as any;
    merchantsQ.__setDefaultResult({
      data: { id: 'm-1', name: 'Merchant 1', subscription_plan: 'starter', subscription_status: 'active' },
      error: null,
    });

    const productsQ = mockSupabaseClient.from('products') as any;
    productsQ.__setDefaultResult({
      data: [
        {
          id: 'p-1',
          name: 'Cleansing Gel',
          external_id: 'gid://shopify/Product/1',
          url: 'https://example.com/p1',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });

    const integrationsQ = mockSupabaseClient.from('integrations') as any;
    integrationsQ.__setDefaultResult({
      data: { id: 'int-1' },
      error: null,
    });

    const ordersQ = mockSupabaseClient.from('orders') as any;
    ordersQ.__setDefaultResult({
      data: {
        id: 'order-1',
        external_order_id: 'TEST-ORDER-1',
        status: 'delivered',
        delivery_date: '2026-04-13T12:00:00.000Z',
        created_at: '2026-04-13T11:00:00.000Z',
      },
      error: null,
    });

    (processNormalizedEvent as any)
      .mockResolvedValueOnce({ orderId: 'order-1', userId: 'user-1' })
      .mockResolvedValueOnce({ orderId: 'order-1', userId: 'user-1' });

    (findUserByPhone as any).mockResolvedValue({
      userId: 'user-1',
      userName: 'Test User',
    });
    (getOrCreateConversation as any).mockResolvedValue('conv-1');
    (addMessageToConversation as any).mockResolvedValue(undefined);
    (getConversationHistory as any).mockResolvedValue([]);
    (generateAIResponse as any).mockResolvedValue({
      intent: 'question',
      response: 'Use a small amount twice daily.',
      guardrailBlocked: false,
      upsellTriggered: false,
    });

    const response = await testRequest(app, 'POST', '/api/admin/test-kit/shopify-scenarios/run', {
      merchantId: 'super-admin-merchant',
      body: {
        merchantId: 'm-1',
        customerPhone: '+905551112233',
        customerLocale: 'tr',
        productIds: ['p-1'],
        scenarioIds: ['shopify_usage_how_tr'],
      },
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('summary');
    expect(response.data.summary.total).toBe(1);
    expect(response.data.summary.failed).toBe(0);
    expect(response.data.summary.passed).toBe(1);
    expect(response.data.results[0].id).toBe('shopify_usage_how_tr');
  });

  it('GET /api/admin/pilot/diagnostics should return sanitized pilot diagnostics samples', async () => {
    const aiUsageEventsQ = mockSupabaseClient.from('ai_usage_events') as any;
    aiUsageEventsQ.__setDefaultResult({
      data: [
        {
          id: 'evt-1',
          merchant_id: 'm-1',
          created_at: '2026-04-13T10:00:00.000Z',
          metadata: {
            inferredGoal: 'build_routine',
            userMessagePreview: 'all of them',
            assistantResponsePreview: 'Morning: ...',
          },
        },
      ],
      error: null,
    });

    const response = await testRequest(app, 'GET', '/api/admin/pilot/diagnostics?merchant_id=m-1&limit=10', {
      merchantId: 'super-admin-merchant',
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.diagnostics)).toBe(true);
    expect(response.data.diagnostics[0].id).toBe('evt-1');
    expect(response.data.diagnostics[0].metadata.inferredGoal).toBe('build_routine');
  });

  it('GET /api/admin/pilot/review-template should return evaluation rubric', async () => {
    const response = await testRequest(app, 'GET', '/api/admin/pilot/review-template', {
      merchantId: 'super-admin-merchant',
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.rubric)).toBe(true);
    expect(response.data.rubric.length).toBeGreaterThan(0);
    expect(response.data).toHaveProperty('scoring');
    expect(response.data).toHaveProperty('noteTemplate');
  });
});
