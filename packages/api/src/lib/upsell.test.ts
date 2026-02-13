/**
 * Upsell Tests
 * Tests for upsell detection and generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectSatisfaction,
  generateUpsell,
  checkEligibility,
  shouldSendUpsell,
} from './upsell';
import { getSupabaseServiceClient } from '@glowguide/shared';
import { mockSupabaseClient } from '../test/mocks';
import { createTestOrder, createTestUser } from '../test/fixtures';

// Mock dependencies
vi.mock('@glowguide/shared', async () => {
  const actual = await vi.importActual('@glowguide/shared');
  return {
    ...actual,
    getSupabaseServiceClient: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('detectSatisfaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
  });

  it('should detect positive sentiment', async () => {
    const positiveMessages = [
      'Great product, thank you!',
      'I love it!',
      'Perfect, exactly what I needed',
    ];

    for (const message of positiveMessages) {
      const result = await detectSatisfaction(message);
      expect(result.satisfied).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    }
  });

  it('should detect negative sentiment', async () => {
    const negativeMessages = [
      'This product is terrible',
      'I hate this',
      'Not satisfied at all',
    ];

    for (const message of negativeMessages) {
      const result = await detectSatisfaction(message);
      expect(result.satisfied).toBe(false);
    }
  });

  it('should handle neutral messages', async () => {
    const neutralMessages = [
      'Hello',
      'What is the size?',
      'Thank you',
    ];

    for (const message of neutralMessages) {
      const result = await detectSatisfaction(message);
      // Neutral messages may not trigger satisfaction
      expect(result).toBeDefined();
    }
  });
});

describe('checkEligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
  });

  it('should check T+14 timing requirement', async () => {
    const merchantId = 'test-merchant-id';
    const userId = 'test-user-id';
    const order = createTestOrder(merchantId, userId, {
      delivery_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
    });

    const usersQ = mockSupabaseClient.from('users') as any;
    usersQ.__pushResult({ data: { consent_status: 'opt_in' }, error: null });
    const tasksQ = mockSupabaseClient.from('scheduled_tasks') as any;
    tasksQ.__pushResult({ data: null, error: { code: 'PGRST116' } });
    const ordersQ = mockSupabaseClient.from('orders') as any;
    ordersQ.__pushResult({ data: { status: 'delivered', delivery_date: order.delivery_date }, error: null });

    const eligible = await checkEligibility(merchantId, userId, order.id);

    expect(eligible).toBe(true); // 15 days > 14 days
  });

  it('should reject if too soon (T+7)', async () => {
    const merchantId = 'test-merchant-id';
    const userId = 'test-user-id';
    const order = createTestOrder(merchantId, userId, {
      delivery_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    });

    const usersQ = mockSupabaseClient.from('users') as any;
    usersQ.__pushResult({ data: { consent_status: 'opt_in' }, error: null });
    const tasksQ = mockSupabaseClient.from('scheduled_tasks') as any;
    tasksQ.__pushResult({ data: null, error: { code: 'PGRST116' } });
    const ordersQ = mockSupabaseClient.from('orders') as any;
    ordersQ.__pushResult({ data: { status: 'delivered', delivery_date: order.delivery_date }, error: null });

    const eligible = await checkEligibility(merchantId, userId, order.id);

    expect(eligible).toBe(false); // 7 days < 14 days
  });

  it('should check if upsell already sent', async () => {
    const merchantId = 'test-merchant-id';
    const userId = 'test-user-id';
    const order = createTestOrder(merchantId, userId, {
      delivery_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const usersQ = mockSupabaseClient.from('users') as any;
    usersQ.__pushResult({ data: { consent_status: 'opt_in' }, error: null });
    const tasksQ = mockSupabaseClient.from('scheduled_tasks') as any;
    tasksQ.__pushResult({ data: { id: 'task-id' }, error: null }); // already sent
    const ordersQ = mockSupabaseClient.from('orders') as any;
    ordersQ.__pushResult({ data: { status: 'delivered', delivery_date: order.delivery_date }, error: null });

    const eligible = await checkEligibility(merchantId, userId, order.id);

    expect(eligible).toBe(false); // Upsell already sent
  });
});

describe('generateUpsell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
  });

  it('should generate upsell message', async () => {
    const merchantId = 'test-merchant-id';
    const userId = 'test-user-id';
    const order = createTestOrder(merchantId, userId, {
      delivery_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const usersQ = mockSupabaseClient.from('users') as any;
    usersQ.__pushResult({ data: { consent_status: 'opt_in' }, error: null });
    const tasksQ = mockSupabaseClient.from('scheduled_tasks') as any;
    tasksQ.__pushResult({ data: null, error: { code: 'PGRST116' } });
    const ordersQ = mockSupabaseClient.from('orders') as any;
    ordersQ.__pushResult({ data: { status: 'delivered', delivery_date: order.delivery_date }, error: null });
    const productsQ = mockSupabaseClient.from('products') as any;
    productsQ.__pushResult({
      data: [
        { id: 'p1', name: 'Prod 1', url: 'https://example.com/p1' },
        { id: 'p2', name: 'Prod 2', url: 'https://example.com/p2' },
      ],
      error: null,
    });
    const merchantsQ = mockSupabaseClient.from('merchants') as any;
    merchantsQ.__pushResult({ data: { name: 'Test Merchant', persona_settings: {} }, error: null });

    const upsell = await generateUpsell(merchantId, userId, order.id);

    expect(upsell).toBeDefined();
    expect(upsell.message).toBeDefined();
    expect(upsell.message.length).toBeGreaterThan(0);
  });

  it('should include product recommendations', async () => {
    const merchantId = 'test-merchant-id';
    const userId = 'test-user-id';
    const order = createTestOrder(merchantId, userId, {
      delivery_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const usersQ = mockSupabaseClient.from('users') as any;
    usersQ.__pushResult({ data: { consent_status: 'opt_in' }, error: null });
    const tasksQ = mockSupabaseClient.from('scheduled_tasks') as any;
    tasksQ.__pushResult({ data: null, error: { code: 'PGRST116' } });
    const ordersQ = mockSupabaseClient.from('orders') as any;
    ordersQ.__pushResult({ data: { status: 'delivered', delivery_date: order.delivery_date }, error: null });
    const productsQ = mockSupabaseClient.from('products') as any;
    productsQ.__pushResult({
      data: [{ id: 'p1', name: 'Prod 1', url: 'https://example.com/p1' }],
      error: null,
    });
    const merchantsQ = mockSupabaseClient.from('merchants') as any;
    merchantsQ.__pushResult({ data: { name: 'Test Merchant', persona_settings: {} }, error: null });

    const upsell = await generateUpsell(merchantId, userId, order.id);

    // Should include product recommendations if available
    expect(upsell).toBeDefined();
    expect(upsell.recommendations.length).toBeGreaterThan(0);
  });
});

describe('shouldSendUpsell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
  });

  it('should return true when all conditions met', async () => {
    const merchantId = 'test-merchant-id';
    const userId = 'test-user-id';
    const order = createTestOrder(merchantId, userId, {
      delivery_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const usersQ = mockSupabaseClient.from('users') as any;
    usersQ.__pushResult({ data: { consent_status: 'opt_in' }, error: null });
    const tasksQ = mockSupabaseClient.from('scheduled_tasks') as any;
    tasksQ.__pushResult({ data: null, error: { code: 'PGRST116' } });
    const ordersQ = mockSupabaseClient.from('orders') as any;
    ordersQ.__pushResult({ data: { status: 'delivered', delivery_date: order.delivery_date }, error: null });

    const shouldSend = await shouldSendUpsell(merchantId, userId, order.id, 'Great product!');

    expect(shouldSend).toBe(true);
  });

  it('should return false if not satisfied', async () => {
    const merchantId = 'test-merchant-id';
    const userId = 'test-user-id';
    const order = createTestOrder(merchantId, userId);

    const usersQ = mockSupabaseClient.from('users') as any;
    usersQ.__pushResult({ data: { consent_status: 'opt_in' }, error: null });
    const tasksQ = mockSupabaseClient.from('scheduled_tasks') as any;
    tasksQ.__pushResult({ data: null, error: { code: 'PGRST116' } });
    const ordersQ = mockSupabaseClient.from('orders') as any;
    ordersQ.__pushResult({ data: { status: 'delivered', delivery_date: order.delivery_date }, error: null });

    const shouldSend = await shouldSendUpsell(merchantId, userId, order.id, 'Terrible product!');

    expect(shouldSend).toBe(false);
  });

  it('should return false if too soon', async () => {
    const merchantId = 'test-merchant-id';
    const userId = 'test-user-id';
    const order = createTestOrder(merchantId, userId, {
      delivery_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const usersQ = mockSupabaseClient.from('users') as any;
    usersQ.__pushResult({ data: { consent_status: 'opt_in' }, error: null });
    const tasksQ = mockSupabaseClient.from('scheduled_tasks') as any;
    tasksQ.__pushResult({ data: null, error: { code: 'PGRST116' } });
    const ordersQ = mockSupabaseClient.from('orders') as any;
    ordersQ.__pushResult({ data: { status: 'delivered', delivery_date: order.delivery_date }, error: null });

    const shouldSend = await shouldSendUpsell(merchantId, userId, order.id, 'Great product!');

    expect(shouldSend).toBe(false);
  });
});
