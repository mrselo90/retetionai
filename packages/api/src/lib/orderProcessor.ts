/**
 * Order and User processor
 * Processes normalized events and upserts to orders/users tables
 */

import { getSupabaseServiceClient, logger } from '@recete/shared';
import { decryptPhone, encryptPhone } from './encryption.js';
import type { NormalizedEvent } from './events.js';
import { generateIdempotencyKey, normalizePhone } from './events.js';
import { scheduleOrderMessages } from './messageScheduler.js';
import { scheduleMessage } from '../queues.js';

/**
 * Process normalized event and upsert order/user
 */
export async function processNormalizedEvent(event: NormalizedEvent): Promise<{
  userId: string;
  orderId: string;
  created: boolean;
}> {
  const serviceClient = getSupabaseServiceClient();

  // Direct/manual callers may bypass the webhook ingestion path that persists external_events.
  // Shadow-write the normalized event so order-scoped product context (RAG) can resolve items later.
  try {
    const idempotencyKey = generateIdempotencyKey(
      event.source,
      event.event_type,
      event.external_order_id,
      event.occurred_at
    );

    const { error: shadowInsertError } = await serviceClient
      .from('external_events')
      .insert({
        merchant_id: event.merchant_id,
        integration_id: event.integration_id ?? null,
        source: event.source,
        event_type: event.event_type,
        payload: event as any,
        idempotency_key: idempotencyKey,
      });

    if (shadowInsertError && shadowInsertError.code !== '23505') {
      logger.warn(
        { err: shadowInsertError, merchantId: event.merchant_id, externalOrderId: event.external_order_id },
        'Failed to shadow-store normalized event'
      );
    }
  } catch (error) {
    logger.warn(
      { err: error, merchantId: event.merchant_id, externalOrderId: event.external_order_id },
      'Failed to shadow-store normalized event'
    );
  }

  // Step 1: Upsert user (by merchant_id + phone)
  let userId: string;

  if (event.customer?.phone) {
    const normalizedPhone = normalizePhone(event.customer.phone);
    // Encrypt phone
    const encryptedPhone = encryptPhone(normalizedPhone);

    // Phone is encrypted with random IV; compare by decrypting merchant users.
    const { data: merchantUsers } = await serviceClient
      .from('users')
      .select('id, phone')
      .eq('merchant_id', event.merchant_id)
      .limit(5000);

    let existingUser: { id: string } | null = null;
    for (const row of (merchantUsers || []) as Array<{ id: string; phone: string }>) {
      try {
        const candidate = normalizePhone(decryptPhone(row.phone));
        if (candidate === normalizedPhone) {
          existingUser = { id: row.id };
          break;
        }
      } catch {
        continue;
      }
    }

    if (existingUser) {
      userId = existingUser.id;

      // Update user name and consent when provided (sync from Shopify)
      const updatePayload: { name?: string; consent_status?: string } = {};
      if (event.customer.name) updatePayload.name = event.customer.name;
      if (event.consent_status) updatePayload.consent_status = event.consent_status;
      if (Object.keys(updatePayload).length > 0) {
        await serviceClient
          .from('users')
          .update(updatePayload)
          .eq('id', userId);
      }
    } else {
      // Create new user
      const { data: newUser, error: userError } = await serviceClient
        .from('users')
        .insert({
          merchant_id: event.merchant_id,
          phone: encryptedPhone,
          name: event.customer.name || null,
          consent_status: event.consent_status || 'pending',
        })
        .select('id')
        .single();

      if (userError) {
        throw new Error(`Failed to create user: ${userError.message}`);
      }

      userId = newUser.id;
    }
  } else {
    // No phone provided - cannot create user
    throw new Error('Phone number is required to process event');
  }

  // Step 2: Upsert order (by merchant_id + external_order_id)
  const { data: existingOrder } = await serviceClient
    .from('orders')
    .select('id')
    .eq('merchant_id', event.merchant_id)
    .eq('external_order_id', event.external_order_id)
    .single();

  let orderId: string;
  let created = false;

  // Map event order status to order status
  const statusMap: Record<string, string> = {
    order_created: 'created',
    order_delivered: 'delivered',
    order_cancelled: 'cancelled',
    order_returned: 'returned',
    order_updated: event.order?.status || 'created',
  };

  const orderStatus = statusMap[event.event_type] || 'created';

  if (existingOrder) {
    // Update existing order
    orderId = existingOrder.id;

    const updateData: any = {
      status: orderStatus,
      user_id: userId, // Update user_id in case it changed
    };

    if (event.order?.delivered_at) {
      updateData.delivery_date = new Date(event.order.delivered_at);
    }

    await serviceClient
      .from('orders')
      .update(updateData)
      .eq('id', orderId);
  } else {
    // Create new order
    const { data: newOrder, error: orderError } = await serviceClient
      .from('orders')
      .insert({
        merchant_id: event.merchant_id,
        user_id: userId,
        external_order_id: event.external_order_id,
        status: orderStatus,
        delivery_date: event.order?.delivered_at
          ? new Date(event.order.delivered_at)
          : null,
      })
      .select('id')
      .single();

    if (orderError) {
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    orderId = newOrder.id;
    created = true;
  }

  // Schedule post-delivery messages only when user has marketing consent (GDPR/KVKK)
  if (orderStatus === 'delivered' && event.order?.delivered_at) {
    const { data: user } = await serviceClient
      .from('users')
      .select('consent_status')
      .eq('id', userId)
      .eq('merchant_id', event.merchant_id)
      .single();

    if (user?.consent_status === 'opt_in') {
      try {
        const deliveryDate = new Date(event.order.delivered_at);
        await scheduleOrderMessages(orderId, event.merchant_id, deliveryDate);
        logger.info({ orderId }, 'Scheduled post-delivery messages for order');
      } catch (error) {
        logger.error({ error, orderId }, 'Failed to schedule post-delivery messages');
        // Don't fail the order processing if message scheduling fails
      }
      // T+0 welcome: beauty consultant message with product usage instructions (worker builds prompt)
      const productIds = (event.items ?? [])
        .map((i) => i.external_product_id)
        .filter((id): id is string => Boolean(id));
      const productNames = (event.items ?? [])
        .map((i) => (typeof i.name === 'string' ? i.name.trim() : ''))
        .filter(Boolean);
      if (event.customer?.phone && productIds.length >= 0) {
        try {
          await scheduleMessage({
            type: 'welcome',
            userId,
            orderId,
            merchantId: event.merchant_id,
            to: event.customer.phone,
            scheduledFor: new Date().toISOString(),
            productIds: productIds.length > 0 ? productIds : undefined,
            productNames: productNames.length > 0 ? productNames : undefined,
          });
          logger.info({ orderId }, 'Queued T+0 welcome message for order');
        } catch (error) {
          logger.error({ error, orderId }, 'Failed to queue T+0 welcome message');
        }
      }
    } else {
      logger.info(
        { orderId, userId, consent_status: user?.consent_status ?? 'pending' },
        'Skipped scheduling post-delivery messages: no marketing consent'
      );
    }
  }

  return { userId, orderId, created };
}

/**
 * Process events from external_events table (worker function)
 * Processes unprocessed events and creates/updates orders and users
 */
export async function processExternalEvents(limit: number = 100): Promise<{
  processed: number;
  errors: number;
}> {
  const serviceClient = getSupabaseServiceClient();

  // Get unprocessed events (events that don't have corresponding orders yet)
  // For MVP, we'll process all events. Later we can add a processed_at field.
  const { data: events, error: fetchError } = await serviceClient
    .from('external_events')
    .select('id, merchant_id, integration_id, source, event_type, payload, received_at')
    .order('received_at', { ascending: true })
    .limit(limit);

  if (fetchError) {
    throw new Error(`Failed to fetch events: ${fetchError.message}`);
  }

  if (!events || events.length === 0) {
    return { processed: 0, errors: 0 };
  }

  let processed = 0;
  let errors = 0;

  for (const event of events) {
    try {
      const normalizedEvent = event.payload as NormalizedEvent;
      normalizedEvent.merchant_id = event.merchant_id;
      normalizedEvent.integration_id = event.integration_id;
      normalizedEvent.source = event.source;

      await processNormalizedEvent(normalizedEvent);
      processed++;
    } catch (error) {
      console.error(`Error processing event ${event.id}:`, error);
      errors++;
      // Continue processing other events
    }
  }

  return { processed, errors };
}
