/**
 * Authentication middleware for Hono
 * Validates merchant authentication via JWT / Shopify session token / internal secret
 */

import { Context, Next } from 'hono';
import { getSupabaseServiceClient } from '@recete/shared';

export interface AuthContext {
  merchantId: string;
  authMethod: 'jwt' | 'shopify' | 'internal';
}

/**
 * Extract token from Authorization header
 */
function extractToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization');
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return authHeader;
  }

  return null;
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}


/** Internal product routes (worker -> API) */
const INTERNAL_PRODUCT_PATHS = [
  '/api/products/enrich',
  /^\/api\/products\/[^/]+\/generate-embeddings$/,
  '/api/products/chunks/batch',
  /^\/api\/products\/[^/]+\/chunks$/,
];

/** Internal eval/test routes (server-side eval runner) */
const INTERNAL_EVAL_PATHS = [
  '/api/test/rag',
  '/api/test/rag/answer',
];

function isInternalProductPath(path: string): boolean {
  return INTERNAL_PRODUCT_PATHS.some((pattern) =>
    typeof pattern === 'string' ? path === pattern : pattern.test(path)
  );
}

function isInternalEvalPath(path: string): boolean {
  return INTERNAL_EVAL_PATHS.includes(path);
}

function authenticateInternalSecret(c: Context): {
  ok: boolean;
  merchantId?: string;
  error?: string;
  internalCall?: boolean;
  status?: 403 | 500;
} | null {
  const path = c.req.path;
  const isProduct = isInternalProductPath(path);
  const isEval = isInternalEvalPath(path);
  if (!isProduct && !isEval) return null;

  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;
  const providedSecret = c.req.header('X-Internal-Secret');
  const merchantIdHeaderRaw = c.req.header('X-Internal-Merchant-Id');
  const merchantIdHeader = merchantIdHeaderRaw?.trim() || '';

  if (!isNonEmptyString(expectedSecret)) {
    return {
      ok: false,
      status: 500,
      error: 'Internal auth is not configured',
    };
  }

  if (!isNonEmptyString(providedSecret) || providedSecret !== expectedSecret) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden: Invalid internal secret',
    };
  }

  // Fail-closed: internal routes must always carry an explicit merchant context.
  if (!merchantIdHeader) {
    return {
      ok: false,
      status: 403,
      error: isEval
        ? 'Forbidden: Missing X-Internal-Merchant-Id for internal eval route'
        : 'Forbidden: Missing X-Internal-Merchant-Id for internal product route',
    };
  }

  return {
    ok: true,
    merchantId: merchantIdHeader,
    internalCall: isProduct,
  };
}

function setAuthenticatedUser(
  c: Context,
  user: AuthContext
) {
  c.set('merchantId', user.merchantId);
  c.set('authMethod', user.authMethod);
  c.set('user', user);
}

/**
 * Auth middleware
 * Supports JWT (Supabase Auth), Shopify Session Token, and internal-secret authentication.
 * Allows unauthenticated access for internal product routes (enrich, generate-embeddings) so the worker can call them.
 */
export async function authMiddleware(c: Context, next: Next) {
  const token = extractToken(c);

  // Prefer end-user auth (JWT / Shopify session token) over internal-secret auth.
  // This prevents stale/injected X-Internal-Secret headers from breaking browser requests.
  if (token) {
    // Try JWT first (Supabase Auth)
    let merchantId = await authenticateJWT(token);
    let authMethod: 'jwt' | 'shopify' = 'jwt';

    // If JWT fails, try Shopify Session Token
    if (!merchantId) {
      merchantId = await authenticateShopifyToken(token);
      authMethod = 'shopify';
    }

    if (isNonEmptyString(merchantId)) {
      setAuthenticatedUser(c, { merchantId, authMethod });
      await next();
      return;
    }
  }

  const internal = authenticateInternalSecret(c);
  if (internal) {
    if (!internal.ok) {
      return c.json(
        { error: internal.error || 'Forbidden: Internal auth failed' },
        internal.status || 403
      );
    }
    if (internal.internalCall) c.set('internalCall', true);
    if (!isNonEmptyString(internal.merchantId)) {
      return c.json({ error: 'Forbidden: Missing internal merchant context' }, 403);
    }
    setAuthenticatedUser(c, { merchantId: internal.merchantId, authMethod: 'internal' });
    return next();
  }

  if (!token) {
    return c.json({ error: 'Unauthorized: Missing authentication' }, 401);
  }
  return c.json({ error: 'Unauthorized: Invalid token' }, 401);
}

/**
 * Optional auth middleware (doesn't fail if no auth provided)
 * Useful for public endpoints that can optionally use auth
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const internal = authenticateInternalSecret(c);
  if (internal && !internal.ok) {
    return c.json(
      { error: internal.error || 'Forbidden: Internal auth failed' },
      internal.status || 403
    );
  }
  if (internal?.ok) {
    if (internal.internalCall) c.set('internalCall', true);
    if (!isNonEmptyString(internal.merchantId)) {
      return c.json({ error: 'Forbidden: Missing internal merchant context' }, 403);
    }
    setAuthenticatedUser(c, { merchantId: internal.merchantId, authMethod: 'internal' });
    return next();
  }

  const token = extractToken(c);

  if (token) {
    // Try JWT first, then Shopify session token
    let merchantId = await authenticateJWT(token);
    let authMethod: 'jwt' | 'shopify' = 'jwt';

    if (!merchantId) {
      merchantId = await authenticateShopifyToken(token);
      authMethod = 'shopify';
    }

    if (isNonEmptyString(merchantId)) {
      setAuthenticatedUser(c, { merchantId, authMethod });
    }
  }

  await next();
}
