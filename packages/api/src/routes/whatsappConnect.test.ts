import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';

const state = vi.hoisted(() => ({
  owner: null as string | null,
  existing: null as { id: string } | null,
  writes: [] as Array<{ op: string; value: any }>,
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    c.set('merchantId', 'merchant-1');
    await next();
  },
}));

vi.mock('@recete/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@recete/shared')>();
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: state.existing, error: null }),
    update: (value: any) => {
      state.writes.push({ op: 'update', value });
      return { eq: async () => ({ error: null }) };
    },
    insert: async (value: any) => {
      state.writes.push({ op: 'insert', value });
      return { error: null };
    },
  };
  return {
    ...actual,
    findMerchantByPhoneNumberId: vi.fn(async () => state.owner),
    getSupabaseServiceClient: () => ({ from: () => builder }),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

import whatsappConnect from './whatsappConnect.js';
import { decryptSecret } from '@recete/shared';

const app = new Hono().route('/api/integrations/whatsapp', whatsappConnect);

function post(body: unknown) {
  return app.request('/api/integrations/whatsapp/embedded-signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = { code: 'one-time-code', wabaId: '1001', phoneNumberId: '2002' };

function mockGraph() {
  const fetchMock = vi.fn(async (input: any) => {
    const url = String(input);
    if (url.includes('oauth/access_token'))
      return new Response(JSON.stringify({ access_token: 'EAAG-token' }));
    if (url.includes('/2002?')) {
      return new Response(
        JSON.stringify({ display_phone_number: '+44 7700 900000', verified_name: 'Olive & Oak' })
      );
    }
    if (url.includes('/1001/subscribed_apps'))
      return new Response(JSON.stringify({ success: true }));
    if (url.includes('/2002/register')) return new Response(JSON.stringify({ success: true }));
    return new Response(JSON.stringify({ error: { message: 'unexpected' } }), { status: 400 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('WhatsApp Embedded Signup routes', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = 'c'.repeat(64);
    process.env.META_APP_ID = 'app-id';
    process.env.META_APP_SECRET = 'app-secret';
    process.env.META_EMBEDDED_SIGNUP_CONFIG_ID = 'config-id';
    state.owner = null;
    state.existing = null;
    state.writes = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    delete process.env.META_EMBEDDED_SIGNUP_CONFIG_ID;
  });

  it('reports the connection as unavailable until the Meta app is configured', async () => {
    delete process.env.META_APP_SECRET;

    const config = await app.request('/api/integrations/whatsapp/embedded-signup/config');
    expect(await config.json()).toEqual({ enabled: false });

    const connect = await post(validBody);
    expect(connect.status).toBe(503);
  });

  it('exposes only the public app id and config id', async () => {
    const response = await app.request('/api/integrations/whatsapp/embedded-signup/config');
    const body = await response.json();
    expect(body).toMatchObject({ enabled: true, appId: 'app-id', configId: 'config-id' });
    expect(JSON.stringify(body)).not.toContain('app-secret');
  });

  it('requires the code, account and phone number', async () => {
    expect((await post({ code: 'x' })).status).toBe(400);
    expect((await post({ ...validBody, phoneNumberId: 'not-a-number' })).status).toBe(400);
  });

  it('refuses a number already connected to another store', async () => {
    state.owner = 'merchant-2';
    const fetchMock = mockGraph();

    const response = await post(validBody);

    expect(response.status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('connects: exchanges the code, subscribes, registers, and stores the token encrypted', async () => {
    const fetchMock = mockGraph();

    const response = await post(validBody);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      connected: true,
      phoneNumberDisplay: '+44 7700 900000',
    });
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((u) => u.includes('oauth/access_token'))).toBe(true);
    expect(urls.some((u) => u.includes('/1001/subscribed_apps'))).toBe(true);
    expect(urls.some((u) => u.includes('/2002/register'))).toBe(true);

    const [write] = state.writes;
    expect(write.op).toBe('insert');
    expect(write.value).toMatchObject({
      merchant_id: 'merchant-1',
      provider: 'whatsapp',
      status: 'active',
    });
    expect(JSON.stringify(write.value)).not.toContain('EAAG-token');
    expect(decryptSecret(write.value.auth_data.access_token_enc)).toBe('EAAG-token');
  });

  it('does not re-register a number moved over from the WhatsApp Business app', async () => {
    const fetchMock = mockGraph();

    const response = await post({ ...validBody, coexistence: true });

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/register'))).toBe(false);
  });

  it('reports which step Meta rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: 'Invalid code' } }), { status: 400 })
      )
    );

    const response = await post(validBody);

    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain('exchange_code');
    expect(state.writes).toHaveLength(0);
  });
});
