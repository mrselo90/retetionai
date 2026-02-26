import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@recete/shared', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            contains: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null })),
            })),
          })),
        })),
      })),
    })),
  })),
}));

function makeJwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const encodedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

async function loadInternals() {
  vi.resetModules();
  const mod = await import('./shopifySession.js');
  return mod.__shopifySessionInternals;
}

describe('shopifySession verification internals', () => {
  const apiKey = 'test_shopify_api_key';
  const apiSecret = 'test_shopify_api_secret';
  const shop = 'test-store.myshopify.com';

  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = apiKey;
    process.env.SHOPIFY_API_SECRET = apiSecret;
  });

  it('accepts a valid Shopify session token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeJwt(
      {
        iss: `https://${shop}/admin`,
        dest: `https://${shop}`,
        aud: apiKey,
        sub: 'gid://shopify/User/1',
        exp: now + 60,
        nbf: now - 5,
        iat: now - 5,
      },
      apiSecret
    );

    const { verifySessionTokenClaims } = await loadInternals();
    const result = verifySessionTokenClaims(token, shop);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects token with invalid audience', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeJwt(
      {
        iss: `https://${shop}/admin`,
        dest: `https://${shop}`,
        aud: 'wrong_api_key',
        exp: now + 60,
      },
      apiSecret
    );

    const { verifySessionTokenClaims } = await loadInternals();
    const result = verifySessionTokenClaims(token, shop);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid audience');
  });

  it('rejects expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = makeJwt(
      {
        iss: `https://${shop}/admin`,
        dest: `https://${shop}`,
        aud: apiKey,
        exp: now - 3600,
      },
      apiSecret
    );

    const { verifySessionTokenClaims } = await loadInternals();
    const result = verifySessionTokenClaims(token, shop);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Token expired');
  });

  it('normalizes and validates myshopify domains', async () => {
    const { normalizeShopDomain } = await loadInternals();

    expect(normalizeShopDomain('HTTPS://Test-Store.myshopify.com/admin')).toBe('test-store.myshopify.com');
    expect(normalizeShopDomain('evil.com')).toBeNull();
  });
});
