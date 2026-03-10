/**
 * Queue helpers for API
 * Functions to add jobs to queues from API endpoints
 */

import { Queue } from 'bullmq';
import { getRedisClient } from '@recete/shared';
import {
  QUEUE_NAMES,
  ScheduledMessageJobData,
  ScrapeJobData,
  AnalyticsJobData,
  WhatsAppInboundJobData,
} from '@recete/shared';

type CommerceEventJobData = {
  externalEventId: string;
  merchantId: string;
};

const COMMERCE_EVENTS_QUEUE = 'commerce-events';

// Lazily create queue instances to avoid creating Redis connections at import time
let scheduledMessagesQueue: Queue<ScheduledMessageJobData> | null = null;
let scrapeJobsQueue: Queue<ScrapeJobData> | null = null;
let analyticsQueue: Queue<AnalyticsJobData> | null = null;
let commerceEventsQueue: Queue<CommerceEventJobData> | null = null;
let whatsappInboundQueue: Queue<WhatsAppInboundJobData> | null = null;

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

function getCommerceEventsQueue() {
  if (!commerceEventsQueue) {
    commerceEventsQueue = new Queue<CommerceEventJobData>(COMMERCE_EVENTS_QUEUE, {
      connection: getRedisClient(),
    });
  }
  return commerceEventsQueue;
}

function getWhatsAppInboundQueue() {
  if (!whatsappInboundQueue) {
    whatsappInboundQueue = new Queue<WhatsAppInboundJobData>(QUEUE_NAMES.WHATSAPP_INBOUND, {
      connection: getRedisClient(),
    });
  }
  return whatsappInboundQueue;
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

/**
 * Add a commerce event processing job
 */
export async function addCommerceEventJob(data: CommerceEventJobData) {
  return await getCommerceEventsQueue().add(
    `commerce-event-${data.externalEventId}`,
    data,
    {
      jobId: data.externalEventId,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 5000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
      },
    }
  );
}

/**
 * Add WhatsApp inbound event processing job
 */
export async function addWhatsAppInboundJob(data: WhatsAppInboundJobData) {
  return await getWhatsAppInboundQueue().add(
    `whatsapp-inbound-${data.inboundEventId}`,
    data,
    {
      jobId: data.inboundEventId,
      attempts: 1,
      removeOnComplete: {
        age: 24 * 3600,
        count: 2000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
      },
    }
  );
}

/**
 * Get health stats for all queues
 */
export async function getQueueStats() {
  const [scheduledMsgCounts, scrapeJobsCounts, analyticsCounts, commerceEventCounts, whatsappInboundCounts] = await Promise.all([
    getScheduledMessagesQueue().getJobCounts(),
    getScrapeJobsQueue().getJobCounts(),
    getAnalyticsQueue().getJobCounts(),
    getCommerceEventsQueue().getJobCounts(),
    getWhatsAppInboundQueue().getJobCounts(),
  ]);

  return {
    scheduledMessages: scheduledMsgCounts,
    scrapeJobs: scrapeJobsCounts,
    analytics: analyticsCounts,
    commerceEvents: commerceEventCounts,
    whatsappInbound: whatsappInboundCounts,
  };
}
