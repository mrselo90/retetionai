/**
 * Order Processor Tests
 * Tests for order and user processing from normalized events
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processNormalizedEvent } from './orderProcessor';
import { createTestNormalizedEvent, createTestUser, createTestOrder } from '../test/fixtures';
import { getSupabaseServiceClient } from '@recete/shared';
import { mockSupabaseClient } from '../test/mocks';

// Mock dependencies
vi.mock('@recete/shared', async () => {
  const actual = await vi.importActual('@recete/shared');
  return {
    ...actual,
    getSupabaseServiceClient: vi.fn(),
    getRedisClient: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('./messageScheduler', () => ({
  scheduleOrderMessages: vi.fn().mockResolvedValue({ tasks: [] }),
}));

describe('processNormalizedEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
  });

  it('should process order_created event', async () => {
    const merchantId = 'test-merchant-id';
    const integrationId = 'integration-id';
    const event = createTestNormalizedEvent(merchantId, integrationId, {
      event_type: 'order_created',
      customer: {
        phone: '+905551112233',
        name: 'Test Customer',
      },
    });

    const usersQ = mockSupabaseClient.from('users') as any;
    usersQ.__pushResult({ data: null, error: { code: 'PGRST116' } }); // user lookup
    usersQ.__pushResult({ data: { id: 'user-id' }, error: null }); // user insert

    const ordersQ = mockSupabaseClient.from('orders') as any;
    ordersQ.__pushResult({ data: null, error: { code: 'PGRST116' } }); // order lookup
    ordersQ.__pushResult({ data: { id: 'order-id' }, error: null }); // order insert

    const result = await processNormalizedEvent(event);

    expect(result).toBeDefined();
    expect(result.userId).toBeDefined();
    expect(result.orderId).toBeDefined();
  });

  it('should process order_delivered event', async () => {
    const merchantId = 'test-merchant-id';
    const integrationId = 'integration-id';
    const event = createTestNormalizedEvent(merchantId, integrationId, {
      event_type: 'order_delivered',
      order: {
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      },
    });

    const usersQ = mockSupabaseClient.from('users') as any;
    usersQ.__pushResult({ data: { id: 'user-id' }, error: null }); // user exists

    const ordersQ = mockSupabaseClient.from('orders') as any;
    ordersQ.__pushResult({ data: { id: 'order-id' }, error: null }); // order exists
    ordersQ.__pushResult({ data: null, error: null }); // update await

    const result = await processNormalizedEvent(event);

    expect(result).toBeDefined();
    expect(result.orderId).toBe('order-id');
  });

  it('should handle missing customer phone', async () => {
    const merchantId = 'test-merchant-id';
    const integrationId = 'integration-id';
    const event = createTestNormalizedEvent(merchantId, integrationId, {
      customer: {
        name: 'Test Customer',
        // No phone
      },
    });

    await expect(processNormalizedEvent(event)).rejects.toThrow(
      'Phone number is required to process event'
    );
  });
});
