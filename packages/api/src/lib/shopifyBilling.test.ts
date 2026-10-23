import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@recete/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@recete/shared')>();
  return {
    ...actual,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    getSupabaseServiceClient: vi.fn(),
  };
});

import { SHOPIFY_ADMIN_API_VERSION } from '@recete/shared';
import { getShopifyRecurringCharge } from './shopifyBilling.js';

describe('getShopifyRecurringCharge', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the subscription through node() on the shared API version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { node: { status: 'ACTIVE', createdAt: '2026-10-01T00:00:00Z' } } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const charge = await getShopifyRecurringCharge('demo.myshopify.com', 'token', 123);

    expect(charge).toEqual({ status: 'active', createdAt: '2026-10-01T00:00:00Z', updatedAt: '' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://demo.myshopify.com/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`);
    const body = JSON.parse(String(init.body));
    expect(body.query).toContain('node(id: $id)');
    expect(body.query).not.toMatch(/^\s*appSubscription\(/m);
    expect(body.variables).toEqual({ id: 'gid://shopify/AppSubscription/123' });
  });

  it('returns null when the id is not an app subscription', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { node: null } }), { status: 200 })));
    expect(await getShopifyRecurringCharge('demo.myshopify.com', 'token', 999)).toBeNull();
  });
});
