/**
 * Authentication middleware for Hono
 * Validates merchant authentication via JWT or API key
 */

import { Context, Next } from 'hono';
import { getSupabaseServiceClient } from '@recete/shared';
import { isValidApiKeyFormat, hashApiKey } from '@recete/shared';
import {
  normalizeApiKeys,
  getApiKeyByHash,
  isApiKeyExpired,
  updateApiKeyLastUsed,
} from '../lib/apiKeyManager.js';

export interface AuthContext {
  merchantId: string;
  authMethod: 'jwt' | 'api_key';
}

/**
 * Extract token from Authorization or X-Api-Key header
 */
function extractToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization');
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return authHeader;
  }

  return c.req.header('X-Api-Key') || null;
}

/**
 * Authenticate via JWT (Supabase Auth).
 * For OAuth (e.g. Google) users: create merchant if missing (first-time social login).
 */
async function authenticateJWT(token: string): Promise<string | null> {
  try {
    const supabase = getSupabaseServiceClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      if (error) {
        console.warn('JWT Verification failed:', error.message);
      }
      return null;
    }

    const { data: merchant, error: fetchError } = await supabase
      .from('merchants')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Merchant lookup error:', fetchError.message);
      return null;
    }

    // First-time OAuth user: create merchant so they can use the app
    if (!merchant) {
      const name =
        (user.user_metadata?.full_name as string) ||
        (user.user_metadata?.name as string) ||
        (user.email ?? 'Merchant');

      console.info(`Creating merchant record for user ${user.id} (${name})`);

      const { data: inserted, error: insertError } = await supabase
        .from('merchants')
        .insert({
          id: user.id,
          name: typeof name === 'string' ? name.slice(0, 255) : 'Merchant',
          api_keys: [],
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Failed to create merchant record:', insertError.message);
        return null;
      }

      return inserted?.id ?? null;
    }

    return merchant.id;
  } catch (err) {
    console.error('JWT Authentication exception:', err);
    return null;
  }
}

/**
 * Authenticate via API key
 */
async function authenticateApiKey(apiKey: string): Promise<string | null> {
  if (!isValidApiKeyFormat(apiKey)) {
    return null;
  }

  try {
    const supabase = getSupabaseServiceClient();
    const hashedKey = hashApiKey(apiKey);

    // Query merchants where api_keys array contains the hashed key
    // Supports both legacy string format ["hash"] and new object format [{"hash": "hash"}]
    const { data: merchants, error } = await supabase
      .from('merchants')
      .select('id, api_keys')
      .or(`api_keys.cs.["${hashedKey}"],api_keys.cs.[{"hash":"${hashedKey}"}]`)
      .limit(1);

    if (error || !merchants || merchants.length === 0) {
      if (error) console.error('API key lookup error:', error.message);
      return null;
    }

    const merchant = merchants[0];

    // Normalize and check if key is expired
    const normalizedKeys = normalizeApiKeys((merchant.api_keys as any) || []);
    const keyObject = getApiKeyByHash(normalizedKeys, hashedKey);

    if (!keyObject) {
      return null;
    }

    // Check if key is expired
    if (isApiKeyExpired(keyObject)) {
      return null;
    }

    // Update last used timestamp (async, don't wait)
    const updatedKeys = updateApiKeyLastUsed(normalizedKeys, hashedKey);
    void supabase
      .from('merchants')
      .update({ api_keys: updatedKeys })
      .eq('id', merchant.id);

    return merchant.id;
  } catch (err) {
    console.error('API Key Authentication exception:', err);
    return null;
  }
}

/**
 * Authenticate via Shopify Session Token
 */
async function authenticateShopifyToken(token: string): Promise<string | null> {
  // Quick check: Shopify tokens are JWTs usually starting with ey...
  // We rely on verifyShopifySessionToken to do the heavy lifting
  // We need to import verifyShopifySessionToken dynamically or move it to shared to avoid circular deps?
  // Actually verifyShopifySessionToken is in lib/shopifySession.ts which is fine to import.

  // Note: We need a 'shop' to verify the token fully (signature depends on secret, but shop claim check is good).
  // verifyShopifySessionToken takes (token, shop).
  // But we don't have 'shop' in the request params here easily (it might be in header?).
  // Actually, we can decode the token unverified first to get the dest (shop), then verify.

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    if (!payload.dest || !payload.dest.startsWith('https://')) return null;

    const shop = payload.dest.replace('https://', '');

    // Import dynamically to ensure no circular deps issues if any
    const { verifyShopifySessionToken } = await import('../lib/shopifySession.js');

    const verification = await verifyShopifySessionToken(token, shop);
    if (!verification.valid) return null;

    // If we have a merchantId, return it
    if (verification.merchantId) return verification.merchantId;

    // If valid but no merchant (new install), we can't authenticate them for *general* API usage yet.
    // They must hit the /verify-session endpoint to create the account first.
    return null;
  } catch (e) {
    return null;
  }
}


/** Paths that accept X-Internal-Key for worker/service-to-service auth */
const INTERNAL_KEY_PATHS = [
  '/api/products/enrich',
  /^\/api\/products\/[^/]+\/generate-embeddings$/,
];

function isInternalKeyPath(path: string): boolean {
  return path === INTERNAL_KEY_PATHS[0] || (INTERNAL_KEY_PATHS[1] as RegExp).test(path);
}

/**
 * Auth middleware
 * Supports both JWT (Supabase Auth) and API key authentication.
 * Also allows X-Internal-Key for internal routes (e.g. worker calling enrich / generate-embeddings).
 */
export async function authMiddleware(c: Context, next: Next) {
  const path = c.req.path;
  const internalKey = c.req.header('X-Internal-Key');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (internalKey && expectedKey && internalKey === expectedKey && isInternalKeyPath(path)) {
    c.set('internalCall', true);
    c.set('merchantId', '');
    c.set('authMethod', 'api_key');
    return next();
  }

  const token = extractToken(c);

  if (!token) {
    return c.json({ error: 'Unauthorized: Missing authentication' }, 401);
  }

  // Try JWT first (Supabase Auth)
  let merchantId = await authenticateJWT(token);
  let authMethod: 'jwt' | 'api_key' = 'jwt';

  // If JWT fails, try API key
  if (!merchantId) {
    merchantId = await authenticateApiKey(token);
    authMethod = 'api_key';
  }

  // If API key fails, try Shopify Session Token
  if (!merchantId) {
    merchantId = await authenticateShopifyToken(token);
    // treated as jwt for simplicity, or we could add 'shopify_token'
    authMethod = 'jwt';
  }

  if (!merchantId) {
    return c.json({ error: 'Unauthorized: Invalid token or API key' }, 401);
  }

  // Add merchant context to request
  c.set('merchantId', merchantId);
  c.set('authMethod', authMethod);

  await next();
}

/**
 * Optional auth middleware (doesn't fail if no auth provided)
 * Useful for public endpoints that can optionally use auth
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const token = extractToken(c);

  if (token) {
    // Try to authenticate
    let merchantId = await authenticateJWT(token);
    let authMethod: 'jwt' | 'api_key' = 'jwt';

    if (!merchantId) {
      merchantId = await authenticateApiKey(token);
      authMethod = 'api_key';
    }

    if (merchantId) {
      c.set('merchantId', merchantId);
      c.set('authMethod', authMethod);
    }
  }

  await next();
}
