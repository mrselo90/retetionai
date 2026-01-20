/**
 * Test & Development Interface routes
 * Mock event simulation, WhatsApp testing, RAG testing, etc.
 * NOTE: In production, these should be protected or disabled
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseServiceClient } from '@glowguide/shared';
import { normalizePhone } from '../lib/events';
import { processNormalizedEvent } from '../lib/orderProcessor';
import { findUserByPhone, getOrCreateConversation, addMessageToConversation, getConversationHistory } from '../lib/conversation';
import { generateAIResponse } from '../lib/aiAgent';
import { queryKnowledgeBase } from '../lib/rag';
import { getRedisClient } from '@glowguide/shared';
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
        phone: normalizePhone(customer_phone),
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
    const body = await c.req.json();

    const { query, productIds, topK = 3 } = body;

    if (!query) {
      return c.json({
        error: 'Missing required field: query',
      }, 400);
    }

    const ragResult = await queryKnowledgeBase({
      merchantId,
      query,
      productIds,
      topK,
      similarityThreshold: 0.7,
    });

    return c.json({
      query,
      results: ragResult.results,
      count: ragResult.results.length,
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
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
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default test;
