/**
 * Message scheduling routes
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/billingMiddleware.js';
import {
  scheduleUserMessage,
  scheduleOrderMessages,
  cancelOrderMessages,
  getUserScheduledMessages,
} from '../lib/messageScheduler.js';

const messages = new Hono();

// All routes require authentication
messages.use('/*', authMiddleware);
messages.use('/*', requireActiveSubscription as any);

/**
 * Schedule a message
 * POST /api/messages/schedule
 */
messages.post('/schedule', async (c) => {
  const merchantId = c.get('merchantId');
  const body = await c.req.json();

  const {
    userId,
    orderId,
    messageType,
    scheduledFor,
    messageTemplate,
  } = body;

  if (!userId || !messageType || !scheduledFor) {
    return c.json(
      {
        error: 'userId, messageType, and scheduledFor are required',
      },
      400
    );
  }

  const validTypes = ['welcome', 'checkin_t3', 'checkin_t14', 'upsell'];
  if (!validTypes.includes(messageType)) {
    return c.json(
      {
        error: `messageType must be one of: ${validTypes.join(', ')}`,
      },
      400
    );
  }

  try {
    const scheduledForDate = new Date(scheduledFor);
    if (isNaN(scheduledForDate.getTime())) {
      return c.json({ error: 'Invalid scheduledFor date' }, 400);
    }

    const result = await scheduleUserMessage({
      userId,
      orderId,
      merchantId,
      messageType,
      scheduledFor: scheduledForDate,
      messageTemplate,
    });

    return c.json({
      message: 'Message scheduled successfully',
      taskId: result.taskId,
      jobId: result.jobId,
    }, 201);
  } catch (error) {
    console.error('Schedule message error:', error);
    return c.json(
      {
        error: 'Failed to schedule message',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Schedule post-delivery messages for an order
 * POST /api/messages/schedule-order
 */
messages.post('/schedule-order', async (c) => {
  const merchantId = c.get('merchantId');
  const body = await c.req.json();

  const { orderId, deliveryDate } = body;

  if (!orderId || !deliveryDate) {
    return c.json(
      {
        error: 'orderId and deliveryDate are required',
      },
      400
    );
  }

  try {
    const deliveryDateObj = new Date(deliveryDate);
    if (isNaN(deliveryDateObj.getTime())) {
      return c.json({ error: 'Invalid deliveryDate' }, 400);
    }

    const result = await scheduleOrderMessages(orderId, merchantId, deliveryDateObj);

    return c.json({
      message: 'Order messages scheduled successfully',
      tasks: result.tasks,
    }, 201);
  } catch (error) {
    console.error('Schedule order messages error:', error);
    return c.json(
      {
        error: 'Failed to schedule order messages',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Cancel scheduled messages for an order
 * POST /api/messages/cancel-order
 */
messages.post('/cancel-order', async (c) => {
  const merchantId = c.get('merchantId');
  const body = await c.req.json();

  const { orderId } = body;

  if (!orderId) {
    return c.json({ error: 'orderId is required' }, 400);
  }

  try {
    const result = await cancelOrderMessages(orderId);

    return c.json({
      message: 'Messages cancelled successfully',
      cancelled: result.cancelled,
    });
  } catch (error) {
    console.error('Cancel messages error:', error);
    return c.json(
      {
        error: 'Failed to cancel messages',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Get scheduled messages for a user
 * GET /api/messages/user/:userId
 */
messages.get('/user/:userId', async (c) => {
  const merchantId = c.get('merchantId');
  const userId = c.req.param('userId');

  try {
    const tasks = await getUserScheduledMessages(userId, merchantId);

    return c.json({
      userId,
      tasks,
      count: tasks.length,
    });
  } catch (error) {
    console.error('Get scheduled messages error:', error);
    return c.json(
      {
        error: 'Failed to get scheduled messages',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default messages;
