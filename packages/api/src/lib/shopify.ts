/**
 * Shopify API utilities
 * OAuth flow and API client helpers
 */

import crypto from 'crypto';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const API_URL = process.env.API_URL || 'http://localhost:3001';

if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
  console.warn('Warning: SHOPIFY_API_KEY and SHOPIFY_API_SECRET not set');
}

/**
 * Generate Shopify OAuth authorization URL
 */
export function getShopifyAuthUrl(shop: string, scopes: string[], state: string): string {
  if (!SHOPIFY_API_KEY) {
    throw new Error('SHOPIFY_API_KEY is not configured');
  }

  const redirectUri = `${API_URL}/api/integrations/shopify/oauth/callback`;
  const scope = scopes.join(',');
  
  const params = new URLSearchParams({
    client_id: SHOPIFY_API_KEY,
    scope,
    redirect_uri: redirectUri,
    state,
  });

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Verify Shopify OAuth HMAC
 */
export function verifyShopifyHmac(query: Record<string, string>): boolean {
  if (!SHOPIFY_API_SECRET) {
    throw new Error('SHOPIFY_API_SECRET is not configured');
  }

  const { hmac, ...params } = query;
  if (!hmac) {
    return false;
  }

  // Sort parameters and create message
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  // Calculate HMAC
  const calculatedHmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(sortedParams)
    .digest('hex');

  return calculatedHmac === hmac;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  shop: string,
  code: string
): Promise<{ access_token: string; scope: string }> {
  if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
    throw new Error('Shopify API credentials not configured');
  }

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  return response.json();
}

/**
 * Shopify API client (authenticated requests)
 */
export async function shopifyApiRequest<T>(
  shop: string,
  accessToken: string,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `https://${shop}/admin/api/2024-01${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Shopify API error: ${error}`);
  }

  return response.json();
}

/**
 * Create webhook subscription
 */
export async function createWebhook(
  shop: string,
  accessToken: string,
  topic: string,
  address: string
): Promise<any> {
  return shopifyApiRequest(shop, accessToken, '/webhooks.json', {
    method: 'POST',
    body: JSON.stringify({
      webhook: {
        topic,
        address,
        format: 'json',
      },
    }),
  });
}

/**
 * List webhook subscriptions
 */
export async function listWebhooks(shop: string, accessToken: string): Promise<any> {
  return shopifyApiRequest(shop, accessToken, '/webhooks.json');
}

/**
 * Delete webhook subscription
 */
export async function deleteWebhook(shop: string, accessToken: string, webhookId: string): Promise<void> {
  await shopifyApiRequest(shop, accessToken, `/webhooks/${webhookId}.json`, {
    method: 'DELETE',
  });
}
