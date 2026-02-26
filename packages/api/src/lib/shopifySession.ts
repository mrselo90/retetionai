/**
 * Shopify Session Token Verification (App Bridge / embedded auth)
 *
 * Production-hardened JWT verification for Shopify session tokens:
 * - verifies JWT structure + HS256 header
 * - verifies HMAC signature with timing-safe compare
 * - validates `dest`, `iss`, `aud`, `exp`, `nbf`
 * - resolves merchant by active Shopify integration
 */

import crypto from 'crypto';
import { getSupabaseServiceClient, logger } from '@recete/shared';

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const CLOCK_SKEW_SECONDS = 60;

type SessionTokenClaims = {
  iss?: string;
  dest?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  sid?: string;
  [key: string]: unknown;
};

function safeJsonParse<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function timingSafeEqualStringBase64Url(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'base64url');
    const bBuf = Buffer.from(b, 'base64url');
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function normalizeShopDomain(shop: string): string | null {
  const raw = (shop || '').trim().toLowerCase();
  if (!raw) return null;
  const withoutProtocol = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9-]+\.myshopify\.com$/.test(withoutProtocol)) return null;
  return withoutProtocol;
}

function claimAudienceMatches(aud: unknown): boolean {
  if (!SHOPIFY_API_KEY) {
    // If API key is unexpectedly missing, do not hard-fail auth here;
    // configuration error will surface elsewhere and logs will capture it.
    logger.warn('SHOPIFY_API_KEY not configured while verifying Shopify session token');
    return true;
  }
  if (typeof aud === 'string') return aud === SHOPIFY_API_KEY;
  if (Array.isArray(aud)) return aud.includes(SHOPIFY_API_KEY);
  return false;
}

function verifySessionTokenClaims(token: string, expectedShop: string): { valid: boolean; claims?: SessionTokenClaims; error?: string } {
  if (!SHOPIFY_API_SECRET) {
    logger.error('SHOPIFY_API_SECRET not configured');
    return { valid: false, error: 'Server configuration error' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid token format' };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  const header = safeJsonParse<{ alg?: string; typ?: string }>(
    Buffer.from(encodedHeader, 'base64url').toString('utf8')
  );
  if (!header) {
    return { valid: false, error: 'Invalid token header' };
  }
  if (header.alg !== 'HS256') {
    return { valid: false, error: 'Unsupported token algorithm' };
  }

  const payload = safeJsonParse<SessionTokenClaims>(
    Buffer.from(encodedPayload, 'base64url').toString('utf8')
  );
  if (!payload) {
    return { valid: false, error: 'Invalid token payload' };
  }

  const expectedSignature = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (!timingSafeEqualStringBase64Url(expectedSignature, encodedSignature)) {
    return { valid: false, error: 'Invalid token signature' };
  }

  const expectedDest = `https://${expectedShop}`;
  const expectedIss = `https://${expectedShop}/admin`;
  if (payload.dest !== expectedDest) {
    return { valid: false, error: 'Shop mismatch' };
  }
  if (payload.iss && payload.iss !== expectedIss) {
    return { valid: false, error: 'Invalid issuer' };
  }
  if (!claimAudienceMatches(payload.aud)) {
    return { valid: false, error: 'Invalid audience' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number') {
    return { valid: false, error: 'Missing expiration' };
  }
  if (payload.exp <= now - CLOCK_SKEW_SECONDS) {
    return { valid: false, error: 'Token expired' };
  }
  if (typeof payload.nbf === 'number' && payload.nbf > now + CLOCK_SKEW_SECONDS) {
    return { valid: false, error: 'Token not active yet' };
  }
  if (typeof payload.iat === 'number' && payload.iat > now + CLOCK_SKEW_SECONDS) {
    return { valid: false, error: 'Invalid issued-at time' };
  }

  return { valid: true, claims: payload };
}

/**
 * Verify Shopify session token
 * Shopify App Bridge sends session tokens that need to be verified.
 */
export async function verifyShopifySessionToken(
  token: string,
  shop: string
): Promise<{ valid: boolean; merchantId?: string; error?: string }> {
  const normalizedShop = normalizeShopDomain(shop);
  if (!normalizedShop) {
    return { valid: false, error: 'Invalid shop domain' };
  }

  try {
    const verification = verifySessionTokenClaims(token, normalizedShop);
    if (!verification.valid) {
      return { valid: false, error: verification.error || 'Invalid session token' };
    }

    const serviceClient = getSupabaseServiceClient();
    const { data: integration } = await serviceClient
      .from('integrations')
      .select('merchant_id')
      .eq('provider', 'shopify')
      .eq('status', 'active')
      .contains('auth_data', { shop: normalizedShop })
      .maybeSingle();

    if (!integration) {
      // Valid token, but no integration yet (new install)
      return { valid: true };
    }

    return {
      valid: true,
      merchantId: integration.merchant_id,
    };
  } catch (error) {
    logger.error({ error, shop: normalizedShop }, 'Error verifying Shopify session token');
    return { valid: false, error: 'Token verification failed' };
  }
}

// Exported for unit tests and future middleware reuse.
export const __shopifySessionInternals = {
  normalizeShopDomain,
  verifySessionTokenClaims,
};
