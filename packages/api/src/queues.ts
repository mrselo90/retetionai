/**
 * Queue helpers for API
 * Functions to add jobs to queues from API endpoints
 */

import { Queue } from 'bullmq';
import { getRedisClient } from '@recete/shared';
import { QUEUE_NAMES, ScheduledMessageJobData, ScrapeJobData, AnalyticsJobData } from '@recete/shared';

// Lazily create queue instances to avoid creating Redis connections at import time
let scheduledMessagesQueue: Queue<ScheduledMessageJobData> | null = null;
let scrapeJobsQueue: Queue<ScrapeJobData> | null = null;
let analyticsQueue: Queue<AnalyticsJobData> | null = null;

function getScheduledMessagesQueue() {
  if (!scheduledMessagesQueue) {
    scheduledMessagesQueue = new Queue<ScheduledMessageJobData>(QUEUE_NAMES.SCHEDULED_MESSAGES, {
      connection: getRedisClient(),
    });
  }
  return scheduledMessagesQueue;
}

function getScrapeJobsQueue() {
  if (!scrapeJobsQueue) {
    scrapeJobsQueue = new Queue<ScrapeJobData>(QUEUE_NAMES.SCRAPE_JOBS, {
      connection: getRedisClient(),
    });
  }
  return scrapeJobsQueue;
}

function getAnalyticsQueue() {
  if (!analyticsQueue) {
    analyticsQueue = new Queue<AnalyticsJobData>(QUEUE_NAMES.ANALYTICS, {
      connection: getRedisClient(),
    });
  }
  return analyticsQueue;
}

/**
 * Schedule a message to be sent at a specific time
 */
export async function scheduleMessage(data: ScheduledMessageJobData) {
  const delay = new Date(data.scheduledFor).getTime() - Date.now();
  
  if (delay < 0) {
    // If scheduledFor is in the past, execute immediately
    return await getScheduledMessagesQueue().add(
      `message-${data.type}-${data.userId}`,
      data,
      { delay: 0 }
    );
  }
  
  return await getScheduledMessagesQueue().add(
    `message-${data.type}-${data.userId}`,
    data,
    { delay }
  );
}

/**
 * Add a scrape job to the queue
 */
export async function addScrapeJob(data: ScrapeJobData) {
  return await getScrapeJobsQueue().add(
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
  return await getAnalyticsQueue().add(
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
