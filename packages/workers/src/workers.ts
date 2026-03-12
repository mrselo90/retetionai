/**
 * BullMQ Workers
 * Background job processors for queues
 */

import { Worker, WorkerOptions } from 'bullmq';
import { getRedisClient, getSupabaseServiceClient, logger } from '@recete/shared';
import {
  QUEUE_NAMES,
  ScheduledMessageJobData,
  ScrapeJobData,
  AnalyticsJobData,
  GdprJobData,
  WhatsAppInboundJobData,
  getUsageInstructionsForProductIds,
  type ProductInstructionRow,
} from '@recete/shared';
import { sendWhatsAppMessage, getEffectiveWhatsAppCredentials } from './lib/whatsapp.js';
import { scrapeProductPage } from './lib/scraper.js';
import { processProductForRAG } from './lib/knowledgeBase.js';

type CommerceEventJobData = {
  externalEventId: string;
  merchantId: string;
};

const COMMERCE_EVENTS_QUEUE = 'commerce-events';

// Lightweight inline i18n for worker templates (mirrors api/src/lib/i18n.ts)
type WorkerLang = 'tr' | 'en' | 'hu';
const WORKER_TEMPLATES: Record<WorkerLang, Record<string, string>> = {
  tr: {
    welcome: 'Merhaba! Siparişiniz için teşekkür ederiz. Size nasıl yardımcı olabilirim?',
    checkin_t3: 'Merhaba! Ürününüzü nasıl kullanıyorsunuz? Herhangi bir sorunuz var mı?',
    checkin_t14: 'Merhaba! Ürününüzden memnun musunuz? Size özel yeni ürünlerimiz var!',
    upsell: 'Size özel indirimli ürünlerimizi keşfetmek ister misiniz?',
    welcome_with_instructions: 'Merhaba! Siparişiniz için teşekkür ederiz. Satın aldığınız ürünler için kullanım bilgileri:\n\n',
    welcome_instructions_cta: '\n\nUygulama konusunda sorunuz var mı?',
  },
  en: {
    welcome: 'Hello! Thank you for your order. How can I help you?',
    checkin_t3: 'Hello! How are you using your product? Do you have any questions?',
    checkin_t14: 'Hello! Are you satisfied with your product? We have new products just for you!',
    upsell: 'Would you like to discover our special discounted products?',
    welcome_with_instructions: 'Hello! Thank you for your order. Here are the usage instructions for your products:\n\n',
    welcome_instructions_cta: '\n\nDo you have any questions about usage?',
  },
  hu: {
    welcome: 'Üdvözöljük! Köszönjük a rendelését. Miben segíthetek?',
    checkin_t3: 'Üdvözöljük! Hogyan használja a terméket? Van bármilyen kérdése?',
    checkin_t14: 'Üdvözöljük! Elégedett a termékkel? Különleges új termékeink vannak Önnek!',
    upsell: 'Szeretné felfedezni különleges kedvezményes termékeinket?',
    welcome_with_instructions: 'Üdvözöljük! Köszönjük a rendelését. Íme a megvásárolt termékek használati útmutatója:\n\n',
    welcome_instructions_cta: '\n\nVan kérdése a használattal kapcsolatban?',
  },
};

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean))];
}

function buildProductListText(productNames: string[]): string {
  if (productNames.length === 0) return '-';
  return productNames.map((name) => `- ${name}`).join('\n');
}

function applyWelcomeTemplate(
  template: string,
  context: {
    orderNumber?: string | null;
    productList?: string | null;
  }
): string {
  const orderNumber = context.orderNumber?.trim() || '-';
  const productList = context.productList?.trim() || '-';

  return template
    .replace(/\{\{\s*order_number\s*\}\}/gi, orderNumber)
    .replace(/\{\{\s*product_list\s*\}\}/gi, productList);
}

type ConversationHistoryMessage = {
  role: 'user' | 'assistant' | 'merchant';
  content: string;
  timestamp: string;
};

async function getOrCreateConversationForWorker(
  serviceClient: ReturnType<typeof getSupabaseServiceClient>,
  userId: string,
  orderId?: string
): Promise<string> {
  let query = serviceClient.from('conversations').select('id').eq('user_id', userId);

  if (orderId) {
    query = query.eq('order_id', orderId);
  } else {
    query = query.is('order_id', null);
  }

  const { data: existing } = await query.single();
  if (existing?.id) return existing.id;

  const { data: created, error } = await serviceClient
    .from('conversations')
    .insert({
      user_id: userId,
      order_id: orderId ?? null,
      history: [],
      current_state: null,
    })
    .select('id')
    .single();

  if (error || !created?.id) {
    throw new Error(`Failed to create conversation: ${error?.message || 'unknown error'}`);
  }

  return created.id;
}

async function appendAssistantMessageToConversation(
  serviceClient: ReturnType<typeof getSupabaseServiceClient>,
  conversationId: string,
  content: string
): Promise<void> {
  const timestampIso = new Date().toISOString();
  const { error: appendError } = await serviceClient.rpc('append_conversation_message_atomic', {
    conversation_uuid: conversationId,
    message_role: 'assistant',
    message_content: content,
    message_timestamp: timestampIso,
  });

  if (!appendError) return;
  if ((appendError as any)?.code !== '42883') {
    throw new Error(`Failed to append conversation history: ${appendError.message}`);
  }

  // Fallback if migration is not applied yet.
  const { data: conversation, error: fetchError } = await serviceClient
    .from('conversations')
    .select('history')
    .eq('id', conversationId)
    .single();

  if (fetchError || !conversation) {
    throw new Error(`Conversation not found: ${fetchError?.message || 'unknown error'}`);
  }

  const history = Array.isArray(conversation.history)
    ? ([...conversation.history] as ConversationHistoryMessage[])
    : [];

  history.push({
    role: 'assistant',
    content,
    timestamp: timestampIso,
  });

  const { error: updateError } = await serviceClient
    .from('conversations')
    .update({
      history,
      updated_at: timestampIso,
    })
    .eq('id', conversationId);

  if (updateError) {
    throw new Error(`Failed to update conversation history: ${updateError.message}`);
  }
}

import {
  scheduledMessagesQueue,
  scrapeJobsQueue,
  analyticsQueue,
  whatsappInboundQueue,
} from './queues.js';

const connection = getRedisClient();

function buildSendFailureError(sendResult: {
  error?: string;
  provider?: string;
  httpStatus?: number;
  errorCode?: string;
  failureCategory?: string;
  retryAfterMs?: number;
}): Error {
  const details = [
    sendResult.provider ? `provider=${sendResult.provider}` : null,
    sendResult.httpStatus ? `status=${sendResult.httpStatus}` : null,
    sendResult.errorCode ? `code=${sendResult.errorCode}` : null,
    sendResult.failureCategory ? `category=${sendResult.failureCategory}` : null,
    sendResult.retryAfterMs ? `retryAfterMs=${sendResult.retryAfterMs}` : null,
  ].filter(Boolean).join(' ');

  return new Error([sendResult.error || 'Failed to send message', details].filter(Boolean).join(' | '));
}

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
    const { type, userId, orderId, merchantId, messageTemplate, to, scheduledFor, productIds, productNames: jobProductNames } = job.data;

    logger.info({ type, userId, orderId }, '[Scheduled Message] Processing job');

    try {
      const serviceClient = getSupabaseServiceClient();

      const { data: merchant } = await serviceClient
        .from('merchants')
        .select('subscription_status')
        .eq('id', merchantId)
        .maybeSingle();

      const { data: integration } = await serviceClient
        .from('integrations')
        .select('status')
        .eq('merchant_id', merchantId)
        .eq('provider', 'shopify')
        .maybeSingle();

      if (!integration || integration.status !== 'active') {
        logger.warn({ merchantId, jobId: job.id }, '[Scheduled Message] Skipping inactive Shopify integration');
        return { skipped: true, reason: 'inactive_integration' };
      }

      if (merchant?.subscription_status && !['active', 'trial'].includes(merchant.subscription_status)) {
        logger.warn({ merchantId, jobId: job.id, status: merchant.subscription_status }, '[Scheduled Message] Skipping inactive subscription');
        return { skipped: true, reason: 'inactive_subscription' };
      }

      // Get WhatsApp credentials (merchant's own or corporate per setting)
      const credentials = await getEffectiveWhatsAppCredentials(merchantId);

      if (!credentials) {
        throw new Error('WhatsApp credentials not configured');
      }

      // Generate message if template not provided
      let message = messageTemplate;

      if (!message) {
        // Determine merchant language from persona_settings.default_language (fallback: 'tr')
        const { data: merchantRow } = await serviceClient
          .from('merchants')
          .select('persona_settings')
          .eq('id', merchantId)
          .single();
        const personaSettings = (merchantRow?.persona_settings as any) || {};
        const lang: WorkerLang = personaSettings?.default_language || 'tr';
        const tpl = WORKER_TEMPLATES[lang] || WORKER_TEMPLATES.tr;
        const customWelcomeTemplate =
          typeof personaSettings?.whatsapp_welcome_template === 'string' &&
          personaSettings.whatsapp_welcome_template.trim().length > 0
            ? personaSettings.whatsapp_welcome_template.trim()
            : null;

        // T+0 welcome: build beauty-consultant message from product usage instructions
        if (type === 'welcome' && productIds && productIds.length > 0) {
          const instructions = await getUsageInstructionsForProductIds(merchantId, productIds);
          const instructionProductNames = uniqueNonEmpty(
            instructions.map((row: ProductInstructionRow) => row.product_name)
          );
          let productNames = instructionProductNames.length > 0 ? instructionProductNames : uniqueNonEmpty(jobProductNames || []);

          if (productNames.length === 0) {
            const { data: products } = await serviceClient
              .from('products')
              .select('name, external_id')
              .eq('merchant_id', merchantId)
              .in('external_id', productIds);
            productNames = uniqueNonEmpty((products || []).map((p: any) => p.name));
          }

          let orderNumber: string | null = null;
          if (orderId) {
            const { data: orderRow } = await serviceClient
              .from('orders')
              .select('external_order_id')
              .eq('id', orderId)
              .eq('merchant_id', merchantId)
              .single();
            orderNumber = (orderRow as { external_order_id?: string } | null)?.external_order_id || null;
          }

          if (customWelcomeTemplate) {
            message = applyWelcomeTemplate(customWelcomeTemplate, {
              orderNumber,
              productList: buildProductListText(productNames),
            });
          } else if (instructions.length > 0) {
            const parts = instructions.map(
              (row: ProductInstructionRow) =>
                `**${row.product_name ?? (lang === 'hu' ? 'Termék' : 'Ürün')}**\n${row.usage_instructions}${row.recipe_summary ? `\n${lang === 'hu' ? 'Összefoglaló' : 'Özet'}: ${row.recipe_summary}` : ''}`
            );
            message =
              tpl.welcome_with_instructions +
              parts.join('\n\n') +
              tpl.welcome_instructions_cta;
          } else {
            message = tpl.welcome;
          }
        } else if (type === 'welcome' && customWelcomeTemplate) {
          let orderNumber: string | null = null;
          if (orderId) {
            const { data: orderRow } = await serviceClient
              .from('orders')
              .select('external_order_id')
              .eq('id', orderId)
              .eq('merchant_id', merchantId)
              .single();
            orderNumber = (orderRow as { external_order_id?: string } | null)?.external_order_id || null;
          }
          message = applyWelcomeTemplate(customWelcomeTemplate, {
            orderNumber,
            productList: '-',
          });
        } else {
          message = tpl[type] || tpl.welcome;
        }
      }

      // Send WhatsApp message
      const sendResult = await sendWhatsAppMessage(
        {
          to,
          text: message,
          preview_url: false,
        },
        credentials
      );

      if (!sendResult.success) {
        if (sendResult.retryable) {
          throw buildSendFailureError(sendResult);
        }

        logger.warn({
          jobId: job.id,
          merchantId,
          userId,
          orderId,
          provider: sendResult.provider,
          httpStatus: sendResult.httpStatus,
          errorCode: sendResult.errorCode,
          category: sendResult.failureCategory,
        }, '[Scheduled Message] Permanent provider failure; not retrying');

        await serviceClient
          .from('scheduled_tasks')
          .update({ status: 'failed' })
          .eq('user_id', userId)
          .eq('task_type', type)
          .eq('status', 'pending');

        return {
          success: false,
          permanentFailure: true,
          reason: sendResult.error || 'Failed to send message',
        };
      }

      // Best-effort: mirror outbound automated messages into conversations so they appear in the dashboard
      try {
        if (message && message.trim()) {
          const conversationId = await getOrCreateConversationForWorker(serviceClient, userId, orderId);
          await appendAssistantMessageToConversation(serviceClient, conversationId, message);
        }
      } catch (conversationLogError) {
        logger.warn(
          { err: conversationLogError, userId, orderId, type },
          '[Scheduled Message] Failed to record outbound message in conversation history'
        );
      }

      // Best-effort: increment usage tracking (if DB function exists)
      try {
        await serviceClient.rpc('increment_usage', {
          merchant_uuid: merchantId,
          period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
          messages_count: 1,
          api_calls_count: 0,
          storage_bytes_count: 0,
        });
      } catch {
        // ignore - usage tracking is non-critical for message delivery
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
      // FUTURE: Add analytics event for product scraping completion

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
 * Commerce events worker
 * Processes stored external_events asynchronously after Shopify webhook ingestion.
 */
export const commerceEventsWorker = new Worker<CommerceEventJobData>(
  COMMERCE_EVENTS_QUEUE,
  async (job) => {
    const { externalEventId, merchantId } = job.data;
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET?.trim();
    const apiUrl = process.env.VITE_API_URL || process.env.API_URL || 'http://localhost:3001';

    if (!internalSecret) {
      throw new Error('INTERNAL_SERVICE_SECRET is required for commerce event worker');
    }

    const response = await fetch(`${apiUrl}/api/events/${externalEventId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': internalSecret,
        'X-Internal-Merchant-Id': merchantId,
      },
      body: '{}',
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Commerce process API failed (${response.status}): ${errText || 'unknown error'}`);
    }

    return {
      success: true,
      externalEventId,
      merchantId,
    };
  },
  {
    ...defaultWorkerOptions,
    concurrency: 8,
  }
);

/**
 * GDPR jobs worker
 * Processes durable Shopify privacy jobs after the webhook returns 200 OK.
 */
export const gdprJobsWorker = new Worker<GdprJobData>(
  QUEUE_NAMES.GDPR_JOBS,
  async (job) => {
    const { gdprJobId, merchantId } = job.data;
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET?.trim();
    const apiUrl = process.env.VITE_API_URL || process.env.API_URL || 'http://localhost:3001';

    if (!internalSecret) {
      throw new Error('INTERNAL_SERVICE_SECRET is required for GDPR jobs worker');
    }

    const response = await fetch(`${apiUrl}/api/gdpr/jobs/${gdprJobId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': internalSecret,
        'X-Internal-Merchant-Id': merchantId,
      },
      body: '{}',
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`GDPR job process API failed (${response.status}): ${errText || 'unknown error'}`);
    }

    return {
      success: true,
      gdprJobId,
      merchantId,
    };
  },
  {
    ...defaultWorkerOptions,
    concurrency: 2,
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
      const internalSecret = process.env.INTERNAL_SERVICE_SECRET;
      const internalHeaders = {
        'Content-Type': 'application/json',
        ...(internalSecret ? { 'X-Internal-Secret': internalSecret } : {}),
      };

      // Step 1: Scrape product
      const scrapeResult = await scrapeProductPage(url);

      if (!scrapeResult.success) {
        throw new Error(scrapeResult.error || 'Scraping failed');
      }

      // Step 2: Enrich product content with LLM via API (internal route, no auth)
      const rawContent = scrapeResult.product!.rawContent;
      let enrichedText = rawContent;
      const apiUrl = process.env.VITE_API_URL || process.env.API_URL || 'http://localhost:3001';
      try {
        const enrichRes = await fetch(`${apiUrl}/api/products/enrich`, {
          method: 'POST',
          headers: internalHeaders,
          body: JSON.stringify({
            rawText: rawContent,
            title: scrapeResult.product?.title || 'Unknown Product',
            rawSections: scrapeResult.product?.rawSections,
            productId,
            sourceUrl: url,
            sourceType: 'scrape_enrich_worker',
          })
        });
        if (enrichRes.ok) {
          const { enrichedText: et } = (await enrichRes.json()) as { enrichedText?: string };
          if (et) enrichedText = et;
        }
      } catch (err) {
        logger.error({ err }, 'Failed to call enrich API');
      }

      // Step 3: Update product with scraped and enriched content
      const serviceClient = getSupabaseServiceClient();
      const { error: updateError } = await serviceClient
        .from('products')
        .update({
          raw_text: rawContent,
          enriched_text: enrichedText,
          last_scraped_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .eq('merchant_id', merchantId);

      if (updateError) {
        throw new Error(`Failed to update product: ${updateError.message}`);
      }

      // Step 4: Generate embeddings (the API processProductForRAG will now pick up the enrichedText we just saved instead of the old rawContent)
      // Note: The worker only passes 2 arguments here because it imports an older type definition, but the API will handle it internally using the latest DB state.
      // Wait, we can't easily instruct processProductForRAG via worker if it doesn't take 3 args. ACTUALLY we should call the API's POST generate-embeddings.

      const embedRes = await fetch(`${apiUrl}/api/products/${productId}/generate-embeddings`, {
        method: 'POST',
        headers: internalHeaders,
      });

      if (!embedRes.ok) {
        const errJson = (await embedRes.json().catch(() => ({}))) as any;
        throw new Error(errJson.error || 'Embedding generation failed');
      }

      const embeddingResult = (await embedRes.json()) as { chunksCreated: number; totalTokens: number };

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

    // FUTURE: Implement analytics processing worker for aggregating metrics
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
 * WhatsApp inbound worker
 * Dequeues inbound events and asks API to process them with full AI/RAG stack.
 */
export const whatsappInboundWorker = new Worker<WhatsAppInboundJobData>(
  QUEUE_NAMES.WHATSAPP_INBOUND,
  async (job) => {
    const { inboundEventId, merchantId } = job.data;
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET?.trim();
    const apiUrl = process.env.VITE_API_URL || process.env.API_URL || 'http://localhost:3001';

    if (!internalSecret) {
      throw new Error('INTERNAL_SERVICE_SECRET is required for whatsapp inbound worker');
    }

    const response = await fetch(`${apiUrl}/api/whatsapp/inbound-events/${inboundEventId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': internalSecret,
        'X-Internal-Merchant-Id': merchantId,
      },
      body: '{}',
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Inbound process API failed (${response.status}): ${errText || 'unknown error'}`);
    }

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    logger.info(
      { inboundEventId, merchantId, result: data?.result || null },
      '[WhatsApp Inbound] Processed inbound event'
    );

    return {
      success: true,
      inboundEventId,
      merchantId,
      result: data?.result || null,
    };
  },
  {
    ...defaultWorkerOptions,
    concurrency: 8,
  }
);

/**
 * Get all workers (for graceful shutdown, health check, etc.)
 */
export function getAllWorkers() {
  return [scheduledMessagesWorker, scrapeJobsWorker, analyticsWorker, commerceEventsWorker, gdprJobsWorker, whatsappInboundWorker];
}

/**
 * Close all workers (graceful shutdown)
 */
export async function closeAllWorkers() {
  await Promise.all([
    scheduledMessagesWorker.close(),
    scrapeJobsWorker.close(),
    analyticsWorker.close(),
    commerceEventsWorker.close(),
    gdprJobsWorker.close(),
    whatsappInboundWorker.close(),
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

commerceEventsWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, '[Commerce Event] Job completed');
});

commerceEventsWorker.on('failed', (job, err) => {
  logger.error(err instanceof Error ? err : new Error(String(err)), `[Commerce Event] Job ${job?.id} failed`);
});

gdprJobsWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, '[GDPR Job] Job completed');
});

gdprJobsWorker.on('failed', (job, err) => {
  logger.error(err instanceof Error ? err : new Error(String(err)), `[GDPR Job] Job ${job?.id} failed`);
});

whatsappInboundWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, '[WhatsApp Inbound] Job completed');
});

whatsappInboundWorker.on('failed', (job, err) => {
  logger.error(err instanceof Error ? err : new Error(String(err)), `[WhatsApp Inbound] Job ${job?.id} failed`);
});
