/**
 * Signed `state` for the dashboard's Shopify OAuth flow.
 *
 * The callback binds the returned shop to the merchant named in `state`. It used
 * to be plain base64 JSON, so anyone could put a victim's merchant id in it,
 * approve the install on their own shop, and overwrite the victim's Shopify
 * integration. The state is now HMAC-signed with the app secret, tied to the shop
 * it was issued for, and expires.
 */

import crypto from 'crypto';

const STATE_TTL_MS = 10 * 60 * 1000;

interface OAuthStatePayload {
  merchantId: string;
  shop: string;
  iat: number;
  n: string;
}

function getStateSecret(): string {
  const secret = process.env.SHOPIFY_API_SECRET?.trim();
  if (!secret) {
    throw new Error('SHOPIFY_API_SECRET is not configured');
  }
  return secret;
}

function sign(encodedPayload: string): string {
  return crypto
    .createHmac('sha256', getStateSecret())
    .update(`shopify-oauth-state:${encodedPayload}`)
    .digest('base64url');
}

export function createShopifyOAuthState(merchantId: string, shop: string, now = Date.now()): string {
  const payload: OAuthStatePayload = {
    merchantId,
    shop,
    iat: now,
    n: crypto.randomBytes(8).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Returns the merchant id the state was issued for, or null when the state is
 * forged, expired, or was issued for a different shop.
 */
export function verifyShopifyOAuthState(
  state: string,
  shop: string,
  now = Date.now()
): string | null {
  const [encoded, signature, ...rest] = state.split('.');
  if (!encoded || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(encoded));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return null;
  }

  let payload: Partial<OAuthStatePayload>;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload.merchantId !== 'string' || !payload.merchantId) return null;
  if (payload.shop !== shop) return null;
  if (typeof payload.iat !== 'number' || now - payload.iat > STATE_TTL_MS || payload.iat > now + 60_000) {
    return null;
  }
  return payload.merchantId;
}
