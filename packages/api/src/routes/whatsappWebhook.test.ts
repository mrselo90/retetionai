import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { Hono } from 'hono';

const state = vi.hoisted(() => ({
  owner: 'merchant-1' as string | null,
  inserts: [] as any[],
  jobs: [] as any[],
}));

vi.mock('../queues.js', () => ({
  addWhatsAppInboundJob: vi.fn(async (job: any) => {
    state.jobs.push(job);
  }),
}));

vi.mock('../lib/whatsappInboundProcessor.js', () => ({ processWhatsAppInboundEvent: vi.fn() }));
vi.mock('../middleware/billingMiddleware.js', () => ({ requireActiveSubscription: vi.fn() }));
vi.mock('../middleware/auth.js', () => ({ authMiddleware: vi.fn() }));

vi.mock('@recete/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@recete/shared')>();
  const table: any = {
    insert: (value: any) => {
      state.inserts.push(value);
      return {
        select: () => ({ single: async () => ({ data: { id: 'inbound-1' }, error: null }) }),
      };
    },
    update: () => ({ eq: async () => ({ error: null }) }),
  };
  return {
    ...actual,
    findMerchantByPhoneNumberId: vi.fn(async () => state.owner),
    getSupabaseServiceClient: () => ({ from: () => table }),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

import { whatsappWebhookRoutes } from './whatsapp.js';

const app = new Hono().route('/webhooks', whatsappWebhookRoutes);
const SECRET = 'meta-app-secret';

const body = JSON.stringify({
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: '2002' },
            messages: [
              {
                from: '447700900000',
                id: 'wamid.1',
                timestamp: '1',
                type: 'text',
                text: { body: 'Hi' },
              },
            ],
          },
        },
      ],
    },
  ],
});

function send(signature?: string) {
  return app.request('/webhooks/whatsapp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'X-Hub-Signature-256': signature } : {}),
    },
    body,
  });
}

const sign = (payload: string) =>
  `sha256=${crypto.createHmac('sha256', SECRET).update(payload).digest('hex')}`;

describe('WhatsApp webhook', () => {
  beforeEach(() => {
    process.env.META_APP_SECRET = SECRET;
    process.env.META_WEBHOOK_VERIFY_TOKEN = 'verify-me';
    state.owner = 'merchant-1';
    state.inserts = [];
    state.jobs = [];
  });

  it('answers the verification handshake only with the right token', async () => {
    const ok = await app.request(
      '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42'
    );
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('42');

    const bad = await app.request(
      '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42'
    );
    expect(bad.status).toBe(403);
  });

  it('rejects unsigned and wrongly signed bodies', async () => {
    expect((await send()).status).toBe(401);
    expect((await send('sha256=deadbeef')).status).toBe(401);
    expect(state.inserts).toHaveLength(0);
  });

  it('is unavailable until the app secret is configured', async () => {
    delete process.env.META_APP_SECRET;
    expect((await send(sign(body))).status).toBe(503);
  });

  it("stores and queues a customer message for the number's store", async () => {
    const response = await send(sign(body));

    expect(response.status).toBe(200);
    expect(state.inserts[0]).toMatchObject({
      merchant_id: 'merchant-1',
      provider: 'meta',
      from_phone: '+447700900000',
      message_text: 'Hi',
      phone_number_id: '2002',
    });
    expect(state.jobs).toEqual([{ inboundEventId: 'inbound-1', merchantId: 'merchant-1' }]);
  });

  it('drops a message for a number no store has connected', async () => {
    state.owner = null;

    const response = await send(sign(body));

    expect(response.status).toBe(200);
    expect(state.inserts).toHaveLength(0);
  });
});
