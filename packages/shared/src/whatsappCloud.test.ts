import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import * as crypto from 'crypto';
import {
  classifyMetaError,
  decryptSecret,
  encryptSecret,
  parseMetaWebhook,
  sendWhatsAppMessage,
  verifyMetaSignature,
} from './whatsappCloud.js';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'b'.repeat(64);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a token and never stores it in the clear', () => {
    const encrypted = encryptSecret('EAAG-secret-token');
    expect(encrypted).not.toContain('EAAG');
    expect(decryptSecret(encrypted)).toBe('EAAG-secret-token');
  });

  it('refuses to work without a valid ENCRYPTION_KEY', () => {
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'not-hex';
    try {
      expect(() => encryptSecret('x')).toThrow(/ENCRYPTION_KEY/);
    } finally {
      process.env.ENCRYPTION_KEY = saved;
    }
  });
});

describe('verifyMetaSignature', () => {
  const secret = 'app-secret';
  const body = JSON.stringify({ entry: [] });
  const sign = (payload: string) =>
    `sha256=${crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')}`;

  it('accepts a body signed with the app secret', () => {
    expect(verifyMetaSignature(body, sign(body), secret)).toBe(true);
  });

  it('rejects a tampered body, a wrong secret, and a missing header', () => {
    expect(verifyMetaSignature(`${body} `, sign(body), secret)).toBe(false);
    expect(verifyMetaSignature(body, sign(body), 'other-secret')).toBe(false);
    expect(verifyMetaSignature(body, undefined, secret)).toBe(false);
    expect(verifyMetaSignature(body, 'sha1=abc', secret)).toBe(false);
  });
});

describe('parseMetaWebhook', () => {
  const wrap = (value: unknown) => ({ entry: [{ changes: [{ value }] }] });

  it('returns customer messages in E.164 with the receiving phone number id', () => {
    const messages = parseMetaWebhook(
      wrap({
        metadata: { phone_number_id: '111' },
        messages: [
          {
            from: '447700900000',
            id: 'wamid.1',
            timestamp: '1',
            type: 'text',
            text: { body: 'Hi' },
          },
        ],
      })
    );
    expect(messages).toEqual([
      expect.objectContaining({
        from: '+447700900000',
        messageId: 'wamid.1',
        text: 'Hi',
        type: 'text',
        phoneNumberId: '111',
      }),
    ]);
  });

  it('treats quick-reply buttons as text', () => {
    const [message] = parseMetaWebhook(
      wrap({
        metadata: { phone_number_id: '111' },
        messages: [
          {
            from: '447700900000',
            id: 'wamid.2',
            timestamp: '1',
            type: 'button',
            button: { text: 'Yes' },
          },
        ],
      })
    );
    expect(message).toMatchObject({ type: 'text', text: 'Yes' });
  });

  it('keeps the media id of an image', () => {
    const [message] = parseMetaWebhook(
      wrap({
        metadata: { phone_number_id: '111' },
        messages: [
          {
            from: '447700900000',
            id: 'wamid.3',
            timestamp: '1',
            type: 'image',
            image: { id: 'media-9', mime_type: 'image/jpeg' },
          },
        ],
      })
    );
    expect(message.image).toMatchObject({ providerMediaId: 'media-9', mimeType: 'image/jpeg' });
  });

  it('ignores delivery statuses and malformed bodies', () => {
    expect(
      parseMetaWebhook(wrap({ metadata: { phone_number_id: '111' }, statuses: [{ id: 'x' }] }))
    ).toEqual([]);
    expect(parseMetaWebhook({})).toEqual([]);
    expect(parseMetaWebhook(null)).toEqual([]);
  });
});

describe('classifyMetaError', () => {
  it('retries rate limits and server errors, not permanent failures', () => {
    expect(classifyMetaError(429, {})).toMatchObject({ retryable: true, rateLimited: true });
    expect(classifyMetaError(400, { error: { code: 130429 } })).toMatchObject({
      retryable: true,
      failureCategory: 'rate_limit',
    });
    expect(classifyMetaError(503, {})).toMatchObject({
      retryable: true,
      failureCategory: 'temporary',
    });
    // 131047: outside the 24-hour window, needs a template — retrying cannot help.
    expect(
      classifyMetaError(400, { error: { code: 131047, message: 'Re-engagement message' } })
    ).toMatchObject({
      retryable: false,
      failureCategory: 'permanent',
      errorCode: '131047',
    });
  });
});

describe('sendWhatsAppMessage', () => {
  const credentials = { provider: 'meta' as const, accessToken: 'tok', phoneNumberId: '111' };

  it('posts a text message to the connected number, without the "+"', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ messages: [{ id: 'wamid.sent' }] }), { status: 200 })
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendWhatsAppMessage({ to: '+447700900000', text: 'Hello' }, credentials);

    expect(result).toMatchObject({ success: true, messageId: 'wamid.sent', provider: 'meta' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/111\/messages$/);
    expect(JSON.parse(init.body)).toMatchObject({
      to: '447700900000',
      type: 'text',
      text: { body: 'Hello' },
    });
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('rejects numbers that are not E.164 without calling Meta', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendWhatsAppMessage({ to: '07700900000', text: 'Hello' }, credentials);

    expect(result).toMatchObject({ success: false, retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
