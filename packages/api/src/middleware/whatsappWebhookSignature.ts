import { Context, Next } from 'hono';
import crypto from 'crypto';

type SupportedWebhookProvider = 'meta' | 'twilio';

function parseMetaSignatureHeader(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (!trimmed) return null;

  // Meta sends: X-Hub-Signature-256: sha256=<hex-digest>
  const [algo, digest] = trimmed.split('=');
  if (algo !== 'sha256' || !digest) return null;
  return digest.trim().toLowerCase();
}

function safeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length === 0 || aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function safeEqualHexDigests(aHex: string, bHex: string): boolean {
  const aBuf = Buffer.from(aHex, 'hex');
  const bBuf = Buffer.from(bHex, 'hex');
  if (aBuf.length === 0 || aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function buildTwilioSignatureUrl(c: Context): string {
  const override =
    process.env.TWILIO_WEBHOOK_URL?.trim() || process.env.WHATSAPP_TWILIO_WEBHOOK_URL?.trim();
  if (override) return override;

  const reqUrl = new URL(c.req.url);
  const forwardedProto = c
    .req
    .header('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim();
  const forwardedHost = c
    .req
    .header('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();
  const host = forwardedHost || c.req.header('host') || reqUrl.host;
  const proto = forwardedProto || reqUrl.protocol.replace(':', '');
  return `${proto}://${host}${reqUrl.pathname}${reqUrl.search}`;
}

function computeTwilioSignature(url: string, params: URLSearchParams, authToken: string): string {
  let payload = url;
  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [key, value] of entries) {
    payload += key + value;
  }

  return crypto.createHmac('sha1', authToken).update(payload, 'utf8').digest('base64');
}

function parseFormBodyToObject(params: URLSearchParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of params.entries()) {
    if (!(key in out)) {
      out[key] = value;
      continue;
    }

    const existing = out[key];
    if (Array.isArray(existing)) {
      existing.push(value);
      out[key] = existing;
    } else {
      out[key] = [existing, value];
    }
  }

  return out;
}

function detectWebhookProvider(c: Context): SupportedWebhookProvider | null {
  if (c.req.header('X-Twilio-Signature')) return 'twilio';
  if (c.req.header('X-Hub-Signature-256')) return 'meta';
  return null;
}

async function verifyMetaWebhook(c: Context, next: Next) {
  const expectedSecret =
    process.env.APP_SECRET?.trim() ||
    process.env.WHATSAPP_APP_SECRET?.trim() ||
    process.env.META_APP_SECRET?.trim() ||
    '';

  if (!expectedSecret) {
    return c.json({ error: 'Meta webhook signature verification is not configured' }, 500);
  }

  const headerDigest = parseMetaSignatureHeader(c.req.header('X-Hub-Signature-256'));
  if (!headerDigest) {
    return c.json({ error: 'Missing or invalid X-Hub-Signature-256 header' }, 401);
  }

  let rawBody: string;
  try {
    rawBody = await c.req.text();
  } catch {
    return c.json({ error: 'Unable to read webhook body' }, 400);
  }

  const calculatedDigest = crypto
    .createHmac('sha256', expectedSecret)
    .update(rawBody, 'utf8')
    .digest('hex')
    .toLowerCase();

  if (!safeEqualHexDigests(headerDigest, calculatedDigest)) {
    return c.json({ error: 'Unauthorized: Invalid webhook signature' }, 401);
  }

  try {
    const parsedBody = JSON.parse(rawBody) as unknown;
    c.set('whatsappWebhookBody', parsedBody);
    c.set('whatsappWebhookProvider', 'meta');
  } catch {
    return c.json({ error: 'Invalid JSON webhook body' }, 400);
  }

  await next();
}

async function verifyTwilioWebhook(c: Context, next: Next) {
  const twilioAuthToken =
    process.env.TWILIO_WHATSAPP_AUTH_TOKEN?.trim() || process.env.TWILIO_AUTH_TOKEN?.trim() || '';
  if (!twilioAuthToken) {
    return c.json({ error: 'Twilio webhook signature verification is not configured' }, 500);
  }

  const signatureHeader = c.req.header('X-Twilio-Signature')?.trim();
  if (!signatureHeader) {
    return c.json({ error: 'Missing X-Twilio-Signature header' }, 401);
  }

  let rawBody: string;
  try {
    rawBody = await c.req.text();
  } catch {
    return c.json({ error: 'Unable to read webhook body' }, 400);
  }

  const params = new URLSearchParams(rawBody);
  const signatureUrl = buildTwilioSignatureUrl(c);
  const calculatedSignature = computeTwilioSignature(signatureUrl, params, twilioAuthToken);

  if (!safeEqualStrings(signatureHeader, calculatedSignature)) {
    return c.json({ error: 'Unauthorized: Invalid Twilio webhook signature' }, 401);
  }

  c.set('whatsappWebhookBody', parseFormBodyToObject(params));
  c.set('whatsappWebhookProvider', 'twilio');
  await next();
}

export async function verifyWhatsAppWebhookSignature(c: Context, next: Next) {
  const provider = detectWebhookProvider(c);

  if (provider === 'meta') {
    return verifyMetaWebhook(c, next);
  }
  if (provider === 'twilio') {
    return verifyTwilioWebhook(c, next);
  }

  return c.json(
    {
      error:
        'Missing supported webhook signature header (expected X-Hub-Signature-256 or X-Twilio-Signature)',
    },
    401
  );
}

