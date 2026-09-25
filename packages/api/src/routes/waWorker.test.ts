import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

type Call = { table: string; op: string; value?: any; filters: Array<[string, ...any[]]> };

const state = vi.hoisted(() => ({
  calls: [] as Call[],
  merchantExists: true,
  insertError: null as null | { code: string },
  existingInbound: null as null | { id: string; status: string },
  outboundById: [] as any[],
  outboundRecentSame: [] as any[],
  user: null as null | { userId: string },
  conversation: null as null | { id: string; conversation_status: string; history: any[] },
  jobs: [] as any[],
  queueFails: false,
  historyAppends: [] as any[],
}));

vi.mock('../queues.js', () => ({
  addWhatsAppInboundJob: vi.fn(async (job: any) => {
    if (state.queueFails) throw new Error('redis down');
    state.jobs.push(job);
  }),
}));

vi.mock('../lib/conversation.js', () => ({
  findUserByPhone: vi.fn(async () => state.user),
  addMessageToConversation: vi.fn(async (...args: any[]) => {
    state.historyAppends.push(args);
  }),
}));

/**
 * A chainable stand-in for the Supabase query builder: every filter returns the
 * builder, and awaiting it (or a terminal call) resolves from `state`.
 */
function builder(table: string) {
  const call: Call = { table, op: 'select', filters: [] };
  state.calls.push(call);
  const resolve = () => {
    if (table === 'merchants') {
      return { data: state.merchantExists ? { id: 'm' } : null, error: null };
    }
    if (table === 'whatsapp_inbound_events') {
      if (call.op === 'insert') {
        return state.insertError
          ? { data: null, error: state.insertError }
          : { data: { id: 'inbound-1' }, error: null };
      }
      if (call.op === 'select') return { data: state.existingInbound, error: null };
      return { data: null, error: null };
    }
    if (table === 'whatsapp_outbound_events') {
      if (call.op === 'select') {
        const byId = call.filters.some(
          ([name, col]) => name === 'eq' && col === 'provider_message_id'
        );
        return { data: byId ? state.outboundById : state.outboundRecentSame, error: null };
      }
      return { data: null, error: null };
    }
    if (table === 'conversations') {
      return { data: call.op === 'select' ? state.conversation : null, error: null };
    }
    return { data: null, error: null };
  };
  const b: any = {
    select: () => b,
    insert: (value: any) => {
      call.op = 'insert';
      call.value = value;
      return b;
    },
    update: (value: any) => {
      call.op = 'update';
      call.value = value;
      return b;
    },
    single: async () => resolve(),
    maybeSingle: async () => resolve(),
    then: (onFulfilled: any, onRejected: any) =>
      Promise.resolve(resolve()).then(onFulfilled, onRejected),
  };
  for (const name of ['eq', 'in', 'is', 'gte', 'order', 'limit']) {
    b[name] = (...args: any[]) => {
      call.filters.push([name, ...args]);
      return b;
    };
  }
  return b;
}

vi.mock('@recete/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@recete/shared')>();
  return {
    ...actual,
    getSupabaseServiceClient: () => ({ from: (table: string) => builder(table) }),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

import waWorkerRoutes from './waWorker.js';

const app = new Hono().route('/internal/wa-worker', waWorkerRoutes);
const SECRET = 'worker-secret';
const MERCHANT = '11111111-2222-3333-4444-555555555555';

function post(event: Record<string, unknown>, secret: string | null = SECRET) {
  return app.request('/internal/wa-worker/events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret ? { 'x-wa-worker-secret': secret } : {}),
    },
    body: JSON.stringify({ merchantId: MERCHANT, ...event }),
  });
}

const inbound = {
  type: 'inbound',
  messageId: 'WA1',
  phone: '+447700900000',
  chatJid: '447700900000@s.whatsapp.net',
  pushName: 'Ada',
  body: 'Where is my order?',
  timestamp: '2026-09-25T10:00:00Z',
};

const inserts = () =>
  state.calls.filter((c) => c.table === 'whatsapp_inbound_events' && c.op === 'insert');

describe('wa-worker events', () => {
  beforeEach(() => {
    process.env.WA_WORKER_SECRET = SECRET;
    Object.assign(state, {
      calls: [],
      merchantExists: true,
      insertError: null,
      existingInbound: null,
      outboundById: [],
      outboundRecentSame: [],
      user: null,
      conversation: null,
      jobs: [],
      queueFails: false,
      historyAppends: [],
    });
  });

  it('rejects a missing or wrong secret', async () => {
    expect((await post(inbound, null)).status).toBe(401);
    expect((await post(inbound, 'nope')).status).toBe(401);
    delete process.env.WA_WORKER_SECRET;
    expect((await post(inbound)).status).toBe(401);
    expect(inserts()).toHaveLength(0);
  });

  it('stores a customer message and queues it for the assistant', async () => {
    const res = await post(inbound);
    expect(res.status).toBe(200);
    expect(inserts()[0].value).toMatchObject({
      merchant_id: MERCHANT,
      provider: 'whatsmeow',
      external_message_id: 'WA1',
      from_phone: '+447700900000',
      message_type: 'text',
      message_text: 'Where is my order?',
    });
    expect(state.jobs).toEqual([{ inboundEventId: 'inbound-1', merchantId: MERCHANT }]);
  });

  it('keys a sender WhatsApp withheld the number for by the chat JID, never a fake phone', async () => {
    await post({ ...inbound, phone: null, lid: '123456789012345', chatJid: '123456789012345@lid' });
    expect(inserts()[0].value.from_phone).toBe('123456789012345@lid');
  });

  it('stores a photo with its download keys, captioned or not, for AI vision', async () => {
    await post({
      ...inbound,
      body: '',
      messageType: 'image',
      media: 'KEYS',
      mimeType: 'image/jpeg',
    });
    expect(inserts()[0].value).toMatchObject({
      message_type: 'image',
      message_text: null,
      payload: {
        message: { type: 'image', image: { providerMediaId: 'KEYS', mimeType: 'image/jpeg' } },
      },
    });
    expect(state.jobs).toHaveLength(1);
  });

  it('rejects an empty message that is not a photo', async () => {
    expect((await post({ ...inbound, body: '' })).status).toBe(400);
    expect(inserts()).toHaveLength(0);
  });

  it('treats a redelivery as done, but queues one that was stored and never queued', async () => {
    state.insertError = { code: '23505' };
    state.existingInbound = { id: 'inbound-0', status: 'queued' };
    expect((await post(inbound)).status).toBe(200);
    expect(state.jobs).toHaveLength(0);

    state.existingInbound = { id: 'inbound-0', status: 'received' };
    expect((await post(inbound)).status).toBe(200);
    expect(state.jobs).toEqual([{ inboundEventId: 'inbound-0', merchantId: MERCHANT }]);
  });

  it('answers 500 when it cannot queue, so the worker keeps the event and retries', async () => {
    state.queueFails = true;
    expect((await post(inbound)).status).toBe(500);
  });

  it('drops events for a store that no longer exists instead of failing forever', async () => {
    state.merchantExists = false;
    const res = await post(inbound);
    expect(res.status).toBe(200);
    expect(inserts()).toHaveLength(0);
  });

  it("records the merchant's reply from their phone and hands the thread to them", async () => {
    state.user = { userId: 'user-1' };
    state.conversation = { id: 'conv-1', conversation_status: 'ai', history: [] };
    const res = await post({ ...inbound, type: 'own_message', body: 'Shipped today!' });
    expect(res.status).toBe(200);
    expect(state.historyAppends).toEqual([['conv-1', 'merchant', 'Shipped today!']]);
    const handover = state.calls.find((c) => c.table === 'conversations' && c.op === 'update');
    expect(handover?.value).toMatchObject({ conversation_status: 'human' });
  });

  it("does not record Recete's own sends echoed back as the merchant's", async () => {
    state.user = { userId: 'user-1' };
    state.conversation = { id: 'conv-1', conversation_status: 'ai', history: [] };

    state.outboundById = [{ id: 'out-1' }];
    await post({ ...inbound, type: 'own_message' });

    state.outboundById = [];
    state.outboundRecentSame = [{ id: 'out-2' }];
    await post({ ...inbound, type: 'own_message' });

    state.outboundRecentSame = [];
    state.conversation.history = [{ role: 'assistant', content: 'Where is my order?' }];
    await post({ ...inbound, type: 'own_message' });

    expect(state.historyAppends).toHaveLength(0);
  });

  it('stamps delivered, and delivered plus read, on the matching outbound rows', async () => {
    await post({ type: 'receipt', messageIds: ['A', 'B'], status: 'read' });
    const updates = state.calls.filter(
      (c) => c.table === 'whatsapp_outbound_events' && c.op === 'update'
    );
    expect(updates.map((u) => Object.keys(u.value)[0])).toEqual(['delivered_at', 'read_at']);
    expect(updates[0].filters).toContainEqual(['in', 'provider_message_id', ['A', 'B']]);
    expect(updates[0].filters).toContainEqual(['eq', 'merchant_id', MERCHANT]);
  });
});
