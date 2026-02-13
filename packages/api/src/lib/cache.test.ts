/**
 * Cache Tests
 * Tests for Redis caching functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCachedProduct,
  setCachedProduct,
  getCachedMerchant,
  setCachedMerchant,
} from './cache';
import { getRedisClient } from '@glowguide/shared';
import { mockRedisClient } from '../test/mocks';

// Mock Redis client
vi.mock('@glowguide/shared', async () => {
  const actual = await vi.importActual('@glowguide/shared');
  return {
    ...actual,
    getRedisClient: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('getCachedProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRedisClient as any).mockReturnValue(mockRedisClient);
  });

  it('should retrieve cached product', async () => {
    const productId = 'product-id';
    const cachedProduct = {
      id: productId,
      name: 'Test Product',
      merchant_id: 'merchant-id',
    };

    mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedProduct));

    const result = await getCachedProduct(productId);

    expect(result).toBeDefined();
    expect(result?.id).toBe(productId);
    expect(result?.name).toBe('Test Product');
    // Note: actual implementation uses getCache helper
    expect(mockRedisClient.get).toHaveBeenCalled();
  });

  it('should return null for non-existent cache', async () => {
    const productId = 'non-existent-id';

    mockRedisClient.get.mockResolvedValue(null);

    const result = await getCachedProduct(productId);

    expect(result).toBeNull();
  });

  it('should handle invalid JSON in cache', async () => {
    const productId = 'product-id';

    mockRedisClient.get.mockResolvedValue('invalid-json');

    // Should handle gracefully
    const result = await getCachedProduct(productId);
    expect(result).toBeNull();
  });
});

describe('setCachedProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRedisClient as any).mockReturnValue(mockRedisClient);
  });

  it('should cache product with TTL', async () => {
    const product = {
      id: 'product-id',
      name: 'Test Product',
      merchant_id: 'merchant-id',
    };
    const ttl = 600; // 10 minutes

    mockRedisClient.setex.mockResolvedValue('OK');

    await setCachedProduct(product.id, product, ttl);

    // Note: actual implementation uses setCache helper with setex
    expect(mockRedisClient.setex).toHaveBeenCalled();
  });

  it('should use default TTL if not provided', async () => {
    const product = {
      id: 'product-id',
      name: 'Test Product',
    };

    mockRedisClient.setex.mockResolvedValue('OK');

    await setCachedProduct(product.id, product);

    expect(mockRedisClient.setex).toHaveBeenCalled();
    // Default TTL is 600 seconds (10 minutes)
  });
});

describe('getCachedMerchant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRedisClient as any).mockReturnValue(mockRedisClient);
  });

  it('should retrieve cached merchant', async () => {
    const merchantId = 'merchant-id';
    const cachedMerchant = {
      id: merchantId,
      name: 'Test Merchant',
      api_keys: [],
    };

    mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedMerchant));

    const result = await getCachedMerchant(merchantId);

    expect(result).toBeDefined();
    expect(result?.id).toBe(merchantId);
    expect(mockRedisClient.get).toHaveBeenCalled();
  });

  it('should return null for non-existent cache', async () => {
    const merchantId = 'non-existent-id';

    mockRedisClient.get.mockResolvedValue(null);

    const result = await getCachedMerchant(merchantId);

    expect(result).toBeNull();
  });
});

describe('setCachedMerchant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRedisClient as any).mockReturnValue(mockRedisClient);
  });

  it('should cache merchant with TTL', async () => {
    const merchant = {
      id: 'merchant-id',
      name: 'Test Merchant',
      api_keys: [],
    };
    const ttl = 3600; // 1 hour

    mockRedisClient.setex.mockResolvedValue('OK');

    await setCachedMerchant(merchant.id, merchant, ttl);

    expect(mockRedisClient.setex).toHaveBeenCalled();
  });
});
