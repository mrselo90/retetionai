/**
 * Usage Tracking
 * Tracks message count, API calls, and storage usage per merchant
 */

import { getSupabaseServiceClient, logger } from '@recete/shared';
import { getCachedUsage, setCachedUsage, invalidateUsageCache } from './cache.js';

export interface UsageMetrics {
  messagesSent: number;
  apiCalls: number;
  storageBytes: number;
}

/**
 * Get current month usage for a merchant (with caching)
 */
export async function getCurrentUsage(merchantId: string): Promise<UsageMetrics> {
  // Try cache first (1 minute TTL for real-time feel)
  const cached = await getCachedUsage(merchantId);
  if (cached) {
    return cached as UsageMetrics;
  }
  
  const serviceClient = getSupabaseServiceClient();
  
  // Get current month start
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const { data: usage, error } = await serviceClient
    .rpc('get_merchant_usage', {
      merchant_uuid: merchantId,
      period_start_date: monthStart.toISOString(),
    });
  
  if (error) {
    logger.error({ error, merchantId }, 'Failed to get current usage');
    return { messagesSent: 0, apiCalls: 0, storageBytes: 0 };
  }
  
  const metrics: UsageMetrics = !usage || usage.length === 0
    ? { messagesSent: 0, apiCalls: 0, storageBytes: 0 }
    : {
        messagesSent: usage[0]?.messages_sent || 0,
        apiCalls: usage[0]?.api_calls || 0,
        storageBytes: usage[0]?.storage_bytes || 0,
      };
  
  // Cache for 1 minute
  await setCachedUsage(merchantId, metrics, 60);
  
  return metrics;
}

/**
 * Increment message count
 */
export async function incrementMessageCount(merchantId: string, count: number = 1): Promise<void> {
  const serviceClient = getSupabaseServiceClient();
  
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  // Use increment function for atomic updates
  const { error } = await serviceClient.rpc('increment_usage', {
    merchant_uuid: merchantId,
    period_start: monthStart.toISOString(),
    messages_count: count,
    api_calls_count: 0,
    storage_bytes_count: 0,
  });
  
  if (error) {
    logger.error({ error, merchantId, count }, 'Failed to increment message count');
  }
}

/**
 * Increment API call count
 */
export async function incrementApiCallCount(merchantId: string, count: number = 1): Promise<void> {
  const serviceClient = getSupabaseServiceClient();
  
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Use increment function for atomic updates
  const { error } = await serviceClient.rpc('increment_usage', {
    merchant_uuid: merchantId,
    period_start: monthStart.toISOString(),
    messages_count: 0,
    api_calls_count: count,
    storage_bytes_count: 0,
  });
  
  if (error) {
    logger.error({ error, merchantId, count }, 'Failed to increment API call count');
  } else {
    // Invalidate usage cache
    await invalidateUsageCache(merchantId);
  }
}

/**
 * Reset usage cache (test/dev utility)
 * Note: Does not mutate DB counters; it only resets cached view.
 */
export async function resetUsage(merchantId: string): Promise<void> {
  await invalidateUsageCache(merchantId);
  await setCachedUsage(merchantId, { messagesSent: 0, apiCalls: 0, storageBytes: 0 }, 60);
}

/**
 * Update storage usage
 */
export async function updateStorageUsage(merchantId: string, bytes: number): Promise<void> {
  const serviceClient = getSupabaseServiceClient();
  
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  // Upsert usage record
  const { error } = await serviceClient
    .from('usage_tracking')
    .upsert({
      merchant_id: merchantId,
      period_start: monthStart.toISOString(),
      period_end: monthEnd.toISOString(),
      storage_bytes: bytes,
    }, {
      onConflict: 'merchant_id,period_start,period_end',
      ignoreDuplicates: false,
    });
  
  if (error) {
    logger.error({ error, merchantId, bytes }, 'Failed to update storage usage');
  }
}

/**
 * Get usage history for a merchant
 */
export async function getUsageHistory(
  merchantId: string,
  months: number = 6
): Promise<Array<{
  periodStart: Date;
  periodEnd: Date;
  messagesSent: number;
  apiCalls: number;
  storageBytes: number;
}>> {
  const serviceClient = getSupabaseServiceClient();
  
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);
  
  const { data: usage, error } = await serviceClient
    .from('usage_tracking')
    .select('period_start, period_end, messages_sent, api_calls, storage_bytes')
    .eq('merchant_id', merchantId)
    .gte('period_start', cutoffDate.toISOString())
    .order('period_start', { ascending: false });
  
  if (error) {
    logger.error({ error, merchantId }, 'Failed to get usage history');
    return [];
  }
  
  return (usage || []).map((u) => ({
    periodStart: new Date(u.period_start),
    periodEnd: new Date(u.period_end),
    messagesSent: u.messages_sent || 0,
    apiCalls: u.api_calls || 0,
    storageBytes: u.storage_bytes || 0,
  }));
}
