import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const state = vi.hoisted(() => ({
  row: null as any,
  calls: [] as Array<{ path: string; body: unknown }>,
  workerFails: false,
}));

vi.mock('../middleware/auth.js', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('merchantId', 'merchant-1');
    await next();
  }),
}));

vi.mock('@recete/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@recete/shared')>();
  return {
    ...actual,
    getWhatsAppConnection: vi.fn(async () => state.row),
    callWaWorker: vi.fn(async (path: string, init: any) => {
      if (state.workerFails) throw new actual.WaWorkerError('down', 0);
      state.calls.push({ path, body: init?.body });
      return { ok: true };
    }),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

import whatsappConnectionRoutes from './whatsappConnection.js';

const app = new Hono().route('/api/integrations/whatsapp', whatsappConnectionRoutes);

describe('WhatsApp connection routes', () => {
  beforeEach(() => {
    process.env.WA_WORKER_URL = 'http://127.0.0.1:3005';
    process.env.WA_WORKER_SECRET = 's';
    state.row = null;
    state.calls = [];
    state.workerFails = false;
  });

  it('reports not linked, and unavailable without the worker configured', async () => {
    let res = await app.request('/api/integrations/whatsapp/status');
    expect(await res.json()).toMatchObject({ available: true, status: 'disconnected', qr: null });

    delete process.env.WA_WORKER_URL;
    res = await app.request('/api/integrations/whatsapp/status');
    expect(await res.json()).toMatchObject({ available: false });
    expect(
      (await app.request('/api/integrations/whatsapp/connect', { method: 'POST' })).status
    ).toBe(503);
  });

  it('shows the QR only while pairing', async () => {
    state.row = { status: 'qr', qr: 'data:image/png;base64,AA', phone_e164: null };
    let body = await (await app.request('/api/integrations/whatsapp/status')).json();
    expect(body.qr).toBe('data:image/png;base64,AA');

    state.row = { status: 'connected', qr: 'data:stale', phone_e164: '+447700900000' };
    body = await (await app.request('/api/integrations/whatsapp/status')).json();
    expect(body).toMatchObject({ status: 'connected', qr: null, phone: '+447700900000' });
  });

  it("starts and stops pairing for the caller's own store only", async () => {
    await app.request('/api/integrations/whatsapp/connect', { method: 'POST' });
    await app.request('/api/integrations/whatsapp/disconnect', { method: 'POST' });
    expect(state.calls).toEqual([
      { path: '/connect', body: { merchantId: 'merchant-1' } },
      { path: '/disconnect', body: { merchantId: 'merchant-1' } },
    ]);
  });

  it('answers 502 when the worker is down', async () => {
    state.workerFails = true;
    expect(
      (await app.request('/api/integrations/whatsapp/connect', { method: 'POST' })).status
    ).toBe(502);
  });
});
