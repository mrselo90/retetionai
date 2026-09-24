import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findShopifyIntegration } from './shopifyIntegrationLookup.js';

function makeClient(result: { data: unknown; error: unknown }) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {};
  q.from = vi.fn(() => q);
  q.select = vi.fn(() => q);
  q.eq = vi.fn(() => q);
  q.contains = vi.fn(() => q);
  q.order = vi.fn(() => q);
  q.limit = vi.fn(async () => result);
  return q as any;
}

describe('findShopifyIntegration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the error instead of folding it into "not found"', async () => {
    // The whole bug. With two rows, .maybeSingle() errored, callers saw a null
    // row, and install-sync provisioned another merchant.
    const client = makeClient({ data: null, error: { message: 'boom', code: 'XX000' } });

    const result = await findShopifyIntegration(client, 'shop.myshopify.com');

    expect(result.integration).toBeNull();
    expect(result.error).toEqual({ message: 'boom', code: 'XX000' });
  });

  it('returns a row even when the shop has several, never an error', async () => {
    const rows = [
      {
        id: 'newest',
        merchant_id: 'm-new',
        status: 'active',
        auth_data: {},
        updated_at: '2026-09-02',
      },
      {
        id: 'older',
        merchant_id: 'm-old',
        status: 'active',
        auth_data: {},
        updated_at: '2026-09-01',
      },
    ];
    const client = makeClient({ data: rows.slice(0, 1), error: null });

    const result = await findShopifyIntegration(client, 'shop.myshopify.com');

    expect(result.error).toBeNull();
    expect(result.integration?.id).toBe('newest');
    expect(client.order).toHaveBeenCalledWith('updated_at', {
      ascending: false,
      nullsFirst: false,
    });
    expect(client.limit).toHaveBeenCalledWith(1);
  });

  it('returns null with no error when the shop genuinely has no integration', async () => {
    const client = makeClient({ data: [], error: null });

    const result = await findShopifyIntegration(client, 'new.myshopify.com');

    expect(result).toEqual({ integration: null, error: null });
  });

  it('filters on status only when asked to', async () => {
    const client = makeClient({ data: [], error: null });

    await findShopifyIntegration(client, 'shop.myshopify.com');
    expect(client.eq).toHaveBeenCalledTimes(1);
    expect(client.eq).toHaveBeenCalledWith('provider', 'shopify');

    vi.clearAllMocks();
    await findShopifyIntegration(client, 'shop.myshopify.com', { activeOnly: true });
    expect(client.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('matches on the shop inside auth_data', async () => {
    const client = makeClient({ data: [], error: null });

    await findShopifyIntegration(client, 'shop.myshopify.com');

    expect(client.contains).toHaveBeenCalledWith('auth_data', { shop: 'shop.myshopify.com' });
  });
});
