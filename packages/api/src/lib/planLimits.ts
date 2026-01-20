/**
 * Plan Limits Enforcement
 * Checks and enforces subscription plan limits
 */

import { getPlanLimits, isSubscriptionActive } from './billing';
import { getCurrentUsage } from './usageTracking';
import { logger } from '@glowguide/shared';

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
  remaining?: number;
}

/**
 * Check if merchant can send a message
 */
export async function checkMessageLimit(merchantId: string): Promise<LimitCheckResult> {
  const limits = await getPlanLimits(merchantId);
  const usage = await getCurrentUsage(merchantId);
  
  if (!limits) {
    return { allowed: false, reason: 'Plan limits not found' };
  }
  
  // Unlimited plan
  if (limits.messages_per_month === -1) {
    return { allowed: true };
  }
  
  const current = usage.messagesSent;
  const limit = limits.messages_per_month;
  const remaining = limit - current;
  
  if (current >= limit) {
    return {
      allowed: false,
      reason: 'Message limit exceeded',
      limit,
      current,
      remaining: 0,
    };
  }
  
  return {
    allowed: true,
    limit,
    current,
    remaining,
  };
}

/**
 * Check if merchant can make an API call
 */
export async function checkApiCallLimit(merchantId: string): Promise<LimitCheckResult> {
  const limits = await getPlanLimits(merchantId);
  const usage = await getCurrentUsage(merchantId);
  
  if (!limits) {
    return { allowed: false, reason: 'Plan limits not found' };
  }
  
  // Unlimited plan
  if (limits.api_calls_per_hour === -1) {
    return { allowed: true };
  }
  
  // Note: This checks monthly usage, but limit is per hour
  // For accurate hourly tracking, we'd need to track per hour
  // For now, we'll use monthly limit as approximation
  const current = usage.apiCalls;
  const limit = limits.api_calls_per_hour * 24 * 30; // Approximate monthly limit
  const remaining = limit - current;
  
  if (current >= limit) {
    return {
      allowed: false,
      reason: 'API call limit exceeded',
      limit,
      current,
      remaining: 0,
    };
  }
  
  return {
    allowed: true,
    limit,
    current,
    remaining,
  };
}

/**
 * Check if merchant can add a product
 */
export async function checkProductLimit(merchantId: string, currentProductCount: number): Promise<LimitCheckResult> {
  const limits = await getPlanLimits(merchantId);
  
  if (!limits) {
    return { allowed: false, reason: 'Plan limits not found' };
  }
  
  // Unlimited plan
  if (limits.products_limit === -1) {
    return { allowed: true };
  }
  
  const limit = limits.products_limit;
  const remaining = limit - currentProductCount;
  
  if (currentProductCount >= limit) {
    return {
      allowed: false,
      reason: 'Product limit exceeded',
      limit,
      current: currentProductCount,
      remaining: 0,
    };
  }
  
  return {
    allowed: true,
    limit,
    current: currentProductCount,
    remaining,
  };
}

/**
 * Check if merchant can use storage
 */
export async function checkStorageLimit(merchantId: string, additionalBytes: number = 0): Promise<LimitCheckResult> {
  const limits = await getPlanLimits(merchantId);
  const usage = await getCurrentUsage(merchantId);
  
  if (!limits) {
    return { allowed: false, reason: 'Plan limits not found' };
  }
  
  // Unlimited plan
  if (limits.storage_gb === -1) {
    return { allowed: true };
  }
  
  const limitBytes = limits.storage_gb * 1024 * 1024 * 1024; // Convert GB to bytes
  const current = usage.storageBytes;
  const projected = current + additionalBytes;
  const remaining = limitBytes - current;
  
  if (projected > limitBytes) {
    return {
      allowed: false,
      reason: 'Storage limit exceeded',
      limit: limitBytes,
      current,
      remaining: Math.max(0, remaining),
    };
  }
  
  return {
    allowed: true,
    limit: limitBytes,
    current,
    remaining,
  };
}

/**
 * Check if merchant has active subscription
 */
export async function checkSubscriptionActive(merchantId: string): Promise<LimitCheckResult> {
  const isActive = await isSubscriptionActive(merchantId);
  
  if (!isActive) {
    return {
      allowed: false,
      reason: 'Subscription not active',
    };
  }
  
  return { allowed: true };
}

/**
 * Enforce message limit (throws error if exceeded)
 */
export async function enforceMessageLimit(merchantId: string): Promise<void> {
  const check = await checkMessageLimit(merchantId);
  
  if (!check.allowed) {
    logger.warn({ merchantId, check }, 'Message limit exceeded');
    throw new Error(check.reason || 'Message limit exceeded');
  }
}

/**
 * Enforce API call limit (throws error if exceeded)
 */
export async function enforceApiCallLimit(merchantId: string): Promise<void> {
  const check = await checkApiCallLimit(merchantId);
  
  if (!check.allowed) {
    logger.warn({ merchantId, check }, 'API call limit exceeded');
    throw new Error(check.reason || 'API call limit exceeded');
  }
}

/**
 * Enforce product limit (throws error if exceeded)
 */
export async function enforceProductLimit(merchantId: string, currentProductCount: number): Promise<void> {
  const check = await checkProductLimit(merchantId, currentProductCount);
  
  if (!check.allowed) {
    logger.warn({ merchantId, currentProductCount, check }, 'Product limit exceeded');
    throw new Error(check.reason || 'Product limit exceeded');
  }
}

/**
 * Enforce storage limit (throws error if exceeded)
 */
export async function enforceStorageLimit(merchantId: string, additionalBytes: number = 0): Promise<void> {
  const check = await checkStorageLimit(merchantId, additionalBytes);
  
  if (!check.allowed) {
    logger.warn({ merchantId, additionalBytes, check }, 'Storage limit exceeded');
    throw new Error(check.reason || 'Storage limit exceeded');
  }
}
