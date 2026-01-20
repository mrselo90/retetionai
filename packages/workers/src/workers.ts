/**
 * BullMQ Workers
 * Background job processors for queues
 */

import { Worker, WorkerOptions } from 'bullmq';
import { getRedisClient, logger } from '@glowguide/shared';
import { incrementMessageCount } from '../api/src/lib/usageTracking';
import {
  QUEUE_NAMES,
  ScheduledMessageJobData,
  ScrapeJobData,
  AnalyticsJobData,
} from '@glowguide/shared/queues';
import {
  scheduledMessagesQueue,
  scrapeJobsQueue,
  analyticsQueue,
} from './queues';

const connection = getRedisClient();

const defaultWorkerOptions: WorkerOptions = {
  connection,
  concurrency: 5, // Process 5 jobs concurrently
  limiter: {
    max: 10, // Max 10 jobs
    duration: 1000, // Per second
  },
};

/**
 * Scheduled Messages Worker
 * Processes scheduled WhatsApp messages
 */
export const scheduledMessagesWorker = new Worker<ScheduledMessageJobData>(
  QUEUE_NAMES.SCHEDULED_MESSAGES,
  async (job) => {
    const { type, userId, orderId, merchantId, messageTemplate, to, scheduledFor } = job.data;
    
    console.log(`[Scheduled Message] Processing ${type} for user ${userId}`);
    
    try {
      // Import modules (dynamic to avoid circular deps)
      const { sendWhatsAppMessage, getWhatsAppCredentials } = await import('../../api/src/lib/whatsapp');
      const serviceClient = getSupabaseServiceClient();
      
      // Get WhatsApp credentials
      const credentials = await getWhatsAppCredentials(merchantId);
      
      if (!credentials) {
        throw new Error('WhatsApp credentials not configured');
      }
      
      // Generate message if template not provided
      let message = messageTemplate;
      
      if (!message) {
        // Default templates (will be replaced with LLM generation later)
        const templates: Record<string, string> = {
          welcome: 'Merhaba! Siparişiniz için teşekkür ederiz. Size nasıl yardımcı olabilirim?',
          checkin_t3: 'Merhaba! Ürününüzü nasıl kullanıyorsunuz? Herhangi bir sorunuz var mı?',
          checkin_t14: 'Merhaba! Ürününüzden memnun musunuz? Size özel yeni ürünlerimiz var!',
          upsell: 'Size özel indirimli ürünlerimizi keşfetmek ister misiniz?',
        };
        
        message = templates[type] || 'Merhaba! Size nasıl yardımcı olabilirim?';
      }
      
      // Send WhatsApp message
      const sendResult = await sendWhatsAppMessage(
        {
          to,
          text: message,
          preview_url: false,
        },
        credentials.accessToken,
        credentials.phoneNumberId
      );
      
      if (!sendResult.success) {
        throw new Error(sendResult.error || 'Failed to send message');
      }
      
      // Update scheduled task status
      const { error: updateError } = await serviceClient
        .from('scheduled_tasks')
        .update({
          status: 'completed',
        })
        .eq('user_id', userId)
        .eq('task_type', type)
        .eq('status', 'pending')
        .lte('execute_at', new Date().toISOString());
      
      if (updateError) {
        console.error('Failed to update scheduled task:', updateError);
      }
      
      // Log analytics event
      // TODO: Add analytics event
      
      logger.info({ type, to, userId }, '[Scheduled Message] Message sent successfully');
      
      return {
        success: true,
        type,
        userId,
        messageId: sendResult.messageId,
      };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), `[Scheduled Message] Job ${job.id} failed`);
      
      // Update task status to failed
      try {
        const serviceClient = getSupabaseServiceClient();
        await serviceClient
          .from('scheduled_tasks')
          .update({ status: 'failed' })
          .eq('user_id', userId)
          .eq('task_type', type)
          .eq('status', 'pending');
      } catch (updateError) {
        logger.error(updateError, 'Failed to update task status');
      }
      
      throw error;
    }
  },
  {
    ...defaultWorkerOptions,
    concurrency: 3, // Lower concurrency for message sending
  }
);

/**
 * Scrape Jobs Worker
 * Processes product URL scraping and embedding generation
 */
export const scrapeJobsWorker = new Worker<ScrapeJobData>(
  QUEUE_NAMES.SCRAPE_JOBS,
  async (job) => {
    const { productId, merchantId, url } = job.data;
    
    logger.info({ productId, url, merchantId }, '[Scrape Job] Processing product');
    
    try {
      // Import modules (dynamic to avoid circular deps)
      const { scrapeProductPage } = await import('../../api/src/lib/scraper');
      const { processProductForRAG } = await import('../../api/src/lib/knowledgeBase');
      
      // Step 1: Scrape product
      const scrapeResult = await scrapeProductPage(url);
      
      if (!scrapeResult.success) {
        throw new Error(scrapeResult.error || 'Scraping failed');
      }
      
      const rawContent = scrapeResult.product!.rawContent;
      
      // Step 2: Update product with scraped content
      const serviceClient = getSupabaseServiceClient();
      const { error: updateError } = await serviceClient
        .from('products')
        .update({
          raw_content: rawContent,
          last_scraped_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .eq('merchant_id', merchantId);
      
      if (updateError) {
        throw new Error(`Failed to update product: ${updateError.message}`);
      }
      
      // Step 3: Generate embeddings
      const embeddingResult = await processProductForRAG(productId, rawContent);
      
      if (!embeddingResult.success) {
        throw new Error(embeddingResult.error || 'Embedding generation failed');
      }
      
      logger.info(
        { productId, chunksCreated: embeddingResult.chunksCreated, totalTokens: embeddingResult.totalTokens },
        'Product processed successfully'
      );
      
      return {
        success: true,
        productId,
        chunksCreated: embeddingResult.chunksCreated,
        totalTokens: embeddingResult.totalTokens,
      };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), `Scrape job ${job.id} failed`);
      throw error;
    }
  },
  {
    ...defaultWorkerOptions,
    concurrency: 2, // Lower concurrency for scraping (resource intensive)
  }
);

/**
 * Analytics Worker
 * Processes analytics events asynchronously
 */
export const analyticsWorker = new Worker<AnalyticsJobData>(
  QUEUE_NAMES.ANALYTICS,
  async (job) => {
    const { merchantId, eventType, value, sentimentScore } = job.data;
    
    logger.info({ eventType, merchantId, value, sentimentScore }, '[Analytics] Processing analytics event');
    
    // TODO: Implement analytics processing
    // 1. Insert into analytics_events table
    // 2. Update daily_stats materialized view (if needed)
    // 3. Trigger alerts if needed
    
    return { success: true, eventType };
  },
  {
    ...defaultWorkerOptions,
    concurrency: 10, // Higher concurrency for analytics (lightweight)
  }
);

/**
 * Get all workers (for graceful shutdown, health check, etc.)
 */
export function getAllWorkers() {
  return [scheduledMessagesWorker, scrapeJobsWorker, analyticsWorker];
}

// Note: API key expiration worker is in a separate file due to circular dependency
// Import it separately: import { apiKeyExpirationWorker } from './apiKeyExpirationWorker';

/**
 * Close all workers (graceful shutdown)
 */
export async function closeAllWorkers() {
  await Promise.all([
    scheduledMessagesWorker.close(),
    scrapeJobsWorker.close(),
    analyticsWorker.close(),
  ]);
}

// Error handling
scheduledMessagesWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, '[Scheduled Message] Job completed');
});

scheduledMessagesWorker.on('failed', (job, err) => {
  logger.error(err instanceof Error ? err : new Error(String(err)), `[Scheduled Message] Job ${job?.id} failed`);
});

scrapeJobsWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, '[Scrape] Job completed');
});

scrapeJobsWorker.on('failed', (job, err) => {
  logger.error(err instanceof Error ? err : new Error(String(err)), `[Scrape] Job ${job?.id} failed`);
});

analyticsWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, '[Analytics] Job completed');
});

analyticsWorker.on('failed', (job, err) => {
  logger.error(err instanceof Error ? err : new Error(String(err)), `[Analytics] Job ${job?.id} failed`);
});
