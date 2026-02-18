/**
 * API Key Expiration Worker
 * Removes expired API keys from merchants
 */

import { Worker } from 'bullmq';
import { getRedisClient, getSupabaseServiceClient, logger } from '@recete/shared';
import { normalizeApiKeys, removeExpiredKeys } from './lib/apiKeyManager.js';

const redis = getRedisClient();

/**
 * Worker to clean up expired API keys
 * Runs daily at midnight
 */
export const apiKeyExpirationWorker = new Worker(
  'api-key-expiration',
  async (job) => {
    logger.info('Starting API key expiration cleanup...');
    
    const supabase = getSupabaseServiceClient();
    let processed = 0;
    let cleaned = 0;
    
    try {
      // Get all merchants
      const { data: merchants, error } = await supabase
        .from('merchants')
        .select('id, api_keys');
      
      if (error) {
        throw new Error(`Failed to fetch merchants: ${error.message}`);
      }
      
      if (!merchants) {
        return { processed: 0, cleaned: 0 };
      }
      
      // Process each merchant
      for (const merchant of merchants) {
        processed++;
        
        // Normalize keys (migrate legacy format)
        const normalizedKeys = normalizeApiKeys((merchant.api_keys as any) || []);
        
        // Remove expired keys
        const activeKeys = removeExpiredKeys(normalizedKeys);
        
        // Only update if keys were removed
        if (activeKeys.length < normalizedKeys.length) {
          cleaned++;
          const { error: updateError } = await supabase
            .from('merchants')
            .update({ api_keys: activeKeys })
            .eq('id', merchant.id);
          
          if (updateError) {
            logger.error(updateError, `Failed to update merchant ${merchant.id}`);
          } else {
            logger.info({ merchantId: merchant.id }, 'Cleaned expired keys for merchant');
          }
        }
      }
      
      logger.info({ cleaned, processed }, 'API key expiration cleanup complete');
      
      return { processed, cleaned };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), 'API key expiration cleanup failed');
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 1, // Process one merchant at a time
  }
);

apiKeyExpirationWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'API key expiration job completed');
});

apiKeyExpirationWorker.on('failed', (job, err) => {
  logger.error(err instanceof Error ? err : new Error(String(err)), `API key expiration job ${job?.id} failed`);
});
