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

  const FRONTEND_URL = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${FRONTEND_URL}/api/integrations/shopify/oauth/callback`;
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

  const data = await response.json();
  console.log('Shopify Token Exchange Response:', JSON.stringify(data, null, 2));
  return data as { access_token: string; scope: string };
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

  return (await response.json()) as T;
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

/** Shopify product variant (price/sku for AI context) */
export interface ShopifyProductVariant {
  id: string;
  title: string;
  price: string;
  sku: string | null;
}

/** Shopify product (Admin GraphQL) – includes details for AI bot context */
export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  /** HTML description – used for RAG / AI responses */
  descriptionHtml?: string;
  /** Product type (e.g. Cream, Serum) */
  productType?: string;
  /** Vendor / brand */
  vendor?: string;
  /** Tags for filtering/context */
  tags?: string[];
  /** Featured image URL */
  featuredImageUrl?: string;
  /** First few variants (price, SKU) for AI context */
  variants?: ShopifyProductVariant[];
}

/**
 * Fetch products from Shopify Admin GraphQL API (with 429 retry)
 * Includes description, type, vendor, tags, image, variants for AI bot context
 */
export async function fetchShopifyProducts(
  shop: string,
  accessToken: string,
  first: number = 50,
  after?: string
): Promise<{ products: ShopifyProduct[]; hasNextPage: boolean; endCursor?: string }> {
  // Ensure shop domain is clean
  const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${cleanShop}/admin/api/2024-01/graphql.json`;

  const query = `
    query getProducts($first: Int!, $after: String) {
      products(first: $first, after: $after, query: "status:active") {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            title
            handle
            status
            descriptionHtml
            productType
            vendor
            tags
            featuredImage { url }
            variants(first: 5) {
              edges {
                node {
                  id
                  title
                  price
                  sku
                }
              }
            }
          }
        }
      }
    }
  `;
  const variables = { first, after: after || null };

  const doFetch = async (): Promise<Response> => {
    try {
      console.log(`Fetching products from Shopify: ${url}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
        console.log(`Rate limited, retrying after ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        return doFetch();
      }
      return res;
    } catch (error) {
      console.error('Fetch error:', error);
      throw new Error(`Network error fetching from Shopify: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const res = await doFetch();
  const rawText = await res.text();

  if (!res.ok) {
    const isPermissionError = res.status === 403 || /access denied|read_products|required access/i.test(rawText);
    const err = new Error(rawText || `Shopify API error: ${res.status}`);
    if (isPermissionError) {
      (err as Error & { code?: string }).code = 'SHOPIFY_SCOPE_REQUIRED';
    }
    throw err;
  }

  let json: any;
  try {
    json = JSON.parse(rawText) as any;
  } catch {
    throw new Error(`Shopify GraphQL error: invalid JSON`);
  }

  const data = json?.data?.products;
  const gqlError = json?.errors?.[0];
  if (!data) {
    const msg = gqlError?.message || 'Invalid GraphQL response';
    const isPermissionError = /access denied|read_products|required access/i.test(msg);
    const err = new Error(msg);
    if (isPermissionError) {
      (err as Error & { code?: string }).code = 'SHOPIFY_SCOPE_REQUIRED';
    }
    throw err;
  }

  const products: ShopifyProduct[] = (data.edges || []).map((e: any) => {
    const n = e.node;
    const variantEdges = n.variants?.edges ?? [];
    const variants: ShopifyProductVariant[] = variantEdges.slice(0, 5).map((ve: any) => {
      const v = ve.node;
      return {
        id: v.id?.replace('gid://shopify/ProductVariant/', '') || v.id,
        title: v.title || '',
        price: v.price || '',
        sku: v.sku ?? null,
      };
    });
    return {
      id: n.id?.replace('gid://shopify/Product/', '') || n.id,
      title: n.title || '',
      handle: n.handle || '',
      status: n.status || '',
      descriptionHtml: n.descriptionHtml ?? undefined,
      productType: n.productType ?? undefined,
      vendor: n.vendor ?? undefined,
      tags: Array.isArray(n.tags) ? n.tags : undefined,
      featuredImageUrl: n.featuredImage?.url ?? undefined,
      variants: variants.length > 0 ? variants : undefined,
    };
  });

  return {
    products,
    hasNextPage: data.pageInfo?.hasNextPage ?? false,
    endCursor: data.pageInfo?.endCursor,
  };
}
