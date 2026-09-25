import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendWhatsAppMessage,
  WaWorkerError,
  classifyWorkerFailure,
  fetchWhatsAppImageDataUrl,
} from './whatsappWorker';

const credentials = { provider: 'whatsmeow', merchantId: 'm-1' };

function answer(status: number, body: Record<string, unknown>) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

describe('sendWhatsAppMessage via wa-worker', () => {
  beforeEach(() => {
    process.env.WA_WORKER_URL = 'http://127.0.0.1:3005/';
    process.env.WA_WORKER_SECRET = 's3cret';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends automated messages humanized, and signs the call', async () => {
    const fetchMock = answer(200, { ok: true, id: 'WA-1' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendWhatsAppMessage({ to: '+447700900000', text: 'Hi' }, credentials);

    expect(result).toMatchObject({ success: true, messageId: 'WA-1', provider: 'whatsmeow' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:3005/send');
    expect((init.headers as Record<string, string>)['x-wa-worker-secret']).toBe('s3cret');
    expect(JSON.parse(init.body as string)).toEqual({
      merchantId: 'm-1',
      to: '+447700900000',
      body: 'Hi',
      humanize: true,
    });
  });

  it('does not pace a reply a person typed', async () => {
    const fetchMock = answer(200, { id: 'WA-2' });
    vi.stubGlobal('fetch', fetchMock);
    await sendWhatsAppMessage({ to: '+44', text: 'Hi', typedByPerson: true }, credentials);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).humanize).toBe(false);
  });

  it('reports the daily cap as a rate limit with the wait', async () => {
    vi.stubGlobal('fetch', answer(429, { error: 'daily_cap_reached', retryAfterMs: 3_600_000 }));
    const result = await sendWhatsAppMessage({ to: '+44', text: 'Hi' }, credentials);
    expect(result).toMatchObject({
      success: false,
      retryable: true,
      rateLimited: true,
      retryAfterMs: 3_600_000,
      failureCategory: 'rate_limit',
    });
  });

  it('does not retry a number that is not on WhatsApp', async () => {
    vi.stubGlobal('fetch', answer(422, { error: 'not_on_whatsapp' }));
    const result = await sendWhatsAppMessage({ to: '+44', text: 'Hi' }, credentials);
    expect(result).toMatchObject({ retryable: false, failureCategory: 'permanent' });
  });

  it('retries when the worker is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      })
    );
    const result = await sendWhatsAppMessage({ to: '+44', text: 'Hi' }, credentials);
    expect(result).toMatchObject({ retryable: true, failureCategory: 'temporary' });
  });

  it('refuses without a merchant, without calling the worker', async () => {
    const fetchMock = answer(200, {});
    vi.stubGlobal('fetch', fetchMock);
    const result = await sendWhatsAppMessage({ to: '+44', text: 'Hi' }, { provider: 'x' } as any);
    expect(result).toMatchObject({ success: false, retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fetchWhatsAppImageDataUrl', () => {
  beforeEach(() => {
    process.env.WA_WORKER_URL = 'http://127.0.0.1:3005';
    process.env.WA_WORKER_SECRET = 's3cret';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns the photo as a data URL', async () => {
    const fetchMock = answer(200, { mimeType: 'image/png', data: 'AAAA' });
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchWhatsAppImageDataUrl('m-1', 'KEYS')).toBe('data:image/png;base64,AAAA');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:3005/media');
    expect(JSON.parse(init.body as string)).toEqual({ merchantId: 'm-1', media: 'KEYS' });
  });

  it('throws when WhatsApp no longer has it', async () => {
    vi.stubGlobal('fetch', answer(410, { error: 'media_unavailable' }));
    await expect(fetchWhatsAppImageDataUrl('m-1', 'KEYS')).rejects.toThrow('media_unavailable');
  });
});

describe('classifyWorkerFailure', () => {
  it('treats not_connected as temporary (a reconnect may be under way)', () => {
    expect(
      classifyWorkerFailure(new WaWorkerError('x', 409, { error: 'not_connected' }))
    ).toMatchObject({
      retryable: true,
      errorCode: 'not_connected',
    });
  });
});
