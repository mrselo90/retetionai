import { beforeEach, describe, expect, it, vi } from 'vitest';

let orderRow: Record<string, unknown> | null = null;
let credentials: { shop: string; accessToken: string } | null = null;
const shopifyGraphql = vi.fn();

vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: orderRow, error: null }) }),
        }),
      }),
    }),
  })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('./shopifyIntegrationLookup.js', () => ({
  shopifyCredentialsForMerchant: vi.fn(async () => credentials),
  shopifyGraphql: (...args: unknown[]) => shopifyGraphql(...args),
}));

import {
  formatOrderStatusEvidence,
  getOrderStatusSnapshot,
  shopifyOrderNameQuery,
  snapshotFromShopifyOrder,
  type ShopifyOrderStatusNode,
} from './orderStatus';

const order = (patch: Partial<ShopifyOrderStatusNode>): ShopifyOrderStatusNode => ({
  name: '#1001',
  createdAt: '2026-10-20T09:00:00Z',
  cancelledAt: null,
  displayFulfillmentStatus: 'FULFILLED',
  fulfillments: [],
  ...patch,
});
const fulfillment = (displayStatus: string, patch: Record<string, unknown> = {}) => ({
  displayStatus,
  createdAt: '2026-10-21T10:00:00Z',
  inTransitAt: null,
  deliveredAt: null,
  estimatedDeliveryAt: null,
  trackingInfo: [],
  ...patch,
});

describe('snapshotFromShopifyOrder', () => {
  it('reports a cancelled order as cancelled, whatever was shipped', () => {
    const snapshot = snapshotFromShopifyOrder(order({ cancelledAt: '2026-10-21T00:00:00Z', fulfillments: [fulfillment('IN_TRANSIT')] }));
    expect(snapshot.state).toBe('cancelled');
  });

  it('reports an order without fulfillments as not shipped', () => {
    expect(snapshotFromShopifyOrder(order({ displayFulfillmentStatus: 'UNFULFILLED' })).state).toBe('not_shipped');
  });

  it('uses the latest fulfillment, its dates and all tracking', () => {
    const snapshot = snapshotFromShopifyOrder(
      order({
        fulfillments: [
          fulfillment('DELIVERED', { createdAt: '2026-10-19T00:00:00Z', trackingInfo: [{ company: 'Carrier A', number: 'TEST-1', url: null }] }),
          fulfillment('IN_TRANSIT', {
            inTransitAt: '2026-10-22T08:00:00Z',
            estimatedDeliveryAt: '2026-10-25T00:00:00Z',
            trackingInfo: [{ company: 'Carrier B', number: 'TEST-2', url: 'https://track.example.test/TEST-2' }],
          }),
        ],
      }),
    );
    expect(snapshot).toMatchObject({
      state: 'in_transit',
      shippedAt: '2026-10-22T08:00:00Z',
      estimatedDeliveryAt: '2026-10-25T00:00:00Z',
      source: 'shopify',
    });
    expect(snapshot.tracking.map((item) => item.number)).toEqual(['TEST-2', 'TEST-1']); // latest shipment first
  });

  it('does not call a printed label shipped, and ignores cancelled fulfillments', () => {
    const snapshot = snapshotFromShopifyOrder(
      order({
        displayFulfillmentStatus: 'PARTIALLY_FULFILLED',
        fulfillments: [fulfillment('LABEL_PRINTED'), fulfillment('CANCELED', { createdAt: '2026-10-23T00:00:00Z' })],
      }),
    );
    expect(snapshot.state).toBe('preparing');
    expect(snapshot.partial).toBe(true);
  });

  it('maps carrier problems', () => {
    expect(snapshotFromShopifyOrder(order({ fulfillments: [fulfillment('NOT_DELIVERED')] })).state).toBe('delivery_problem');
    expect(snapshotFromShopifyOrder(order({ fulfillments: [fulfillment('ATTEMPTED_DELIVERY')] })).state).toBe('attempted_delivery');
  });
});

describe('formatOrderStatusEvidence', () => {
  it('lists the facts the model may state', () => {
    const text = formatOrderStatusEvidence(
      snapshotFromShopifyOrder(
        order({
          fulfillments: [
            fulfillment('IN_TRANSIT', {
              estimatedDeliveryAt: '2026-10-25T00:00:00Z',
              trackingInfo: [{ company: 'Carrier B', number: 'TEST-2', url: 'https://track.example.test/TEST-2' }],
            }),
          ],
        }),
      ),
    );
    expect(text).toContain('Order: #1001 (placed 2026-10-20)');
    expect(text).toContain('Status: In transit with the carrier');
    expect(text).toContain('Estimated delivery (carrier estimate): 2026-10-25');
    expect(text).toContain('carrier Carrier B, tracking number TEST-2, tracking link https://track.example.test/TEST-2');
    expect(text).toContain('checked just now');
  });

  it('drops the estimate once delivered', () => {
    const text = formatOrderStatusEvidence(
      snapshotFromShopifyOrder(
        order({ fulfillments: [fulfillment('DELIVERED', { deliveredAt: '2026-10-23T12:00:00Z', estimatedDeliveryAt: '2026-10-24T00:00:00Z' })] }),
      ),
    );
    expect(text).toContain('Delivered on: 2026-10-23');
    expect(text).not.toContain('Estimated delivery');
  });
});

it('quotes the order name for Shopify search', () => {
  expect(shopifyOrderNameQuery('#1001')).toBe('name:"#1001"');
});

describe('getOrderStatusSnapshot', () => {
  beforeEach(() => {
    orderRow = { external_order_id: '#1001', status: 'delivered', created_at: '2026-10-20T09:00:00Z' };
    credentials = { shop: 'example.myshopify.com', accessToken: 'test-token' };
    shopifyGraphql.mockReset();
  });

  it('returns null when the order is not this merchant’s', async () => {
    orderRow = null;
    expect(await getOrderStatusSnapshot({ merchantId: 'm1', orderId: 'o1' })).toBeNull();
    expect(shopifyGraphql).not.toHaveBeenCalled();
  });

  it('reads the order live from Shopify by its exact name', async () => {
    shopifyGraphql.mockResolvedValue({
      data: { orders: { nodes: [order({ name: '#10010' }), order({ fulfillments: [fulfillment('OUT_FOR_DELIVERY')] })] } },
    });
    const snapshot = await getOrderStatusSnapshot({ merchantId: 'm1', orderId: 'o1' });
    expect(shopifyGraphql.mock.calls[0][3]).toEqual({ query: 'name:"#1001"' });
    expect(snapshot).toMatchObject({ orderName: '#1001', state: 'out_for_delivery', source: 'shopify' });
  });

  it('falls back to the stored order when Shopify fails, reading fulfilled as shipped', async () => {
    shopifyGraphql.mockRejectedValue(new Error('Shopify GraphQL 503'));
    const snapshot = await getOrderStatusSnapshot({ merchantId: 'm1', orderId: 'o1' });
    expect(snapshot).toMatchObject({ state: 'shipped', source: 'stored', tracking: [] });
  });

  it('uses the stored order without a Shopify connection', async () => {
    credentials = null;
    orderRow = { external_order_id: 'CSV-7', status: 'created', created_at: null };
    const snapshot = await getOrderStatusSnapshot({ merchantId: 'm1', orderId: 'o1' });
    expect(snapshot).toMatchObject({ orderName: 'CSV-7', state: 'unknown', source: 'stored' });
    expect(formatOrderStatusEvidence(snapshot!)).toContain('shipping details (carrier, tracking, dates) are not available');
  });
});
