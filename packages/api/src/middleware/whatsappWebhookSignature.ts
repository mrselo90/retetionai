import { Context, Next } from 'hono';
import crypto from 'crypto';

function parseSignatureHeader(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (!trimmed) return null;

  // Meta sends: X-Hub-Signature-256: sha256=<hex-digest>
  const [algo, digest] = trimmed.split('=');
  if (algo !== 'sha256' || !digest) return null;
  return digest.trim().toLowerCase();
}

export async function verifyWhatsAppWebhookSignature(c: Context, next: Next) {
  const expectedSecret =
    process.env.APP_SECRET?.trim() ||
    process.env.WHATSAPP_APP_SECRET?.trim() ||
    process.env.META_APP_SECRET?.trim() ||
    '';

  if (!expectedSecret) {
    return c.json({ error: 'Webhook signature verification is not configured' }, 500);
  }

  const headerDigest = parseSignatureHeader(c.req.header('X-Hub-Signature-256'));
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

  const headerDigestBuffer = Buffer.from(headerDigest, 'hex');
  const calculatedDigestBuffer = Buffer.from(calculatedDigest, 'hex');
  if (
    headerDigestBuffer.length === 0 ||
    headerDigestBuffer.length !== calculatedDigestBuffer.length ||
    !crypto.timingSafeEqual(headerDigestBuffer, calculatedDigestBuffer)
  ) {
    return c.json({ error: 'Unauthorized: Invalid webhook signature' }, 401);
  }

  try {
    const parsedBody = JSON.parse(rawBody) as unknown;
    c.set('whatsappWebhookBody', parsedBody);
  } catch {
    return c.json({ error: 'Invalid JSON webhook body' }, 400);
  }

  await next();
}
