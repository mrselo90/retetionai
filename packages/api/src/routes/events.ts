/**
 * Event processing routes
 * Manual trigger for processing external events
 */

import { Context, Hono, Next } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseServiceClient } from '@recete/shared';
import { processExternalEvents, processNormalizedEvent } from '../lib/orderProcessor.js';

const events = new Hono();

async function requireInternalSecretOrSuperAdmin(c: Context, next: Next) {
  const providedSecret = c.req.header('X-Internal-Secret')?.trim() || '';
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET?.trim() || '';

  // Internal service path: allow with valid shared secret
  if (providedSecret) {
    if (!expectedSecret) {
      return c.json({ error: 'Internal auth is not configured' }, 500);
    }
    if (providedSecret !== expectedSecret) {
      return c.json({ error: 'Forbidden: Invalid internal secret' }, 403);
    }

    c.set('authMethod', 'internal');
    c.set('merchantId', 'internal-system');
    c.set('user', { merchantId: 'internal-system', authMethod: 'internal' });
    await next();
    return;
  }

  // Fallback path: require normal auth first
  let authPassed = false;
  const authResult = await authMiddleware(c, async () => {
    authPassed = true;
  });
  if (!authPassed) {
    return authResult;
  }

  const merchantId = c.get('merchantId');
  if (!merchantId) {
    return c.json({ error: 'Unauthorized: Missing authentication context' }, 401);
  }

  // Require super admin for queue-wide processing
  const supabase = getSupabaseServiceClient();
  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('is_super_admin')
    .eq('id', merchantId)
    .single();

  if (error || !merchant) {
    return c.json({ error: 'Forbidden: Cannot verify admin status' }, 403);
  }

  if (merchant.is_super_admin !== true) {
    return c.json({ error: 'Forbidden: Requires Super Admin or internal secret' }, 403);
  }

  await next();
}

/**
 * Process external events (manual trigger)
 * POST /api/events/process
 * Processes unprocessed events from external_events table
 */
events.post('/process', requireInternalSecretOrSuperAdmin, async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as { limit?: unknown };
    const limit = typeof body.limit === 'number' && Number.isFinite(body.limit) ? body.limit : 100;

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

/**
 * Process a single stored external event by id
 * POST /api/events/:id/process
 */
events.post('/:id/process', requireInternalSecretOrSuperAdmin, async (c) => {
  try {
    const eventId = c.req.param('id');
    const merchantIdHeader = c.req.header('X-Internal-Merchant-Id')?.trim() || '';
    const supabase = getSupabaseServiceClient();

    let query = supabase
      .from('external_events')
      .select('id, merchant_id, payload')
      .eq('id', eventId);

    if (merchantIdHeader && merchantIdHeader !== 'internal-system') {
      query = query.eq('merchant_id', merchantIdHeader);
    }

    const { data: eventRow, error } = await query.single();

    if (error || !eventRow?.payload) {
      return c.json({ error: 'Event not found' }, 404);
    }

    await processNormalizedEvent(eventRow.payload as any);

    return c.json({
      message: 'Event processed',
      eventId: eventRow.id,
      merchantId: eventRow.merchant_id,
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default events;
