/**
 * Schedule API key expiration cleanup job
 * Runs daily at midnight
 */

import { Queue } from 'bullmq';
import { getRedisClient, logger } from '@glowguide/shared';

const redis = getRedisClient();

// Create queue for API key expiration
export const apiKeyExpirationQueue = new Queue('api-key-expiration', {
  connection: redis as any, // Redis client is compatible with BullMQ connection
});

/**
 * Schedule daily API key expiration cleanup
 * Should be called once on server startup
 */
export async function scheduleApiKeyExpirationCleanup() {
  try {
    // Check if job already exists
    const jobs = await apiKeyExpirationQueue.getJobs(['delayed', 'waiting']);
    
    if (jobs.length > 0) {
      logger.info('API key expiration job already scheduled');
      return;
    }
    
    // Schedule job to run daily at midnight (cron: 0 0 * * *)
    await apiKeyExpirationQueue.add(
      'cleanup-expired-keys',
      {},
      {
        repeat: {
          pattern: '0 0 * * *', // Daily at midnight
        },
      }
    );
    
    logger.info('API key expiration cleanup scheduled (daily at midnight)');
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(String(error)), 'Failed to schedule API key expiration cleanup');
  }
}
