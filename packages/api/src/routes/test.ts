/**
 * Test & Development Interface routes
 * Mock event simulation, WhatsApp testing, RAG testing, etc.
 * NOTE: In production, these should be protected or disabled
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseServiceClient } from '@recete/shared';
import { normalizePhone } from '../lib/events.js';
import { processNormalizedEvent } from '../lib/orderProcessor.js';
import { findUserByPhone, getOrCreateConversation, addMessageToConversation, getConversationHistory } from '../lib/conversation.js';
import { generateAIResponse, detectPostDeliveryFollowUpSignal } from '../lib/aiAgent.js';
import { queryKnowledgeBase, formatRAGResultsForLLM } from '../lib/rag.js';
import { getMerchantBotInfo } from '../lib/botInfo.js';
import { getOpenAIClient } from '../lib/openaiClient.js';
import { detectLanguage } from '../lib/i18n.js';
import { evaluateStyleCompliance } from '../lib/styleCompliance.js';
import { getActiveProductFactsContext } from '../lib/productFactsQuery.js';
import { getActiveProductFactsSnapshots } from '../lib/productFactsQuery.js';
import { planStructuredFactAnswer } from '../lib/productFactsPlanner.js';
import { getRedisClient } from '@recete/shared';
import { Queue } from 'bullmq';

const test = new Hono();

// All routes require authentication
test.use('/*', authMiddleware);

/**
 * Mock Event Simulation
 * POST /api/test/events
 * Simulates an order event (order_created, order_delivered, etc.)
 */
test.post('/events', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const body = await c.req.json();

    const {
      event_type,
      external_order_id,
      customer_phone,
      customer_name,
      order_status,
      delivery_date,
      products,
    } = body;

    if (!event_type || !external_order_id || !customer_phone) {
      return c.json({
        error: 'Missing required fields: event_type, external_order_id, customer_phone',
      }, 400);
    }

    // Create normalized event
    const normalizedEvent = {
      merchant_id: merchantId,
      source: 'test',
      event_type,
      occurred_at: new Date().toISOString(),
      external_order_id,
      customer: {
        phone: (() => {
          try {
            return normalizePhone(customer_phone);
          } catch {
            return customer_phone;
          }
        })(),
        name: customer_name,
      },
      order: {
        status: order_status || 'created',
        delivered_at: delivery_date,
      },
      items: products || [],
      consent_status: 'opt_in',
    };

    // Process event
    const result = await processNormalizedEvent(normalizedEvent);

    return c.json({
      message: 'Mock event processed successfully',
      event: normalizedEvent,
      result,
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Mock WhatsApp Message
 * POST /api/test/whatsapp
 * Simulates an incoming WhatsApp message
 */
test.post('/whatsapp', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const body = await c.req.json();

    const { phone, message } = body;

    if (!phone || !message) {
      return c.json({
        error: 'Missing required fields: phone, message',
      }, 400);
    }

    // Find user
    const user = await findUserByPhone(phone, merchantId);
    if (!user) {
      return c.json({
        error: 'User not found. Create an order first using /api/test/events',
      }, 404);
    }

    // Get or create conversation
    const conversationId = await getOrCreateConversation(user.userId);

    // Add user message
    await addMessageToConversation(conversationId, 'user', message);

    // Get conversation history
    const history = await getConversationHistory(conversationId);

    // Generate AI response
    const aiResponse = await generateAIResponse(
      message,
      merchantId,
      user.userId,
      conversationId,
      undefined, // orderId
      history
    );

    // Add assistant response
    await addMessageToConversation(conversationId, 'assistant', aiResponse.response);

    return c.json({
      message: 'Mock WhatsApp message processed',
      userMessage: message,
      aiResponse: aiResponse.response,
      intent: aiResponse.intent,
      guardrailBlocked: aiResponse.guardrailBlocked,
      upsellTriggered: aiResponse.upsellTriggered,
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Test RAG Query
 * POST /api/test/rag
 * Tests RAG pipeline with a query
 */
test.post('/rag', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const body = await c.req.json().catch(() => ({}));

    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const productIds = Array.isArray(body?.productIds) ? body.productIds : undefined;
    const topK = typeof body?.topK === 'number' ? body.topK : 3;

    if (!query) {
      return c.json({
        error: 'Missing required field: query',
        message: 'Provide a search query (e.g. "nasıl kullanılır?", "içindekiler").',
      }, 400);
    }

    const ragResult = await queryKnowledgeBase({
      merchantId,
      query,
      productIds,
      topK,
      similarityThreshold: 0.7,
    });

    const count = ragResult.results.length;
    const hint =
      count === 0
        ? 'RAG searches product knowledge (embeddings). Empty results usually mean: (1) No products with embeddings yet — add products and run "Generate embeddings", or (2) Query does not match product content — try e.g. "nasıl kullanılır?", "içindekiler", or a product name.'
        : undefined;

    return c.json({
      query,
      results: ragResult.results,
      count,
      ...(hint && { hint }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isEmbeddingError =
      /embedding|openai|api_key|invalid key|rate limit/i.test(message);
    return c.json(
      {
        error: isEmbeddingError
          ? 'RAG requires OpenAI (embedding failed)'
          : 'RAG test failed',
        message: isEmbeddingError
          ? 'Set OPENAI_API_KEY and ensure products have embeddings (Products → product → Generate embeddings).'
          : message,
      },
      500
    );
  }
});

/**
 * RAG + AI: ask a question and get an AI-generated answer using RAG context
 * POST /api/test/rag/answer
 * Same body as /rag; returns RAG results plus an AI answer.
 */
test.post('/rag/answer', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const body = await c.req.json().catch(() => ({}));

    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const productIds = Array.isArray(body?.productIds) ? body.productIds : undefined;
    const topK = typeof body?.topK === 'number' ? body.topK : 5;
    const conversationHistory = Array.isArray(body?.conversationHistory)
      ? body.conversationHistory
          .filter((m: any) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant' || m.role === 'merchant'))
          .map((m: any) => ({
            role: m.role,
            content: m.content,
            timestamp: typeof m.timestamp === 'string' ? m.timestamp : new Date().toISOString(),
          }))
      : [];

    if (!query) {
      return c.json({
        error: 'Missing required field: query',
        message: 'Provide a question (e.g. "Bu ürün nasıl kullanılır?").',
      }, 400);
    }

    const followUpSignal = detectPostDeliveryFollowUpSignal(query, conversationHistory);
    const ragQuery = followUpSignal.ragQueryOverride || query;
    const ragResult = await queryKnowledgeBase({
      merchantId,
      query: ragQuery,
      productIds,
      topK,
      similarityThreshold: 0.6,
    });

    const chunkContextText = formatRAGResultsForLLM(ragResult.results);
    const factsProductIds = productIds?.length
      ? productIds
      : Array.from(new Set(ragResult.results.map((r) => r.productId)));
    const factsContext = await getActiveProductFactsContext(merchantId, factsProductIds);
    const contextText = factsContext.text
      ? `${factsContext.text}\n\n${chunkContextText}`
      : chunkContextText;
    const botInfo = await getMerchantBotInfo(merchantId);
    const { data: merchant } = await getSupabaseServiceClient()
      .from('merchants')
      .select('name, persona_settings')
      .eq('id', merchantId)
      .single();

    const merchantName = merchant?.name || 'Mağaza';
    const queryLang = detectLanguage(query);
    const languageInstruction =
      queryLang === 'hu'
        ? 'Mindig magyarul válaszolj.'
        : queryLang === 'en'
          ? 'Always answer in English.'
          : 'Türkçe yanıtla.';
    let systemPrompt = `Sen ${merchantName} müşteri hizmeti asistanısın. Kullanıcının sorusunu AŞAĞIDAKI ürün bilgisine dayanarak yanıtla. Bilgi bağlamda yoksa kibarca söyle ve genel yardım öner. Asla ürün detayı uydurma. Kısa, dostane ve yardımcı ol. ${languageInstruction}\n\n`;
    if (followUpSignal.promptHint) {
      systemPrompt += `RUNTIME CONVERSATION HINT: ${followUpSignal.promptHint}\n\n`;
    }
    if (botInfo && Object.keys(botInfo).length > 0) {
      systemPrompt += '--- Marka / kurallar ---\n';
      for (const [key, value] of Object.entries(botInfo)) {
        if (value && typeof value === 'string' && value.trim()) {
          systemPrompt += `${value.trim()}\n`;
        }
      }
      systemPrompt += '\n';
    }
    systemPrompt += '--- Ürün bilgisi (buna göre cevap ver) ---\n' + contextText;

    const factsSnapshots = await getActiveProductFactsSnapshots(merchantId, factsProductIds);
    const plannerQuery = followUpSignal.plannerQueryOverride || query;
    const planned = planStructuredFactAnswer(plannerQuery, queryLang, factsSnapshots, {
      responseLength: (merchant as any)?.persona_settings?.response_length,
      includeEvidenceQuote: true,
    });

    let answer = '';
    let completion: any = null;
    let llmRequestMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    const llmConfig = {
      model: 'gpt-4o-mini',
      temperature: 0.5,
      max_tokens: 500,
    } as const;
    if (planned) {
      answer = planned.answer;
    } else {
      const openai = getOpenAIClient();
      llmRequestMessages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-10).map((m: any) => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: m.content,
        })),
        { role: 'user', content: query },
      ];
      completion = await openai.chat.completions.create({
        model: llmConfig.model,
        messages: llmRequestMessages,
        temperature: llmConfig.temperature,
        max_tokens: llmConfig.max_tokens,
      });
      answer = completion.choices[0]?.message?.content?.trim() || '';
    }

    const styleCompliance = evaluateStyleCompliance(answer, (merchant as any)?.persona_settings || {});

    return c.json({
      query,
      results: ragResult.results,
      count: ragResult.results.length,
      answer: answer || '(Cevap üretilemedi.)',
      meta: {
        queryLanguage: queryLang,
        answerLanguage: answer ? detectLanguage(answer) : null,
        postDeliveryFollowUpDetected: followUpSignal.detected,
        postDeliveryFollowUpType: followUpSignal.type || null,
        ragQueryOverridden: ragQuery !== query,
        ragExecutionTime: ragResult.executionTime,
        topChunkIds: ragResult.results.map((r) => r.chunkId),
        topProducts: Array.from(new Set(ragResult.results.map((r) => r.productId))),
        factsSnapshotsFound: factsContext.factCount,
        factsProductIds: factsContext.productIds,
        deterministicFactsAnswer: Boolean(planned),
        deterministicFactsQueryType: planned?.queryType || null,
        deterministicEvidenceUsed: planned?.evidenceQuotesUsed?.length || 0,
        styleCompliance,
        tokens: completion?.usage || null,
        aiDebug: {
          mode: planned ? 'deterministic_facts' : 'llm_chat_completion',
          model: planned ? null : llmConfig.model,
          query,
          ragQuery,
          plannerQuery,
          systemPrompt,
          contextText,
          contextChars: contextText.length,
          requestMessages: llmRequestMessages,
          llmConfig: planned ? null : llmConfig,
          deterministicAnswerUsed: Boolean(planned),
          deterministicUsedFactKeys: planned?.usedFactKeys || [],
          deterministicEvidenceQuotes: planned?.evidenceQuotesUsed || [],
        },
      },
      ...(ragResult.results.length === 0 && {
        hint: 'RAG sonucu boş; AI genel bir cevap verebilir. Ürün ekleyip embedding ürettiğinizde daha iyi yanıt alırsınız.',
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isEmbeddingError = /embedding|openai|api_key|invalid key|rate limit/i.test(message);
    return c.json(
      {
        error: isEmbeddingError ? 'RAG veya AI hatası' : 'RAG + AI testi başarısız',
        message: isEmbeddingError
          ? 'OPENAI_API_KEY doğru mu? Ürünlerde embedding var mı? (Ürünler → ürün → Embedding üret)'
          : message,
      },
      500
    );
  }
});

/**
 * Get Scheduled Tasks
 * GET /api/test/tasks
 * Lists all scheduled tasks for testing
 */
test.get('/tasks', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const serviceClient = getSupabaseServiceClient();

    // Get merchant's users
    const { data: merchantUsers } = await serviceClient
      .from('users')
      .select('id')
      .eq('merchant_id', merchantId);

    const userIds = merchantUsers?.map((u) => u.id) || [];

    if (userIds.length === 0) {
      return c.json({ tasks: [] });
    }

    const { data: tasks } = await serviceClient
      .from('scheduled_tasks')
      .select('id, user_id, order_id, task_type, execute_at, status, created_at')
      .in('user_id', userIds)
      .order('execute_at', { ascending: true })
      .limit(100);

    return c.json({ tasks: tasks || [] });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Trigger Scheduled Task Immediately
 * POST /api/test/tasks/:id/trigger
 * Executes a scheduled task immediately
 */
test.post('/tasks/:id/trigger', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const taskId = c.req.param('id');
    const serviceClient = getSupabaseServiceClient();

    // Get task
    const { data: task, error } = await serviceClient
      .from('scheduled_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    // Verify merchant ownership (via user_id)
    const { data: user } = await serviceClient
      .from('users')
      .select('merchant_id')
      .eq('id', task.user_id)
      .single();

    if (!user || user.merchant_id !== merchantId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Update task to execute now
    await serviceClient
      .from('scheduled_tasks')
      .update({
        execute_at: new Date().toISOString(),
        status: 'pending',
      })
      .eq('id', taskId);

    return c.json({
      message: 'Task triggered. Worker will process it shortly.',
      taskId,
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Get System Health
 * GET /api/test/health
 * Returns system health status (queues, database, etc.)
 */
test.get('/health', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const serviceClient = getSupabaseServiceClient();
    const redis = getRedisClient();

    // Get merchant's users
    const { data: merchantUsers } = await serviceClient
      .from('users')
      .select('id')
      .eq('merchant_id', merchantId);

    const userIds = merchantUsers?.map((u) => u.id) || [];

    // Database stats
    const { count: ordersCount } = await serviceClient
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId);

    const { count: usersCount } = await serviceClient
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId);

    let conversationsCount = 0;
    if (userIds.length > 0) {
      const { count } = await serviceClient
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .in('user_id', userIds);
      conversationsCount = count || 0;
    }

    const { count: productsCount } = await serviceClient
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId);

    // Redis/Queue status
    let queueStatus = 'unknown';
    try {
      await redis.ping();
      queueStatus = 'connected';
    } catch {
      queueStatus = 'disconnected';
    }

    // OpenAI API key: env check + live verification
    const rawKey = process.env.OPENAI_API_KEY || '';
    const placeholderPatterns = [
      /^your[_-]?openai[_-]?api[_-]?key$/i,
      /^sk-placeholder/i,
      /^your[_-]?production[_-]?openai[_-]?key$/i,
      /^your[_-]?openai[_-]?key$/i,
    ];
    const isPlaceholder =
      !rawKey ||
      placeholderPatterns.some((p) => p.test(rawKey.trim()));

    let openai: { configured: boolean; status: string; message: string; verified?: boolean } = {
      configured: !!rawKey && !isPlaceholder,
      status: !rawKey ? 'missing' : isPlaceholder ? 'placeholder' : 'ok',
      message: !rawKey
        ? 'OPENAI_API_KEY is not set (set it in root .env)'
        : isPlaceholder
          ? 'OPENAI_API_KEY looks like a placeholder; set a real key in root .env'
          : 'Checking…',
    };

    // Live check: call OpenAI with minimal request to verify key works
    if (openai.configured) {
      try {
        const client = getOpenAIClient();
        await client.embeddings.create({
          model: 'text-embedding-3-small',
          input: 'test',
        });
        openai = {
          ...openai,
          status: 'ok',
          message: 'API key is working',
          verified: true,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const isAuthError =
          /invalid.*api.*key|incorrect.*api.*key|authentication|401|403/i.test(msg) ||
          (typeof (err as { status?: number })?.status === 'number' && [(err as { status: number }).status === 401, (err as { status: number }).status === 403].some(Boolean));
        openai = {
          ...openai,
          status: isAuthError ? 'invalid' : 'error',
          message: isAuthError
            ? 'API key is invalid or rejected by OpenAI. Check OPENAI_API_KEY in .env.'
            : `OpenAI request failed: ${msg.slice(0, 120)}`,
          verified: false,
        };
      }
    }

    // Recent scheduled tasks
    let taskStats = { pending: 0, completed: 0, failed: 0 };
    if (userIds.length > 0) {
      const { data: recentTasks } = await serviceClient
        .from('scheduled_tasks')
        .select('status')
        .in('user_id', userIds)
        .limit(100);

      taskStats = {
        pending: recentTasks?.filter((t) => t.status === 'pending').length || 0,
        completed: recentTasks?.filter((t) => t.status === 'completed').length || 0,
        failed: recentTasks?.filter((t) => t.status === 'failed').length || 0,
      };
    }

    return c.json({
      database: {
        orders: ordersCount || 0,
        users: usersCount || 0,
        conversations: conversationsCount || 0,
        products: productsCount || 0,
      },
      queues: {
        redis: queueStatus,
      },
      tasks: taskStats,
      openai,
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Debug Shopify Integration
 * GET /api/test/debug-shopify
 * Returns current scopes and auth status for shopify integration
 */
test.get('/debug-shopify', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const serviceClient = getSupabaseServiceClient();

    const { data: integration, error } = await serviceClient
      .from('integrations')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('provider', 'shopify')
      .single();

    if (error || !integration) {
      return c.json({
        error: 'Shopify integration not found',
        dbError: error
      }, 404);
    }

    // Mask sensitive data
    const authData = integration.auth_data as any;
    const maskedAuthData = {
      ...authData,
      access_token: authData?.access_token ? `${authData.access_token.substring(0, 10)}...` : null,
      scope: authData?.scope || 'MISSING',
    };

    return c.json({
      integration: {
        id: integration.id,
        status: integration.status,
        updated_at: integration.updated_at,
        auth_data: maskedAuthData,
      },
      required_scopes_in_env: process.env.SHOPIFY_SCOPES,
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Debug Billing
 * GET /api/test/debug-billing
 * Returns merchant subscription info and available plans
 */
test.get('/debug-billing', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const serviceClient = getSupabaseServiceClient();

    // Get merchant subscription
    const { data: merchant, error: merchantError } = await serviceClient
      .from('merchants')
      .select('subscription_plan, subscription_status')
      .eq('id', merchantId)
      .single();

    // Get all plans
    const { data: plans, error: plansError } = await serviceClient
      .from('subscription_plans')
      .select('*')
      .order('price_monthly');

    return c.json({
      merchant: {
        id: merchantId,
        subscription_plan: merchant?.subscription_plan,
        subscription_status: merchant?.subscription_status,
        error: merchantError,
      },
      available_plans: plans,
      plans_error: plansError,
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default test;
