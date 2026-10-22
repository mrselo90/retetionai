import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchShopifyCatalog = vi.hoisted(() => vi.fn());
vi.mock('../platform.server', () => ({ fetchShopifyCatalog }));

import { fetchFullShopifyCatalog } from './productCatalog.server';
import { setVerifiedShopDomain } from './verifiedShop.server';

function page(start: number, size: number, next: boolean) {
  return {
    shopDomain: 'shop-a.myshopify.com',
    products: Array.from({ length: size }, (_, index) => ({
      id: String(start + index),
      title: `P${start + index}`,
      handle: `p-${start + index}`,
      status: 'ACTIVE',
    })),
    hasNextPage: next,
    endCursor: next ? `cursor-${start + size}` : null,
  };
}

function request(shop?: string) {
  const req = new Request('https://shop.recete.co.uk/app/products?shop=shop-b.myshopify.com');
  if (shop) setVerifiedShopDomain(req, shop);
  return req;
}

describe('fetchFullShopifyCatalog', () => {
  beforeEach(() => {
    fetchShopifyCatalog.mockReset();
  });

  it('follows cursors until the last page', async () => {
    fetchShopifyCatalog
      .mockResolvedValueOnce(page(0, 250, true))
      .mockResolvedValueOnce(page(250, 250, true))
      .mockResolvedValueOnce(page(500, 40, false));

    const result = await fetchFullShopifyCatalog(request());

    expect(result.products).toHaveLength(540);
    expect(result.truncated).toBe(false);
    expect(fetchShopifyCatalog.mock.calls.map((call) => call[1])).toEqual([
      { first: 250, after: undefined },
      { first: 250, after: 'cursor-250' },
      { first: 250, after: 'cursor-500' },
    ]);
  });

  it('stops at the cap and reports truncation', async () => {
    fetchShopifyCatalog.mockImplementation(async (_req, input: { after?: string }) => {
      const start = input.after ? Number(input.after.split('-')[1]) : 0;
      return page(start, 250, true);
    });

    const result = await fetchFullShopifyCatalog(request(), { maxProducts: 600 });

    expect(result.products).toHaveLength(600);
    expect(result.truncated).toBe(true);
    expect(fetchShopifyCatalog).toHaveBeenCalledTimes(3);
  });

  it('caches per verified shop, never per the ?shop= parameter', async () => {
    fetchShopifyCatalog.mockResolvedValue(page(0, 3, false));

    await fetchFullShopifyCatalog(request('shop-a.myshopify.com'));
    await fetchFullShopifyCatalog(request('shop-a.myshopify.com'));
    expect(fetchShopifyCatalog).toHaveBeenCalledTimes(1);

    // Same ?shop=shop-b in the URL, different verified shop: no shared cache entry.
    await fetchFullShopifyCatalog(request('shop-c.myshopify.com'));
    expect(fetchShopifyCatalog).toHaveBeenCalledTimes(2);

    // No verified shop: never served from cache.
    await fetchFullShopifyCatalog(request());
    await fetchFullShopifyCatalog(request());
    expect(fetchShopifyCatalog).toHaveBeenCalledTimes(4);
  });
});
