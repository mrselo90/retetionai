/**
 * Event processing routes
 * Manual trigger for processing external events
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { processExternalEvents } from '../lib/orderProcessor';

const events = new Hono();

// All routes require authentication
events.use('/*', authMiddleware);

/**
 * Process external events (manual trigger)
 * POST /api/events/process
 * Processes unprocessed events from external_events table
 */
events.post('/process', async (c) => {
  try {
    const body = await c.req.json();
    const limit = body.limit || 100;

    const result = await processExternalEvents(limit);

    return c.json({
      message: 'Event processing completed',
      processed: result.processed,
      errors: result.errors,
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default events;
