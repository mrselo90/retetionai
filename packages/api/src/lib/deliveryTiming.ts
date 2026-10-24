/**
 * When an order counts as delivered.
 *
 * Shopify's orders/fulfilled means the order was handed to the carrier, not
 * that the customer has it. It used to start the post-delivery flow (welcome
 * message, usage tips, delivery template) at once, so customers were asked
 * about a product still in transit. Now:
 * - orders/fulfilled makes the order 'shipped' and queues a fallback
 *   "delivered" event DELIVERY_FALLBACK_DAYS later, for carriers that never
 *   report delivery to Shopify;
 * - a fulfillment event with status 'delivered' (carrier tracking, or the
 *   merchant marking it delivered) starts the flow at once;
 * - whichever comes first wins: the order is then 'delivered', and
 *   nextOrderStatus() keeps the later one from starting the flow again. A
 *   cancelled order is never moved to delivered.
 */
import { getShopifyAccessToken, getSupabaseServiceClient, logger } from '@recete/shared';
import { generateIdempotencyKey, type NormalizedEvent } from './events.js';
import { addCommerceEventJob } from '../queues.js';
import { shopifyGraphql } from './shopifyIntegrationLookup.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days after shipping to assume delivery when the carrier reports nothing. */
export function deliveryFallbackDays(): number {
  const days = Number(process.env.DELIVERY_FALLBACK_DAYS);
  return Number.isFinite(days) && days > 0 ? days : 4;
}

type OrderStatus = 'created' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | string;
const PROGRESS: Record<string, number> = { created: 0, shipped: 1, delivered: 2 };

/**
 * The status an order moves to. Events can arrive late or twice (webhook
 * retries, the fallback after a real delivery), so an order never moves back
 * (delivered stays delivered when "shipped" arrives) and a cancelled or
 * returned order keeps that status. Returned follows delivered.
 */
export function nextOrderStatus(current: OrderStatus | null | undefined, incoming: OrderStatus): OrderStatus {
  if (!current) return incoming;
  if (current === 'cancelled' || current === 'returned') return current;
  if (incoming === 'cancelled' || incoming === 'returned') return incoming;
  const from = PROGRESS[current];
  const to = PROGRESS[incoming];
  if (from === undefined || to === undefined) return incoming;
  return to >= from ? incoming : current;
}

/** The delivered event for a shipped order, DELIVERY_FALLBACK_DAYS after shipping. */
export function estimatedDeliveryEvent(shipped: NormalizedEvent, now = new Date()): NormalizedEvent {
  const shippedAt = Date.parse(shipped.order?.shipped_at || shipped.occurred_at) || now.getTime();
  const deliveredAt = new Date(shippedAt + deliveryFallbackDays() * DAY_MS).toISOString();
  return {
    ...shipped,
    event_type: 'order_delivered',
    occurred_at: deliveredAt,
    order: { ...shipped.order, status: 'delivered', delivered_at: deliveredAt, delivery_source: 'estimated' },
  };
}

/** The delivered event a carrier reported, built on what we stored for the order. */
export function carrierDeliveryEvent(stored: NormalizedEvent, happenedAt: string): NormalizedEvent {
  return {
    ...stored,
    event_type: 'order_delivered',
    occurred_at: happenedAt,
    order: { ...stored.order, status: 'delivered', delivered_at: happenedAt, delivery_source: 'carrier' },
  };
}

/** Stores an event and queues it for processing, now or after `delayMs`. */
async function storeAndQueue(event: NormalizedEvent, uniqueId: string, delayMs = 0) {
  const serviceClient = getSupabaseServiceClient();
  const { data: row, error } = await serviceClient
    .from('external_events')
    .insert({
      merchant_id: event.merchant_id,
      integration_id: event.integration_id ?? null,
      source: event.source,
      event_type: event.event_type,
      payload: event as any,
      idempotency_key: generateIdempotencyKey(
        event.source,
        event.event_type,
        event.external_order_id,
        event.occurred_at,
        uniqueId
      ),
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return { queued: false as const, reason: 'duplicate' };
    throw new Error(`Failed to store ${event.event_type} event: ${error.message}`);
  }
  await addCommerceEventJob({ externalEventId: row.id, merchantId: event.merchant_id }, { delayMs });
  return { queued: true as const };
}

/** On shipping: the fallback that marks the order delivered if the carrier never does. */
export async function queueDeliveryFallback(shipped: NormalizedEvent) {
  const event = estimatedDeliveryEvent(shipped);
  const delayMs = Math.max(Date.parse(event.occurred_at) - Date.now(), 0);
  // The same id for every replay of the shipped webhook: one fallback per order.
  const result = await storeAndQueue(event, 'delivery-fallback', delayMs);
  logger.info(
    { merchantId: shipped.merchant_id, externalOrderId: shipped.external_order_id, deliverAt: event.occurred_at, ...result },
    'Delivery fallback queued'
  );
  return result;
}

const ORDER_NAME_QUERY = `query OrderName($id: ID!) { order(id: $id) { name } }`;

/**
 * fulfillment_events/create: a carrier (or the merchant) reported progress on
 * a shipment. Only 'delivered' matters here. The payload has Shopify's order
 * id but not the order name we store orders by, so the name comes from Shopify.
 */
export async function handleFulfillmentEventWebhook(input: {
  integration: { id: string; merchant_id: string; auth_data: unknown };
  body: { id?: number | string; status?: string; happened_at?: string; order_id?: number | string };
}): Promise<{ result: string }> {
  const { integration, body } = input;
  if (String(body.status || '').toLowerCase() !== 'delivered') return { result: 'ignored_status' };
  if (!body.order_id) return { result: 'ignored_no_order' };

  const credentials = await getShopifyAccessToken(integration);
  const response = await shopifyGraphql<{ order: { name: string } | null }>(
    credentials.shop,
    credentials.accessToken,
    ORDER_NAME_QUERY,
    { id: `gid://shopify/Order/${body.order_id}` },
    10_000
  );
  const orderName = response.data?.order?.name;
  if (!orderName) return { result: 'ignored_unknown_order' };

  // What we stored for this order (customer, items, locale) when it came in.
  const { data: rows } = await getSupabaseServiceClient()
    .from('external_events')
    .select('payload')
    .eq('merchant_id', integration.merchant_id)
    .contains('payload', { external_order_id: orderName } as any)
    .in('event_type', ['order_created', 'order_shipped', 'order_updated'])
    .order('received_at', { ascending: false })
    .limit(1);
  const stored = rows?.[0]?.payload as NormalizedEvent | undefined;
  if (!stored) return { result: 'ignored_order_not_seen' };

  const happenedAt = body.happened_at || new Date().toISOString();
  const result = await storeAndQueue(carrierDeliveryEvent(stored, happenedAt), `fulfillment-event-${body.id ?? happenedAt}`);
  return { result: result.queued ? 'delivered_queued' : 'duplicate' };
}
