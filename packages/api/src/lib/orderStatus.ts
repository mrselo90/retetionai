/**
 * Order status for "where is my order?" (WISMO) messages.
 *
 * Only the conversation's own order is looked up: the order the conversation
 * belongs to, never an order number the customer types (that would let anyone
 * read someone else's shipment by guessing numbers). Shopify is read live for
 * fulfillment and tracking; without a Shopify connection, or when Shopify
 * fails, the stored order row is used, which only knows cancelled/fulfilled.
 */
import { getSupabaseServiceClient, logger } from '@recete/shared';
import { shopifyCredentialsForMerchant, shopifyGraphql } from './shopifyIntegrationLookup.js';

export type OrderShipmentState =
  | 'cancelled'
  | 'returned'
  | 'not_shipped'
  | 'preparing'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'attempted_delivery'
  | 'delayed'
  | 'delivery_problem'
  | 'delivered'
  | 'unknown';

export interface OrderTracking {
  company: string | null;
  number: string | null;
  url: string | null;
}

export interface OrderStatusSnapshot {
  orderName: string;
  placedAt: string | null;
  state: OrderShipmentState;
  /** Some items shipped, others not yet. */
  partial: boolean;
  shippedAt: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  tracking: OrderTracking[];
  source: 'shopify' | 'stored';
}

// Validated against Admin GraphQL 2026-10; needs read_orders.
const ORDER_STATUS_QUERY = `query OrderStatus($query: String!) {
  orders(first: 1, query: $query) {
    nodes {
      name
      createdAt
      cancelledAt
      displayFulfillmentStatus
      fulfillments(first: 5) {
        displayStatus
        createdAt
        inTransitAt
        deliveredAt
        estimatedDeliveryAt
        trackingInfo(first: 3) {
          company
          number
          url
        }
      }
    }
  }
}`;

interface ShopifyFulfillment {
  displayStatus: string | null;
  createdAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  estimatedDeliveryAt: string | null;
  trackingInfo: OrderTracking[] | null;
}

export interface ShopifyOrderStatusNode {
  name: string;
  createdAt: string | null;
  cancelledAt: string | null;
  displayFulfillmentStatus: string | null;
  fulfillments: ShopifyFulfillment[] | null;
}

// FulfillmentDisplayStatus. A printed label or a submitted fulfillment request
// has not reached the carrier yet, so it is "preparing", not "shipped".
const FULFILLMENT_STATE: Record<string, OrderShipmentState> = {
  DELIVERED: 'delivered',
  PICKED_UP: 'delivered',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  IN_TRANSIT: 'in_transit',
  CARRIER_PICKED_UP: 'in_transit',
  ATTEMPTED_DELIVERY: 'attempted_delivery',
  DELAYED: 'delayed',
  READY_FOR_PICKUP: 'ready_for_pickup',
  FAILURE: 'delivery_problem',
  NOT_DELIVERED: 'delivery_problem',
  FULFILLED: 'shipped',
  MARKED_AS_FULFILLED: 'shipped',
  CONFIRMED: 'preparing',
  SUBMITTED: 'preparing',
  LABEL_PRINTED: 'preparing',
  LABEL_PURCHASED: 'preparing',
};
const VOID_FULFILLMENT = new Set(['CANCELED', 'LABEL_VOIDED']);

const time = (value: string | null | undefined) => (value ? Date.parse(value) || 0 : 0);

export function snapshotFromShopifyOrder(order: ShopifyOrderStatusNode): OrderStatusSnapshot {
  const base: OrderStatusSnapshot = {
    orderName: order.name,
    placedAt: order.createdAt,
    state: 'unknown',
    partial: false,
    shippedAt: null,
    estimatedDeliveryAt: null,
    deliveredAt: null,
    tracking: [],
    source: 'shopify',
  };
  if (order.cancelledAt) return { ...base, state: 'cancelled' };

  const fulfillments = (order.fulfillments || [])
    .filter((item) => !VOID_FULFILLMENT.has(String(item.displayStatus || '')))
    .sort((a, b) => time(b.createdAt) - time(a.createdAt));
  const tracking = fulfillments
    .flatMap((item) => item.trackingInfo || [])
    .filter((item) => item.number || item.url);
  const orderLevel = String(order.displayFulfillmentStatus || '');
  const partial = orderLevel === 'PARTIALLY_FULFILLED';

  const latest = fulfillments[0];
  if (!latest) {
    return { ...base, state: orderLevel === 'FULFILLED' ? 'shipped' : 'not_shipped', partial };
  }
  return {
    ...base,
    state: FULFILLMENT_STATE[String(latest.displayStatus || '')] || 'shipped',
    partial,
    shippedAt: latest.inTransitAt || latest.createdAt,
    estimatedDeliveryAt: latest.estimatedDeliveryAt,
    deliveredAt: latest.deliveredAt,
    tracking,
  };
}

/** Shopify search by order name, quoted so "#1001" is one term. */
export function shopifyOrderNameQuery(orderName: string): string {
  return `name:${JSON.stringify(orderName)}`;
}

// The stored status comes from webhooks: 'shipped' on orders/fulfilled,
// 'delivered' from a carrier's delivered event or the delivery fallback
// (deliveryTiming.ts).
function snapshotFromStoredOrder(row: {
  external_order_id: string;
  status: string | null;
  created_at: string | null;
}): OrderStatusSnapshot {
  const status = String(row.status || '').toLowerCase();
  return {
    orderName: row.external_order_id,
    placedAt: row.created_at,
    state:
      status === 'cancelled' || status === 'returned' || status === 'shipped' || status === 'delivered'
        ? status
        : 'unknown',
    partial: false,
    shippedAt: null,
    estimatedDeliveryAt: null,
    deliveredAt: null,
    tracking: [],
    source: 'stored',
  };
}

/**
 * The conversation's order status, or null when the order isn't found for this
 * merchant.
 */
export async function getOrderStatusSnapshot(input: {
  merchantId: string;
  orderId: string;
}): Promise<OrderStatusSnapshot | null> {
  const client = getSupabaseServiceClient();
  const { data: row } = await client
    .from('orders')
    .select('external_order_id, status, created_at')
    .eq('id', input.orderId)
    .eq('merchant_id', input.merchantId)
    .maybeSingle();
  if (!row?.external_order_id) return null;

  try {
    const credentials = await shopifyCredentialsForMerchant(client, input.merchantId);
    if (credentials) {
      const result = await shopifyGraphql<{ orders: { nodes: ShopifyOrderStatusNode[] } }>(
        credentials.shop,
        credentials.accessToken,
        ORDER_STATUS_QUERY,
        { query: shopifyOrderNameQuery(row.external_order_id) },
        8_000,
      );
      if (result.errors?.length) throw new Error(result.errors[0].message);
      // Search is fuzzy; only the exact order counts.
      const order = result.data?.orders.nodes.find((node) => node.name === row.external_order_id);
      if (order) return snapshotFromShopifyOrder(order);
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error), merchantId: input.merchantId },
      '[order-status] Could not read the order from Shopify; using the stored status',
    );
  }
  return snapshotFromStoredOrder(row);
}

const STATE_TEXT: Record<OrderShipmentState, string> = {
  cancelled: 'Cancelled',
  returned: 'Returned',
  not_shipped: 'Not shipped yet (the store is preparing the order)',
  preparing: 'Being prepared for shipping (not yet with the carrier)',
  shipped: 'Shipped (handed to the carrier)',
  in_transit: 'In transit with the carrier',
  out_for_delivery: 'Out for delivery today',
  ready_for_pickup: 'Ready for pickup',
  attempted_delivery: 'Delivery was attempted but not completed',
  delayed: 'Delayed by the carrier',
  delivery_problem: 'The carrier reports a delivery problem',
  delivered: 'Delivered',
  unknown: 'Not known',
};

const day = (value: string | null) => (value ? value.slice(0, 10) : null);

/** The facts the model may state, in plain lines. */
export function formatOrderStatusEvidence(snapshot: OrderStatusSnapshot): string {
  const lines = [`Order: ${snapshot.orderName}${snapshot.placedAt ? ` (placed ${day(snapshot.placedAt)})` : ''}`];
  lines.push(`Status: ${STATE_TEXT[snapshot.state]}${snapshot.partial ? '; some items of the order are not shipped yet' : ''}`);
  if (snapshot.shippedAt && snapshot.state !== 'not_shipped') lines.push(`Shipped on: ${day(snapshot.shippedAt)}`);
  if (snapshot.deliveredAt) lines.push(`Delivered on: ${day(snapshot.deliveredAt)}`);
  if (snapshot.estimatedDeliveryAt && snapshot.state !== 'delivered') {
    lines.push(`Estimated delivery (carrier estimate): ${day(snapshot.estimatedDeliveryAt)}`);
  }
  for (const item of snapshot.tracking.slice(0, 3)) {
    const parts = [
      item.company ? `carrier ${item.company}` : null,
      item.number ? `tracking number ${item.number}` : null,
      item.url ? `tracking link ${item.url}` : null,
    ].filter(Boolean);
    lines.push(`Tracking: ${parts.join(', ')}`);
  }
  lines.push(
    snapshot.source === 'shopify'
      ? 'Source: the store system, checked just now.'
      : 'Source: the store\'s order records; shipping details (carrier, tracking, dates) are not available.',
  );
  return lines.join('\n');
}
