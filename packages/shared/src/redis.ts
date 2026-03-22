/**
 * Redis connection setup
 * Provides configured Redis client for BullMQ queues
 */

import { Redis } from 'ioredis';
import { logger } from './logger.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient: Redis | null = null;

/**
 * Get Redis client instance (singleton)
 * Creates connection on first call, reuses on subsequent calls
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        if (times > 10) {
          // After 10 retries, log error and continue trying
          logger.error({ times }, 'Redis connection retry attempt');
        }
        const delay = Math.min(times * 100, 3000); // Exponential backoff up to 3 seconds
        return delay;
      },
      reconnectOnError: (err: Error) => {
        // Reconnect on specific errors
        const reconnectErrors = ['READONLY', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
        const shouldReconnect = reconnectErrors.some(errType => 
          err.message.includes(errType)
        );
        if (shouldReconnect) {
          logger.info({ message: err.message }, 'Redis reconnecting');
          return true;
        }
        return false;
      },
      lazyConnect: false, // Connect immediately
      enableOfflineQueue: true, // Queue commands while offline
      connectTimeout: 10000, // 10 seconds
      keepAlive: 30000, // Keep connection alive with 30s intervals
    });

    redisClient.on('error', (err: Error) => {
      logger.error({ message: err.message }, 'Redis connection error');
      // Don't crash the app on Redis errors
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis ready');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    redisClient.on('close', () => {
      logger.info('Redis connection closed');
    });
  }

  return redisClient;
}

/**
 * Close Redis connection
 * Useful for graceful shutdown
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error({ err: error }, 'Redis health check failed');
    return false;
  }
}

