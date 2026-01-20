/**
 * Order and User processor
 * Processes normalized events and upserts to orders/users tables
 */

import { getSupabaseServiceClient } from '@glowguide/shared';
import { encryptPhone } from './encryption';
import type { NormalizedEvent } from './events';
import { scheduleOrderMessages } from './messageScheduler';

/**
 * Process normalized event and upsert order/user
 */
export async function processNormalizedEvent(event: NormalizedEvent): Promise<{
  userId: string;
  orderId: string;
  created: boolean;
}> {
  const serviceClient = getSupabaseServiceClient();

  // Step 1: Upsert user (by merchant_id + phone)
  let userId: string;

  if (event.customer?.phone) {
    // Encrypt phone
    const encryptedPhone = encryptPhone(event.customer.phone);

    // Check if user exists
    const { data: existingUser } = await serviceClient
      .from('users')
      .select('id')
      .eq('merchant_id', event.merchant_id)
      .eq('phone', encryptedPhone)
      .single();

    if (existingUser) {
      userId = existingUser.id;

      // Update user name if provided and different
      if (event.customer.name) {
        await serviceClient
          .from('users')
          .update({ name: event.customer.name })
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

  // Schedule post-delivery messages if order is delivered
  if (orderStatus === 'delivered' && event.order?.delivered_at) {
    try {
      const deliveryDate = new Date(event.order.delivered_at);
      await scheduleOrderMessages(orderId, event.merchant_id, deliveryDate);
      console.log(`✅ Scheduled post-delivery messages for order ${orderId}`);
    } catch (error) {
      console.error('Failed to schedule post-delivery messages:', error);
      // Don't fail the order processing if message scheduling fails
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
