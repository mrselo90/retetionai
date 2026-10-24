import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  inserted: [] as Array<Record<string, unknown>>,
  insertError: null as null | { code: string; message: string },
  storedPayload: null as null | Record<string, unknown>,
}));
const addCommerceEventJob = vi.hoisted(() => vi.fn(async () => ({})));
const shopifyGraphql = vi.hoisted(() => vi.fn());

vi.mock('@recete/shared', () => ({
  getShopifyAccessToken: vi.fn(async () => ({ shop: 'example.myshopify.com', accessToken: 'test-token' })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  getSupabaseServiceClient: vi.fn(() => ({
    from: () => {
      const query: any = {
        insert: (row: Record<string, unknown>) => {
          db.inserted.push(row);
          return { select: () => ({ single: async () => (db.insertError ? { data: null, error: db.insertError } : { data: { id: 'evt-1' }, error: null }) }) };
        },
        select: () => query,
        eq: () => query,
        contains: () => query,
        in: () => query,
        order: () => query,
        limit: async () => ({ data: db.storedPayload ? [{ payload: db.storedPayload }] : [], error: null }),
      };
      return query;
    },
  })),
}));
vi.mock('../queues.js', () => ({ addCommerceEventJob }));
vi.mock('./shopifyIntegrationLookup.js', () => ({ shopifyGraphql }));

import {
  carrierDeliveryEvent,
  estimatedDeliveryEvent,
  handleFulfillmentEventWebhook,
  nextOrderStatus,
  queueDeliveryFallback,
} from './deliveryTiming';
import type { NormalizedEvent } from './events';

const shipped: NormalizedEvent = {
  merchant_id: 'm1',
  integration_id: 'i1',
  source: 'shopify',
  event_type: 'order_shipped',
  occurred_at: '2026-10-20T10:00:00.000Z',
  external_order_id: '#1001',
  customer: { phone: '+61491570156', name: 'Consent Tester' },
  order: { status: 'fulfilled', shipped_at: '2026-10-20T09:00:00.000Z' },
  items: [{ name: 'Test Serum', external_product_id: '1' }],
};
const integration = { id: 'i1', merchant_id: 'm1', auth_data: {} };

beforeEach(() => {
  db.inserted.length = 0;
  db.insertError = null;
  db.storedPayload = null;
  addCommerceEventJob.mockClear();
  shopifyGraphql.mockReset();
});
afterEach(() => {
  delete process.env.DELIVERY_FALLBACK_DAYS;
});

describe('nextOrderStatus', () => {
  it.each([
    [null, 'shipped', 'shipped'],
    ['created', 'shipped', 'shipped'],
    ['shipped', 'delivered', 'delivered'],
    ['delivered', 'shipped', 'delivered'], // late orders/fulfilled after delivery
    ['delivered', 'delivered', 'delivered'],
    ['shipped', 'created', 'shipped'],
    ['cancelled', 'delivered', 'cancelled'], // fallback for a cancelled order
    ['shipped', 'cancelled', 'cancelled'],
    ['delivered', 'returned', 'returned'],
    ['returned', 'delivered', 'returned'],
  ])('%s + %s → %s', (current, incoming, expected) => {
    expect(nextOrderStatus(current, incoming)).toBe(expected);
  });
});

describe('delivered events', () => {
  it('estimates delivery 4 days after shipping by default', () => {
    const event = estimatedDeliveryEvent(shipped);
    expect(event).toMatchObject({
      event_type: 'order_delivered',
      occurred_at: '2026-10-24T09:00:00.000Z',
      order: { status: 'delivered', delivered_at: '2026-10-24T09:00:00.000Z', delivery_source: 'estimated' },
      customer: shipped.customer,
      items: shipped.items,
    });
  });

  it('takes the fallback days from DELIVERY_FALLBACK_DAYS', () => {
    process.env.DELIVERY_FALLBACK_DAYS = '2';
    expect(estimatedDeliveryEvent(shipped).occurred_at).toBe('2026-10-22T09:00:00.000Z');
  });

  it('builds a carrier delivery on the stored order', () => {
    expect(carrierDeliveryEvent(shipped, '2026-10-22T15:30:00Z').order).toMatchObject({
      delivered_at: '2026-10-22T15:30:00Z',
      delivery_source: 'carrier',
    });
  });
});

describe('queueDeliveryFallback', () => {
  it('stores the estimated delivery and queues it for then', async () => {
    const before = Date.now();
    await queueDeliveryFallback({ ...shipped, order: { status: 'fulfilled', shipped_at: new Date().toISOString() } });
    expect(db.inserted[0]).toMatchObject({ event_type: 'order_delivered', merchant_id: 'm1' });
    const delay = (addCommerceEventJob.mock.calls[0] as any)[1].delayMs;
    expect(delay).toBeGreaterThan(4 * 24 * 3600 * 1000 - (Date.now() - before) - 1000);
  });

  it('queues nothing again for a replayed shipped webhook', async () => {
    db.insertError = { code: '23505', message: 'duplicate' };
    expect(await queueDeliveryFallback(shipped)).toEqual({ queued: false, reason: 'duplicate' });
    expect(addCommerceEventJob).not.toHaveBeenCalled();
  });
});

describe('handleFulfillmentEventWebhook', () => {
  it('ignores progress other than delivered', async () => {
    expect(await handleFulfillmentEventWebhook({ integration, body: { status: 'in_transit', order_id: 1 } })).toEqual({
      result: 'ignored_status',
    });
    expect(shopifyGraphql).not.toHaveBeenCalled();
  });

  it('queues the delivery at once for a delivered event on an order we know', async () => {
    shopifyGraphql.mockResolvedValue({ data: { order: { name: '#1001' } } });
    db.storedPayload = shipped as any;
    const result = await handleFulfillmentEventWebhook({
      integration,
      body: { id: 77, status: 'delivered', happened_at: '2026-10-22T15:30:00Z', order_id: 5001 },
    });
    expect(result).toEqual({ result: 'delivered_queued' });
    expect(shopifyGraphql.mock.calls[0][3]).toEqual({ id: 'gid://shopify/Order/5001' });
    expect(db.inserted[0]).toMatchObject({
      event_type: 'order_delivered',
      payload: { order: { delivered_at: '2026-10-22T15:30:00Z', delivery_source: 'carrier' } },
    });
    expect((addCommerceEventJob.mock.calls[0] as any)[1]).toEqual({ delayMs: 0 });
  });

  it('ignores an order we never stored', async () => {
    shopifyGraphql.mockResolvedValue({ data: { order: { name: '#9999' } } });
    expect(
      await handleFulfillmentEventWebhook({ integration, body: { status: 'delivered', order_id: 5002 } })
    ).toEqual({ result: 'ignored_order_not_seen' });
    expect(addCommerceEventJob).not.toHaveBeenCalled();
  });
});
