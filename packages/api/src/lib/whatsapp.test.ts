import { describe, expect, it, vi } from 'vitest';
import { parseWhatsAppWebhook, sendWhatsAppMessage, type TwilioWhatsAppCredentials } from './whatsapp.js';

describe('parseWhatsAppWebhook', () => {
  it('parses Twilio WhatsApp inbound form payloads and strips whatsapp prefix', () => {
    const messages = parseWhatsAppWebhook(
      {
        MessageSid: 'SM123',
        From: 'whatsapp:+905551112233',
        To: 'whatsapp:+14155238886',
        Body: 'Merhaba',
        NumMedia: '0',
      },
      'twilio'
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      from: '+905551112233',
      messageId: 'SM123',
      text: 'Merhaba',
      type: 'text',
    });
  });

  it('ignores Twilio status callbacks without message content', () => {
    const messages = parseWhatsAppWebhook(
      {
        MessageSid: 'SM_STATUS',
        From: 'whatsapp:+14155238886',
        MessageStatus: 'delivered',
        NumMedia: '0',
      },
      'twilio'
    );

    expect(messages).toEqual([]);
  });
});

describe('sendWhatsAppMessage (twilio)', () => {
  it('sends via Twilio Messages API with whatsapp-prefixed addresses', async () => {
    const fetchMock = vi.mocked(global.fetch as any);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ sid: 'SM999' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }) as any
    );

    const creds: TwilioWhatsAppCredentials = {
      provider: 'twilio',
      accountSid: 'AC1234567890',
      authToken: 'twilio-auth-token',
      fromNumber: '+14155238886',
    };

    const result = await sendWhatsAppMessage(
      { to: '+905551112233', text: 'Hello from test' },
      creds
    );

    expect(result).toEqual({ success: true, messageId: 'SM999', provider: 'twilio' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/Accounts/AC1234567890/Messages.json');
    expect(options.method).toBe('POST');
    expect((options.headers as Record<string, string>).Authorization).toContain('Basic ');

    const form = new URLSearchParams(String(options.body));
    expect(form.get('From')).toBe('whatsapp:+14155238886');
    expect(form.get('To')).toBe('whatsapp:+905551112233');
    expect(form.get('Body')).toBe('Hello from test');
  });

  it('classifies Twilio 429 responses as retryable rate limits', async () => {
    const fetchMock = vi.mocked(global.fetch as any);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Too many requests', code: 20429 }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'Retry-After': '7' },
      }) as any
    );

    const creds: TwilioWhatsAppCredentials = {
      provider: 'twilio',
      accountSid: 'AC1234567890',
      authToken: 'twilio-auth-token',
      fromNumber: '+14155238886',
    };

    const result = await sendWhatsAppMessage(
      { to: '+905551112233', text: 'Hello from test' },
      creds
    );

    expect(result).toMatchObject({
      success: false,
      provider: 'twilio',
      retryable: true,
      rateLimited: true,
      httpStatus: 429,
      errorCode: '20429',
      failureCategory: 'rate_limit',
    });
    expect(result.retryAfterMs).toBe(7000);
  });

  it('classifies Twilio 400 responses as permanent failures', async () => {
    const fetchMock = vi.mocked(global.fetch as any);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Invalid To number', code: 21211 }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }) as any
    );

    const creds: TwilioWhatsAppCredentials = {
      provider: 'twilio',
      accountSid: 'AC1234567890',
      authToken: 'twilio-auth-token',
      fromNumber: '+14155238886',
    };

    const result = await sendWhatsAppMessage(
      { to: '+905551112233', text: 'Hello from test' },
      creds
    );

    expect(result).toMatchObject({
      success: false,
      provider: 'twilio',
      retryable: false,
      httpStatus: 400,
      errorCode: '21211',
      failureCategory: 'permanent',
    });
  });
});
