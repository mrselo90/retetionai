/**
 * BullMQ Queue setup
 * Creates and configures queues for different job types
 */

import { Queue, QueueOptions, QueueEvents } from 'bullmq';
import { getRedisClient, logger } from '@recete/shared';
import {
  QUEUE_NAMES,
  ScheduledMessageJobData,
  ScrapeJobData,
  AnalyticsJobData,
  GdprJobData,
  WhatsAppInboundJobData,
} from '@recete/shared';

type CommerceEventJobData = {
  externalEventId: string;
  merchantId: string;
};

const COMMERCE_EVENTS_QUEUE = 'commerce-events';
const DLQ_QUEUE_NAME = 'dead-letter';

const connection = getRedisClient();

export const deadLetterQueue = new Queue(DLQ_QUEUE_NAME, { connection });

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
 * Commerce Events Queue
 * For async processing of Shopify commerce webhooks after ingestion
 */
export const commerceEventsQueue = new Queue<CommerceEventJobData>(
  COMMERCE_EVENTS_QUEUE,
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: {
        age: 1 * 24 * 3600,
        count: 5000,
      },
    },
  }
);

export const gdprJobsQueue = new Queue<GdprJobData>(
  QUEUE_NAMES.GDPR_JOBS,
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: {
        age: 7 * 24 * 3600,
        count: 2000,
      },
      removeOnFail: {
        age: 30 * 24 * 3600,
      },
    },
  }
);

/**
 * WhatsApp Inbound Queue
 * For async processing of inbound WhatsApp messages
 */
export const whatsappInboundQueue = new Queue<WhatsAppInboundJobData>(
  QUEUE_NAMES.WHATSAPP_INBOUND,
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: {
        age: 1 * 24 * 3600,
        count: 2000,
      },
    },
  }
);

/** Max attempts configured globally — DLQ only fires when this is exhausted. */
const MAX_ATTEMPTS = defaultQueueOptions.defaultJobOptions?.attempts ?? 3;

/**
 * Attach DLQ listeners to all queues.
 * Only forwards to dead-letter when a job has exhausted ALL retry attempts,
 * not on every intermediate failure (which would produce duplicate DLQ records).
 */
export function setupDeadLetterForwarding() {
  const queues = [
    { name: QUEUE_NAMES.SCHEDULED_MESSAGES, queue: scheduledMessagesQueue },
    { name: QUEUE_NAMES.SCRAPE_JOBS, queue: scrapeJobsQueue },
    { name: QUEUE_NAMES.ANALYTICS, queue: analyticsQueue },
    { name: COMMERCE_EVENTS_QUEUE, queue: commerceEventsQueue },
    { name: QUEUE_NAMES.GDPR_JOBS, queue: gdprJobsQueue },
    { name: QUEUE_NAMES.WHATSAPP_INBOUND, queue: whatsappInboundQueue },
  ];

  for (const { name, queue } of queues) {
    const queueMaxAttempts =
      (queue.defaultJobOptions as { attempts?: number } | undefined)?.attempts ?? MAX_ATTEMPTS;
    const events = new QueueEvents(name, { connection });

    events.on('failed', async ({ jobId, failedReason }) => {
      // Fetch the job to read attemptsMade — only forward to DLQ when retries are exhausted.
      // Jobs are retained for 7 days (removeOnFail config) so they are available here.
      const job = await queue.getJob(jobId).catch(() => null);
      const attemptsMade = job?.attemptsMade ?? queueMaxAttempts;

      if (attemptsMade < queueMaxAttempts) {
        logger.info(
          { queue: name, jobId, attemptsMade, maxAttempts: queueMaxAttempts },
          'Job failed but has remaining retries — skipping DLQ'
        );
        return;
      }

      try {
        await deadLetterQueue.add('failed-job', {
          originalQueue: name,
          originalJobId: jobId,
          failedReason,
          attemptsMade,
          failedAt: new Date().toISOString(),
        });
        logger.warn({ queue: name, jobId, failedReason, attemptsMade }, 'Job exhausted retries — moved to dead-letter queue');
      } catch (dlqError) {
        logger.error({ queue: name, jobId, error: dlqError }, 'Failed to forward job to DLQ');
      }
    });
  }
}

/**
 * Get all queues (for health check, graceful shutdown, etc.)
 */
export function getAllQueues() {
  return [scheduledMessagesQueue, scrapeJobsQueue, analyticsQueue, commerceEventsQueue, gdprJobsQueue, whatsappInboundQueue, deadLetterQueue];
}

/**
 * Close all queues (graceful shutdown)
 */
export async function closeAllQueues() {
  await Promise.all([
    scheduledMessagesQueue.close(),
    scrapeJobsQueue.close(),
    analyticsQueue.close(),
    commerceEventsQueue.close(),
    gdprJobsQueue.close(),
    whatsappInboundQueue.close(),
    deadLetterQueue.close(),
  ]);
}
