/**
 * BullMQ Queue setup
 * Creates and configures queues for different job types
 */

import { Queue, QueueOptions } from 'bullmq';
import { getRedisClient } from '@recete/shared';
import { QUEUE_NAMES, ScheduledMessageJobData, ScrapeJobData, AnalyticsJobData } from '@recete/shared';

const connection = getRedisClient();

const defaultQueueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

/**
 * Scheduled Messages Queue
 * For T+0, T+3, T+14, T+25 messages and upsell
 */
export const scheduledMessagesQueue = new Queue<ScheduledMessageJobData>(
  QUEUE_NAMES.SCHEDULED_MESSAGES,
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      removeOnComplete: {
        age: 7 * 24 * 3600, // Keep scheduled messages longer
        count: 5000,
      },
    },
  }
);

/**
 * Scrape Jobs Queue
 * For product URL scraping and embedding
 */
export const scrapeJobsQueue = new Queue<ScrapeJobData>(
  QUEUE_NAMES.SCRAPE_JOBS,
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 5, // More retries for scraping
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  }
);

/**
 * Analytics Queue
 * For async analytics event processing
 */
export const analyticsQueue = new Queue<AnalyticsJobData>(
  QUEUE_NAMES.ANALYTICS,
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 2, // Fewer retries for analytics
      removeOnComplete: {
        age: 1 * 24 * 3600, // Keep analytics jobs shorter
        count: 500,
      },
    },
  }
);

/**
 * Get all queues (for health check, graceful shutdown, etc.)
 */
export function getAllQueues() {
  return [scheduledMessagesQueue, scrapeJobsQueue, analyticsQueue];
}

/**
 * Close all queues (graceful shutdown)
 */
export async function closeAllQueues() {
  await Promise.all([
    scheduledMessagesQueue.close(),
    scrapeJobsQueue.close(),
    analyticsQueue.close(),
  ]);
}
