/**
 * Shopify offline access tokens for the API and workers.
 *
 * Public apps get expiring offline tokens: the access token lives 60 minutes and
 * comes with a rotating refresh token. Shopify keeps one token chain per app and
 * store, and acquiring or refreshing a token from a second place retires the
 * other's tokens, so every chain has exactly one owner:
 *
 * - "shell": installed through the Shopify app (install-sync). The app's session
 *   storage holds the refresh token and refreshes it; we ask its
 *   /internal/offline-token endpoint and cache the result on the integration row.
 * - "api": acquired by the API itself (dashboard OAuth, /verify-session). The
 *   refresh token lives in auth_data and is refreshed here under a Redis lock.
 *
 * Rows written before this existed have no token_owner and no refresh token;
 * they came from install-sync, so they are treated as shell-owned.
 */

import { getSupabaseServiceClient } from './supabase.js';
import { getRedisClient } from './redis.js';
import { logger } from './logger.js';

const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const LOCK_TTL_MS = 20_000;
const REQUEST_TIMEOUT_MS = 15_000;

export interface ShopifyAuthData {
  shop: string;
  access_token: string;
  scope?: string | null;
  /** ISO time the access token expires; absent for non-expiring tokens. */
  expires_at?: string | null;
  refresh_token?: string | null;
  refresh_token_expires_at?: string | null;
  token_owner?: 'shell' | 'api';
}

export interface ShopifyTokenResponse {
  access_token: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

/** The shop has to open the app again (or redo OAuth) before its token works. */
export class ShopifyReauthRequiredError extends Error {
  constructor(public readonly shop: string, reason: string) {
    super(`Shopify re-authorization required for ${shop}: ${reason}`);
    this.name = 'ShopifyReauthRequiredError';
  }
}

function inSeconds(seconds: number | undefined, now: number): string | null {
  return typeof seconds === 'number' && seconds > 0
    ? new Date(now + seconds * 1000).toISOString()
    : null;
}

/** auth_data for a token chain the API acquired itself (OAuth code or token exchange). */
export function buildApiOwnedShopifyAuthData(
  shop: string,
  token: ShopifyTokenResponse,
  now = Date.now()
): ShopifyAuthData {
  return {
    shop,
    access_token: token.access_token,
    scope: token.scope ?? null,
    expires_at: inSeconds(token.expires_in, now),
    refresh_token: token.refresh_token ?? null,
    refresh_token_expires_at: inSeconds(token.refresh_token_expires_in, now),
    token_owner: 'api',
  };
}

/** auth_data for a token the Shopify app handed over in install-sync. */
export function buildShellOwnedShopifyAuthData(
  shop: string,
  accessToken: string,
  scope: string | null,
  expiresAt: string | null
): ShopifyAuthData {
  return {
    shop,
    access_token: accessToken,
    scope,
    expires_at: expiresAt,
    refresh_token: null,
    refresh_token_expires_at: null,
    token_owner: 'shell',
  };
}

function isFresh(expiresAt: string | null | undefined, now: number): boolean {
  if (!expiresAt) return false;
  const at = Date.parse(expiresAt);
  return Number.isFinite(at) && at - now > REFRESH_MARGIN_MS;
}

function isKnownExpired(expiresAt: string | null | undefined, now: number): boolean {
  if (!expiresAt) return false;
  const at = Date.parse(expiresAt);
  return Number.isFinite(at) && at <= now;
}

async function persistAuthData(integrationId: string, authData: ShopifyAuthData) {
  const { error } = await getSupabaseServiceClient()
    .from('integrations')
    .update({ auth_data: authData, updated_at: new Date().toISOString() })
    .eq('id', integrationId);
  if (error) {
    // The token we got is still good for this call; the next one refreshes again.
    logger.error({ error, shop: authData.shop }, 'Failed to store refreshed Shopify token');
  }
}

function getShellBaseUrl(): string | null {
  // Its own variable: setting SHOPIFY_SHELL_URL also switches on the API's shell
  // plan/usage integration (lib/shopifyShell.ts), which is a separate decision.
  const raw =
    process.env.SHOPIFY_SHELL_INTERNAL_URL?.trim() ||
    process.env.SHOPIFY_SHELL_URL?.trim() ||
    process.env.SHOPIFY_APP_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : null;
}

function getInternalSecret(): string | null {
  return (
    process.env.INTERNAL_SERVICE_SECRET?.trim() || process.env.PLATFORM_INTERNAL_SECRET?.trim() || null
  );
}

async function fetchFromShell(
  integrationId: string,
  auth: ShopifyAuthData,
  now: number
): Promise<string> {
  const baseUrl = getShellBaseUrl();
  const secret = getInternalSecret();
  const fallback = (reason: string) => {
    if (isKnownExpired(auth.expires_at, now)) {
      throw new ShopifyReauthRequiredError(auth.shop, reason);
    }
    return auth.access_token;
  };

  if (!baseUrl || !secret) {
    return fallback('SHOPIFY_SHELL_URL or internal secret is not configured');
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/internal/offline-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
      body: JSON.stringify({ shop: auth.shop }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    logger.warn({ shop: auth.shop, error }, 'Shopify shell unreachable for offline token');
    return fallback('Shopify shell unreachable');
  }

  if (response.status === 409) {
    throw new ShopifyReauthRequiredError(auth.shop, 'refresh token expired or retired');
  }
  if (response.status === 404) {
    // No session in the app: a token the API got another way (legacy dashboard OAuth).
    return fallback('no offline session in the Shopify app');
  }
  if (!response.ok) {
    logger.warn({ shop: auth.shop, status: response.status }, 'Shopify shell offline token failed');
    return fallback(`Shopify shell answered ${response.status}`);
  }

  const payload = (await response.json()) as {
    accessToken?: string;
    expires?: string | null;
    scope?: string | null;
  };
  if (!payload.accessToken) {
    return fallback('Shopify shell returned no token');
  }

  if (payload.accessToken !== auth.access_token || payload.expires !== auth.expires_at) {
    await persistAuthData(
      integrationId,
      buildShellOwnedShopifyAuthData(
        auth.shop,
        payload.accessToken,
        payload.scope ?? auth.scope ?? null,
        payload.expires ?? null
      )
    );
  }
  return payload.accessToken;
}

async function requestRefresh(shop: string, refreshToken: string): Promise<ShopifyTokenResponse> {
  const clientId = process.env.SHOPIFY_API_KEY?.trim();
  const clientSecret = process.env.SHOPIFY_API_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('SHOPIFY_API_KEY and SHOPIFY_API_SECRET are required to refresh Shopify tokens');
  }

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 400 || response.status === 401) {
    throw new ShopifyReauthRequiredError(shop, `refresh rejected (${response.status})`);
  }
  if (!response.ok) {
    throw new Error(`Shopify token refresh for ${shop} failed with ${response.status}`);
  }
  // Never log this body: it holds the new access and refresh tokens.
  return (await response.json()) as ShopifyTokenResponse;
}

async function readAuthData(integrationId: string): Promise<ShopifyAuthData | null> {
  const { data } = await getSupabaseServiceClient()
    .from('integrations')
    .select('auth_data')
    .eq('id', integrationId)
    .maybeSingle();
  return (data?.auth_data as ShopifyAuthData | undefined) ?? null;
}

async function refreshApiOwned(
  integrationId: string,
  auth: ShopifyAuthData,
  now: number
): Promise<string> {
  if (!auth.refresh_token || isKnownExpired(auth.refresh_token_expires_at, now)) {
    throw new ShopifyReauthRequiredError(auth.shop, 'refresh token missing or expired');
  }

  const redis = getRedisClient();
  const lockKey = `shopify:token-refresh:${auth.shop}`;
  const acquired = await redis.set(lockKey, '1', 'PX', LOCK_TTL_MS, 'NX');

  if (!acquired) {
    // Another process is refreshing this shop; wait for it to store the new token.
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const latest = await readAuthData(integrationId);
      if (latest && isFresh(latest.expires_at, Date.now())) return latest.access_token;
    }
    throw new Error(`Timed out waiting for another Shopify token refresh for ${auth.shop}`);
  }

  try {
    // Re-read under the lock: the token may have been refreshed since we loaded the row.
    const latest = (await readAuthData(integrationId)) ?? auth;
    if (isFresh(latest.expires_at, Date.now())) return latest.access_token;

    const token = await requestRefresh(auth.shop, latest.refresh_token || auth.refresh_token);
    const next = buildApiOwnedShopifyAuthData(auth.shop, {
      ...token,
      // Shopify always rotates it, but never drop the one we have if it doesn't.
      refresh_token: token.refresh_token || latest.refresh_token || undefined,
    });
    await persistAuthData(integrationId, next);
    return next.access_token;
  } finally {
    await redis.del(lockKey).catch(() => undefined);
  }
}

/**
 * A working Admin API access token for a Shopify integration row
 * (`{ id, auth_data }` from the integrations table).
 *
 * Throws ShopifyReauthRequiredError when the shop can only recover by
 * re-authorizing; callers should surface that rather than retry.
 */
export async function getShopifyAccessToken(integration: {
  id: string;
  auth_data: unknown;
}): Promise<{ shop: string; accessToken: string }> {
  const auth = integration.auth_data as ShopifyAuthData | null;
  if (!auth?.shop || !auth.access_token) {
    throw new ShopifyReauthRequiredError(auth?.shop || 'unknown', 'integration has no token');
  }

  const now = Date.now();
  if (isFresh(auth.expires_at, now)) {
    return { shop: auth.shop, accessToken: auth.access_token };
  }

  if (auth.token_owner === 'api') {
    if (!auth.expires_at) return { shop: auth.shop, accessToken: auth.access_token };
    return { shop: auth.shop, accessToken: await refreshApiOwned(integration.id, auth, now) };
  }

  return { shop: auth.shop, accessToken: await fetchFromShell(integration.id, auth, now) };
}
