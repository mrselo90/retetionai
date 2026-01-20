/**
 * Queue helpers for API
 * Functions to add jobs to queues from API endpoints
 */

import { Queue } from 'bullmq';
import { getRedisClient } from '@glowguide/shared';
import { QUEUE_NAMES, ScheduledMessageJobData, ScrapeJobData, AnalyticsJobData } from '@glowguide/shared';

const connection = getRedisClient();

// Create queue instances for API (same as workers, but for adding jobs)
const scheduledMessagesQueue = new Queue<ScheduledMessageJobData>(
  QUEUE_NAMES.SCHEDULED_MESSAGES,
  { connection }
);

const scrapeJobsQueue = new Queue<ScrapeJobData>(
  QUEUE_NAMES.SCRAPE_JOBS,
  { connection }
);

const analyticsQueue = new Queue<AnalyticsJobData>(
  QUEUE_NAMES.ANALYTICS,
  { connection }
);

/**
 * Schedule a message to be sent at a specific time
 */
export async function scheduleMessage(data: ScheduledMessageJobData) {
  const delay = new Date(data.scheduledFor).getTime() - Date.now();
  
  if (delay < 0) {
    // If scheduledFor is in the past, execute immediately
    return await scheduledMessagesQueue.add(
      `message-${data.type}-${data.userId}`,
      data,
      { delay: 0 }
    );
  }
  
  return await scheduledMessagesQueue.add(
    `message-${data.type}-${data.userId}`,
    data,
    { delay }
  );
}

/**
 * Add a scrape job to the queue
 */
export async function addScrapeJob(data: ScrapeJobData) {
  return await scrapeJobsQueue.add(
    `scrape-${data.productId}`,
    data,
    {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );
}

/**
 * Add an analytics event to the queue
 */
export async function addAnalyticsEvent(data: AnalyticsJobData) {
  return await analyticsQueue.add(
    `analytics-${data.eventType}-${Date.now()}`,
    data,
    {
      attempts: 2,
      removeOnComplete: {
        age: 24 * 3600, // Keep for 24 hours
        count: 500,
      },
    }
  );
}
