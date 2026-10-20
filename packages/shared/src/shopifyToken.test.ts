import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const db = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  updates: [] as Array<Record<string, unknown>>,
}));
const redisState = vi.hoisted(() => ({ locked: false }));

vi.mock('./supabase.js', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      update: (values: Record<string, unknown>) => ({
        eq: async () => {
          db.updates.push(values);
          db.row = values.auth_data as Record<string, unknown>;
          return { error: null };
        },
      }),
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: db.row ? { auth_data: db.row } : null }) }),
      }),
    }),
  }),
}));

vi.mock('./redis.js', () => ({
  getRedisClient: () => ({
    set: vi.fn(async () => (redisState.locked ? null : 'OK')),
    del: vi.fn(async () => 1),
  }),
}));

import {
  getShopifyAccessToken,
  buildApiOwnedShopifyAuthData,
  ShopifyReauthRequiredError,
} from './shopifyToken';

const SHOP = 'shop-a.myshopify.com';
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe('getShopifyAccessToken', () => {
  beforeEach(() => {
    db.row = null;
    db.updates = [];
    redisState.locked = false;
    process.env.SHOPIFY_SHELL_INTERNAL_URL = 'http://localhost:3003/';
    process.env.INTERNAL_SERVICE_SECRET = 'internal-secret';
    process.env.SHOPIFY_API_KEY = 'client-id';
    process.env.SHOPIFY_API_SECRET = 'client-secret';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a cached token that is not near expiry without any network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await getShopifyAccessToken({
      id: 'int-1',
      auth_data: { shop: SHOP, access_token: 'shpat_cached', expires_at: inMinutes(30), token_owner: 'shell' },
    });

    expect(result).toEqual({ shop: SHOP, accessToken: 'shpat_cached' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks the Shopify app for an expired legacy row and caches the answer', async () => {
    const fetchMock = respond(200, {
      accessToken: 'shpat_fresh',
      expires: inMinutes(60),
      scope: 'read_products',
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getShopifyAccessToken({
      id: 'int-1',
      auth_data: { shop: SHOP, access_token: 'shpat_dead' },
    });

    expect(result.accessToken).toBe('shpat_fresh');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:3003/internal/offline-token');
    expect((init.headers as Record<string, string>)['X-Internal-Secret']).toBe('internal-secret');
    expect(db.updates).toHaveLength(1);
    expect(db.row).toMatchObject({ access_token: 'shpat_fresh', token_owner: 'shell' });
  });

  it('reports re-authorization when the Shopify app cannot refresh', async () => {
    vi.stubGlobal('fetch', respond(409, { error: 'reauth_required' }));

    await expect(
      getShopifyAccessToken({
        id: 'int-1',
        auth_data: { shop: SHOP, access_token: 'shpat_dead', expires_at: inMinutes(-10) },
      })
    ).rejects.toBeInstanceOf(ShopifyReauthRequiredError);
  });

  it('falls back to a non-expiring stored token when the app has no session', async () => {
    vi.stubGlobal('fetch', respond(404, { error: 'no_offline_session' }));

    const result = await getShopifyAccessToken({
      id: 'int-1',
      auth_data: { shop: SHOP, access_token: 'shpat_legacy_dashboard' },
    });

    expect(result.accessToken).toBe('shpat_legacy_dashboard');
  });

  it('refreshes an API-owned token near expiry and stores the rotated pair', async () => {
    const fetchMock = respond(200, {
      access_token: 'shpat_new',
      expires_in: 3600,
      refresh_token: 'shprt_new',
      refresh_token_expires_in: 7776000,
      scope: 'read_orders',
    });
    vi.stubGlobal('fetch', fetchMock);
    const auth = {
      shop: SHOP,
      access_token: 'shpat_old',
      expires_at: inMinutes(2),
      refresh_token: 'shprt_old',
      refresh_token_expires_at: inMinutes(60 * 24),
      token_owner: 'api' as const,
    };
    db.row = auth;

    const result = await getShopifyAccessToken({ id: 'int-1', auth_data: auth });

    expect(result.accessToken).toBe('shpat_new');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://${SHOP}/admin/oauth/access_token`);
    const sent = new URLSearchParams(String(init.body));
    expect(sent.get('grant_type')).toBe('refresh_token');
    expect(sent.get('refresh_token')).toBe('shprt_old');
    expect(db.row).toMatchObject({
      access_token: 'shpat_new',
      refresh_token: 'shprt_new',
      token_owner: 'api',
    });
  });

  it('does not call Shopify with an expired refresh token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getShopifyAccessToken({
        id: 'int-1',
        auth_data: {
          shop: SHOP,
          access_token: 'shpat_old',
          expires_at: inMinutes(-5),
          refresh_token: 'shprt_old',
          refresh_token_expires_at: inMinutes(-1),
          token_owner: 'api',
        },
      })
    ).rejects.toBeInstanceOf(ShopifyReauthRequiredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('waits for another process holding the refresh lock instead of refreshing twice', async () => {
    redisState.locked = true;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const stale = {
      shop: SHOP,
      access_token: 'shpat_old',
      expires_at: inMinutes(1),
      refresh_token: 'shprt_old',
      refresh_token_expires_at: inMinutes(60),
      token_owner: 'api' as const,
    };
    // The other process has already stored a fresh token.
    db.row = { ...stale, access_token: 'shpat_from_other_process', expires_at: inMinutes(60) };

    const result = await getShopifyAccessToken({ id: 'int-1', auth_data: stale });

    expect(result.accessToken).toBe('shpat_from_other_process');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('buildApiOwnedShopifyAuthData', () => {
  it('turns expires_in values into absolute times', () => {
    const now = Date.parse('2026-10-20T12:00:00.000Z');
    const auth = buildApiOwnedShopifyAuthData(
      SHOP,
      { access_token: 'a', expires_in: 3600, refresh_token: 'r', refresh_token_expires_in: 86400 },
      now
    );
    expect(auth.expires_at).toBe('2026-10-20T13:00:00.000Z');
    expect(auth.refresh_token_expires_at).toBe('2026-10-21T12:00:00.000Z');
    expect(auth.token_owner).toBe('api');
  });
});
