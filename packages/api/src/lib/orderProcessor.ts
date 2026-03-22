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
import { normalizeAndHashPhone } from './phoneLookup.js';
import { sendDeliveryTemplate } from './deliveryTemplateService.js';

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
    const { normalizedPhone, phoneLookupHash } = normalizeAndHashPhone(event.customer.phone);
    // Encrypt phone
    const encryptedPhone = encryptPhone(normalizedPhone);
    let existingUser: { id: string; phoneLookupHash?: string | null } | null = null;

    const { data: hashedUser, error: hashedLookupError } = await serviceClient
      .from('users')
      .select('id, phone_lookup_hash')
      .eq('merchant_id', event.merchant_id)
      .eq('phone_lookup_hash', phoneLookupHash)
      .single();

    if (!hashedLookupError && hashedUser) {
      existingUser = hashedUser as { id: string; phone_lookup_hash?: string | null };
    }

    // Backward compatibility for old rows without hash or before migration rollout.
    if (!existingUser) {
      const { data: merchantUsers } = await serviceClient
        .from('users')
        .select('id, phone, phone_lookup_hash')
        .eq('merchant_id', event.merchant_id)
        .limit(5000);

      for (const row of (merchantUsers || []) as Array<{ id: string; phone: string; phone_lookup_hash?: string | null }>) {
        try {
          const candidate = normalizePhone(decryptPhone(row.phone));
          if (candidate === normalizedPhone) {
            existingUser = { id: row.id, phoneLookupHash: row.phone_lookup_hash ?? null };
            // Best-effort hash backfill.
            if (!row.phone_lookup_hash) {
              void serviceClient
                .from('users')
                .update({ phone_lookup_hash: phoneLookupHash })
                .eq('id', row.id)
                .eq('merchant_id', event.merchant_id);
            }
            break;
          }
        } catch {
          continue;
        }
      }
    }

    if (existingUser) {
      userId = existingUser.id;

      // Update user name and consent when provided (sync from Shopify)
      const updatePayload: {
        name?: string;
        consent_status?: string;
        phone_lookup_hash?: string;
        email?: string | null;
        shopify_customer_id?: string | null;
      } = {};
      if (event.customer.name) updatePayload.name = event.customer.name;
      if (event.consent_status) updatePayload.consent_status = event.consent_status;
      if (event.customer.email) updatePayload.email = event.customer.email;
      if (event.customer.shopify_customer_id) updatePayload.shopify_customer_id = event.customer.shopify_customer_id;
      if (!existingUser.phoneLookupHash) updatePayload.phone_lookup_hash = phoneLookupHash;
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
          phone_lookup_hash: phoneLookupHash,
          name: event.customer.name || null,
          email: event.customer.email || null,
          shopify_customer_id: event.customer.shopify_customer_id || null,
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
          }, `welcome-${orderId}`);
          logger.info({ orderId }, 'Queued T+0 welcome message for order');
        } catch (error) {
          logger.error({ error, orderId }, 'Failed to queue T+0 welcome message');
        }
      }

      // Send delivery template (Twilio WhatsApp HSM)
      if (event.customer?.phone) {
        try {
          await sendDeliveryTemplate({
            merchantId: event.merchant_id,
            userId,
            orderId,
            customerPhone: event.customer.phone,
            customerFirstName: event.customer.name?.split(' ')[0] || '',
            locale: event.customer_locale,
            items: event.items ?? [],
          });
        } catch (error) {
          logger.error({ error, orderId }, 'Failed to send delivery template');
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
