/**
 * Redis Caching Utilities
 * Provides caching layer for frequently accessed data
 */

import { getRedisClient, logger } from '@glowguide/shared';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
}

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Generate cache key
 */
function getCacheKey(prefix: string, key: string): string {
  return `cache:${prefix}:${key}`;
}

/**
 * Get value from cache
 */
export async function getCache<T>(prefix: string, key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const cacheKey = getCacheKey(prefix, key);
    const value = await redis.get(cacheKey);
    
    if (!value) {
      return null;
    }
    
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error({ error, prefix, key }, 'Failed to get from cache');
    return null;
  }
}

/**
 * Set value in cache
 */
export async function setCache<T>(
  prefix: string,
  key: string,
  value: T,
  ttl: number = DEFAULT_TTL
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const cacheKey = getCacheKey(prefix, key);
    const serialized = JSON.stringify(value);
    
    await redis.setex(cacheKey, ttl, serialized);
    return true;
  } catch (error) {
    logger.error({ error, prefix, key }, 'Failed to set cache');
    return false;
  }
}

/**
 * Delete value from cache
 */
export async function deleteCache(prefix: string, key: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const cacheKey = getCacheKey(prefix, key);
    await redis.del(cacheKey);
    return true;
  } catch (error) {
    logger.error({ error, prefix, key }, 'Failed to delete from cache');
    return false;
  }
}

/**
 * Delete all cache entries with prefix
 */
export async function deleteCachePrefix(prefix: string): Promise<number> {
  try {
    const redis = getRedisClient();
    const pattern = getCacheKey(prefix, '*');
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }
    
    await redis.del(...keys);
    return keys.length;
  } catch (error) {
    logger.error({ error, prefix }, 'Failed to delete cache prefix');
    return 0;
  }
}

/**
 * Cache merchant data
 */
export async function getCachedMerchant(merchantId: string) {
  return getCache('merchant', merchantId);
}

export async function setCachedMerchant(merchantId: string, data: any, ttl: number = 300) {
  return setCache('merchant', merchantId, data, ttl);
}

export async function invalidateMerchantCache(merchantId: string) {
  return deleteCache('merchant', merchantId);
}

/**
 * Cache product data
 */
export async function getCachedProduct(productId: string) {
  return getCache('product', productId);
}

export async function setCachedProduct(productId: string, data: any, ttl: number = 600) {
  return setCache('product', productId, data, ttl);
}

export async function invalidateProductCache(productId: string) {
  return deleteCache('product', productId);
}

/**
 * Cache API responses
 */
export async function getCachedApiResponse(endpoint: string, params?: Record<string, any>) {
  const key = params ? `${endpoint}:${JSON.stringify(params)}` : endpoint;
  return getCache('api', key);
}

export async function setCachedApiResponse(
  endpoint: string,
  data: any,
  ttl: number = 60,
  params?: Record<string, any>
) {
  const key = params ? `${endpoint}:${JSON.stringify(params)}` : endpoint;
  return setCache('api', key, data, ttl);
}

/**
 * Cache RAG query results
 */
export async function getCachedRAGQuery(
  query: string,
  merchantId: string
): Promise<{ results: any[]; totalResults: number } | null> {
  const key = `${merchantId}:${query}`;
  return getCache<{ results: any[]; totalResults: number }>('rag', key);
}

export async function setCachedRAGQuery(
  query: string,
  merchantId: string,
  data: any,
  ttl: number = 3600
) {
  const key = `${merchantId}:${query}`;
  return setCache('rag', key, data, ttl);
}

/**
 * Cache plan limits
 */
export async function getCachedPlanLimits(merchantId: string) {
  return getCache('plan_limits', merchantId);
}

export async function setCachedPlanLimits(merchantId: string, limits: any, ttl: number = 1800) {
  return setCache('plan_limits', merchantId, limits, ttl);
}

export async function invalidatePlanLimitsCache(merchantId: string) {
  return deleteCache('plan_limits', merchantId);
}

/**
 * Cache usage data
 */
export async function getCachedUsage(merchantId: string) {
  return getCache('usage', merchantId);
}

export async function setCachedUsage(merchantId: string, usage: any, ttl: number = 60) {
  return setCache('usage', merchantId, usage, ttl);
}

export async function invalidateUsageCache(merchantId: string) {
  return deleteCache('usage', merchantId);
}
