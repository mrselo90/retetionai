/**
 * Usage Tracking Tests
 * Tests for usage tracking functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  incrementApiCallCount,
  incrementMessageCount,
  getCurrentUsage,
  resetUsage,
} from './usageTracking';
import { getSupabaseServiceClient, getRedisClient } from '@glowguide/shared';
import { mockSupabaseClient, mockRedisClient } from '../test/mocks';

// Mock dependencies
vi.mock('@glowguide/shared', async () => {
  const actual = await vi.importActual('@glowguide/shared');
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

describe('incrementApiCallCount', () => {
  let rpc: any;
  beforeEach(() => {
    vi.clearAllMocks();
    rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    (getSupabaseServiceClient as any).mockReturnValue({ rpc });
    (getRedisClient as any).mockReturnValue(mockRedisClient); // for cache invalidation
  });

  it('should increment API call count', async () => {
    const merchantId = 'test-merchant-id';

    await incrementApiCallCount(merchantId);

    expect(rpc).toHaveBeenCalledWith(
      'increment_usage',
      expect.objectContaining({ merchant_uuid: merchantId, api_calls_count: 1 })
    );
  });

  it('should handle Redis errors gracefully', async () => {
    const merchantId = 'test-merchant-id';
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    // Should not throw
    await expect(incrementApiCallCount(merchantId)).resolves.not.toThrow();
  });
});

describe('incrementMessageCount', () => {
  let rpc: any;
  beforeEach(() => {
    vi.clearAllMocks();
    rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    (getSupabaseServiceClient as any).mockReturnValue({ rpc });
  });

  it('should increment message count', async () => {
    const merchantId = 'test-merchant-id';

    await incrementMessageCount(merchantId);

    expect(rpc).toHaveBeenCalledWith(
      'increment_usage',
      expect.objectContaining({ merchant_uuid: merchantId, messages_count: 1 })
    );
  });
});

describe('getCurrentUsage', () => {
  let rpc: any;
  beforeEach(() => {
    vi.clearAllMocks();
    rpc = vi.fn();
    (getSupabaseServiceClient as any).mockReturnValue({ rpc });
    (getRedisClient as any).mockReturnValue(mockRedisClient);
    mockRedisClient.get.mockResolvedValue(null); // cache miss by default
    mockRedisClient.setex.mockResolvedValue('OK');
  });

  it('should get current usage from Redis', async () => {
    const merchantId = 'test-merchant-id';

    rpc.mockResolvedValueOnce({
      data: [{ messages_sent: 50, api_calls: 100, storage_bytes: 0 }],
      error: null,
    });

    const usage = await getCurrentUsage(merchantId);

    expect(usage).toBeDefined();
    expect(usage.apiCalls).toBe(100);
    expect(usage.messagesSent).toBe(50);
  });

  it('should return zero for non-existent usage', async () => {
    const merchantId = 'test-merchant-id';

    rpc.mockResolvedValueOnce({ data: [], error: null });

    const usage = await getCurrentUsage(merchantId);

    expect(usage.apiCalls).toBe(0);
    expect(usage.messagesSent).toBe(0);
  });

  it('should handle Redis errors', async () => {
    const merchantId = 'test-merchant-id';

    rpc.mockResolvedValueOnce({ data: null, error: { message: 'RPC error' } });

    const usage = await getCurrentUsage(merchantId);

    // Should return zero on error
    expect(usage.apiCalls).toBe(0);
    expect(usage.messagesSent).toBe(0);
  });
});

describe('resetUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRedisClient as any).mockReturnValue(mockRedisClient);
  });

  it('should reset usage counters', async () => {
    const merchantId = 'test-merchant-id';

    mockRedisClient.del.mockResolvedValue(2);

    await resetUsage(merchantId);

    expect(mockRedisClient.del).toHaveBeenCalled();
  });
});
