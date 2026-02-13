/**
 * Plan Limits Tests
 * Tests for subscription plan limit enforcement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkMessageLimit,
  checkStorageLimit,
  checkApiCallLimit,
  enforceStorageLimit,
} from './planLimits';

vi.mock('./billing', () => ({
  getPlanLimits: vi.fn(),
  isSubscriptionActive: vi.fn(),
}));

vi.mock('./usageTracking', () => ({
  getCurrentUsage: vi.fn(),
}));

import { getPlanLimits } from './billing';
import { getCurrentUsage } from './usageTracking';

describe('checkMessageLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow message within limit', async () => {
    (getPlanLimits as any).mockResolvedValueOnce({ messages_per_month: 100, api_calls_per_hour: 1000, products_limit: 10, storage_gb: 10, support_level: 'community' });
    (getCurrentUsage as any).mockResolvedValueOnce({ messagesSent: 50, apiCalls: 0, storageBytes: 0 });

    const result = await checkMessageLimit('merchant-id');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(50);
  });

  it('should reject message over limit', async () => {
    (getPlanLimits as any).mockResolvedValueOnce({ messages_per_month: 100, api_calls_per_hour: 1000, products_limit: 10, storage_gb: 10, support_level: 'community' });
    (getCurrentUsage as any).mockResolvedValueOnce({ messagesSent: 100, apiCalls: 0, storageBytes: 0 });

    const result = await checkMessageLimit('merchant-id');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe('checkStorageLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow storage within limit', async () => {
    (getPlanLimits as any).mockResolvedValueOnce({ messages_per_month: 100, api_calls_per_hour: 1000, products_limit: 10, storage_gb: 1, support_level: 'community' }); // 1GB
    (getCurrentUsage as any).mockResolvedValueOnce({ messagesSent: 0, apiCalls: 0, storageBytes: 100 });

    const result = await checkStorageLimit('merchant-id', 100);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('should reject storage over limit', async () => {
    (getPlanLimits as any).mockResolvedValueOnce({ messages_per_month: 100, api_calls_per_hour: 1000, products_limit: 10, storage_gb: 0, support_level: 'community' }); // 0GB
    (getCurrentUsage as any).mockResolvedValueOnce({ messagesSent: 0, apiCalls: 0, storageBytes: 0 });

    const result = await checkStorageLimit('merchant-id', 1);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe('checkApiCallLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow API call within limit', async () => {
    (getPlanLimits as any).mockResolvedValueOnce({ messages_per_month: 100, api_calls_per_hour: 1000, products_limit: 10, storage_gb: 10, support_level: 'community' });
    (getCurrentUsage as any).mockResolvedValueOnce({ messagesSent: 0, apiCalls: 500, storageBytes: 0 });

    const result = await checkApiCallLimit('merchant-id');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('should reject API call over limit', async () => {
    (getPlanLimits as any).mockResolvedValueOnce({ messages_per_month: 100, api_calls_per_hour: 1, products_limit: 10, storage_gb: 10, support_level: 'community' });
    (getCurrentUsage as any).mockResolvedValueOnce({ messagesSent: 0, apiCalls: 100000, storageBytes: 0 });

    const result = await checkApiCallLimit('merchant-id');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe('enforceStorageLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw error when storage limit exceeded', async () => {
    (getPlanLimits as any).mockResolvedValueOnce({ messages_per_month: 100, api_calls_per_hour: 1, products_limit: 10, storage_gb: 0, support_level: 'community' });
    (getCurrentUsage as any).mockResolvedValueOnce({ messagesSent: 0, apiCalls: 0, storageBytes: 0 });

    await expect(enforceStorageLimit('merchant-id', 1)).rejects.toThrow('Storage limit exceeded');
  });

  it('should not throw when within limit', async () => {
    (getPlanLimits as any).mockResolvedValueOnce({ messages_per_month: 100, api_calls_per_hour: 1, products_limit: 10, storage_gb: 1, support_level: 'community' });
    (getCurrentUsage as any).mockResolvedValueOnce({ messagesSent: 0, apiCalls: 0, storageBytes: 0 });

    await expect(enforceStorageLimit('merchant-id', 1)).resolves.not.toThrow();
  });
});
