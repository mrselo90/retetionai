/**
 * Shopify OAuth and webhook routes
 */

import { Hono } from 'hono';
import { getSupabaseServiceClient } from '@recete/shared';
import { authMiddleware } from '../middleware/auth.js';
import {
  getShopifyAuthUrl,
  verifyShopifyHmac,
  exchangeCodeForToken,
  createWebhook,
  listWebhooks,
  fetchShopifyProducts,
} from '../lib/shopify.js';
import { verifyShopifySessionToken } from '../lib/shopifySession.js';
import { logger } from '@recete/shared';
import * as crypto from 'crypto';

const shopify = new Hono();

/**
 * Start Shopify OAuth flow
 * GET /api/integrations/shopify/oauth/start?shop=example.myshopify.com
 */
shopify.get('/oauth/start', authMiddleware, async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const shop = c.req.query('shop');

    if (!shop) {
      return c.json({ error: 'shop parameter is required' }, 400);
    }

    // Validate shop domain format
    if (!shop.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/)) {
      return c.json({ error: 'Invalid shop domain format' }, 400);
    }

    // Generate state token (store merchant_id for callback)
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in database or Redis (for now, we'll encode merchant_id in state)
    // In production, use Redis with TTL
    const stateWithMerchant = `${merchantId}:${state}`;

    // Required scopes: always include read_products and others; merge with env so env cannot drop them
    const defaultScopes = [
      'read_products',
      'read_orders',
      'read_fulfillments',
      'read_customers',
      'write_webhooks',
    ];

    const envScopes = process.env.SHOPIFY_SCOPES ? process.env.SHOPIFY_SCOPES.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const scopes = Array.from(new Set([...defaultScopes, ...envScopes]));

    const authUrl = getShopifyAuthUrl(shop, scopes, stateWithMerchant);

    return c.json({
      authUrl,
      shop,
      state: stateWithMerchant, // In production, don't return state to client
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Alias for /oauth/start (for frontend compatibility)
 * POST /api/integrations/shopify/auth
 */
shopify.post('/auth', authMiddleware, async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const body = await c.req.json() as { shop: string };
    const shop = body.shop;

    if (!shop) {
      return c.json({ error: 'shop parameter is required' }, 400);
    }

    // Validate shop domain format
    if (!shop.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/)) {
      return c.json({ error: 'Invalid shop domain format' }, 400);
    }

    // Generate state token
    const state = crypto.randomBytes(32).toString('hex');
    const stateWithMerchant = `${merchantId}:${state}`;

    // Required scopes
    const defaultScopes = [
      'read_products', // Ensure this comes first
      'read_orders',
      'read_fulfillments',
      'read_customers',
      'write_webhooks',
    ];

    // Always ensure default scopes (especially read_products) are included
    const envScopes = process.env.SHOPIFY_SCOPES ? process.env.SHOPIFY_SCOPES.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const uniqueScopes = Array.from(new Set([...defaultScopes, ...envScopes]));
    const scopes = uniqueScopes;

    const authUrl = getShopifyAuthUrl(shop, scopes, stateWithMerchant);

    return c.json({
      authUrl,
      shop,
      state: stateWithMerchant,
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Get the exact redirect URI this app uses for Shopify OAuth.
 * No auth required – use this to copy the URL into Shopify Partner Dashboard.
 * GET /api/integrations/shopify/oauth/redirect-uri
 */
shopify.get('/oauth/redirect-uri', (c) => {
  const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${frontendUrl}/api/integrations/shopify/oauth/callback`;
  const hasCredentials = !!(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET);
  return c.json({
    redirectUri,
    hint: 'Add this exact URL to Shopify Partner Dashboard → Configuration → Allowed redirection URL(s)',
    hasCredentials,
    message: hasCredentials
      ? 'Credentials are set. Ensure the URL above is in Shopify Partner Dashboard.'
      : 'Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET in .env (API) for OAuth to work.',
  });
});

/**
 * Shopify OAuth callback
 * GET /api/integrations/shopify/oauth/callback?code=...&shop=...&state=...
 * Note: This endpoint is called by Shopify directly, so it doesn't use authMiddleware
 */
shopify.get('/oauth/callback', async (c) => {
  try {
    const query = c.req.query();
    const { code, shop, state, hmac } = query;

    // Validate required parameters
    if (!code || !shop || !state || !hmac) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return c.redirect(`${frontendUrl}/dashboard/integrations/shopify/callback?error=${encodeURIComponent('Missing required OAuth parameters')}`);
    }

    // Verify HMAC (must match Shopify Partner Dashboard Client secret)
    if (!verifyShopifyHmac(query as Record<string, string>)) {
      logger.warn({ shop }, 'Shopify OAuth callback: HMAC verification failed – check SHOPIFY_API_SECRET matches Partner Dashboard Client secret');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return c.redirect(`${frontendUrl}/dashboard/integrations/shopify/callback?error=${encodeURIComponent('Invalid HMAC signature – check SHOPIFY_API_SECRET matches Shopify Partner Dashboard Client secret')}`);
    }

    // Extract merchant_id from state
    const [merchantId, stateToken] = state.split(':');
    if (!merchantId) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return c.redirect(`${frontendUrl}/dashboard/integrations?error=${encodeURIComponent('Invalid state parameter')}`);
    }

    // Validate shop domain
    if (!shop.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/)) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return c.redirect(`${frontendUrl}/dashboard/integrations/shopify/callback?error=${encodeURIComponent('Invalid shop domain format')}`);
    }

    // Exchange code for access token
    let tokenData;
    try {
      tokenData = await exchangeCodeForToken(shop, code);
      console.log('Shopify OAuth successful. Received scopes:', tokenData.scope);
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return c.redirect(`${frontendUrl}/dashboard/integrations/shopify/callback?error=${encodeURIComponent(error instanceof Error ? error.message : 'Failed to exchange code for token')}`);
    }

    const serviceClient = getSupabaseServiceClient();

    // Check if integration already exists
    const { data: existing } = await serviceClient
      .from('integrations')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('provider', 'shopify')
      .single();

    if (existing) {
      // Update existing integration
      const { error: updateError } = await serviceClient
        .from('integrations')
        .update({
          status: 'active',
          auth_data: {
            shop,
            access_token: tokenData.access_token,
            scope: tokenData.scope,
          },
        })
        .eq('id', existing.id);

      if (updateError) {
        // Redirect to frontend with error
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return c.redirect(`${frontendUrl}/dashboard/integrations/shopify/callback?error=${encodeURIComponent('Failed to update integration')}`);
      }

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return c.redirect(`${frontendUrl}/dashboard/integrations/shopify/callback?success=true&message=${encodeURIComponent('Shopify integration updated successfully')}`);
    } else {
      // Create new integration
      const { data: integration, error: createError } = await serviceClient
        .from('integrations')
        .insert({
          merchant_id: merchantId,
          provider: 'shopify',
          status: 'active',
          auth_type: 'oauth',
          auth_data: {
            shop,
            access_token: tokenData.access_token,
            scope: tokenData.scope,
          },
        })
        .select('id')
        .single();

      if (createError) {
        // Redirect to frontend with error
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return c.redirect(`${frontendUrl}/dashboard/integrations/shopify/callback?error=${encodeURIComponent('Failed to create integration')}`);
      }

      // Redirect to frontend with success
      // Support both standalone and embedded app redirects
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const host = c.req.query('host'); // Shopify host parameter for embedded apps

      if (host) {
        // Embedded app: redirect to Shopify admin
        return c.redirect(
          `${frontendUrl}/dashboard/integrations/shopify/callback?success=true&shop=${shop}&host=${host}&message=${encodeURIComponent('Shopify integration created successfully')}`
        );
      } else {
        // Standalone app
        return c.redirect(
          `${frontendUrl}/dashboard/integrations/shopify/callback?success=true&shop=${shop}&message=${encodeURIComponent('Shopify integration created successfully')}`
        );
      }
    }
  } catch (error) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return c.redirect(`${frontendUrl}/dashboard/integrations/shopify/callback?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
  }
});

/**
 * Subscribe to Shopify webhooks
 * POST /api/integrations/shopify/webhooks/subscribe
 */
shopify.post('/webhooks/subscribe', authMiddleware, async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;

    // Get Shopify integration
    const serviceClient = getSupabaseServiceClient();
    const { data: integration, error: fetchError } = await serviceClient
      .from('integrations')
      .select('id, auth_data')
      .eq('merchant_id', merchantId)
      .eq('provider', 'shopify')
      .eq('status', 'active')
      .single();

    if (fetchError || !integration) {
      return c.json({ error: 'Shopify integration not found or inactive' }, 404);
    }

    const authData = integration.auth_data as { shop: string; access_token: string };
    const { shop, access_token } = authData;

    if (!shop || !access_token) {
      return c.json({ error: 'Invalid integration auth data' }, 400);
    }

    // Webhook URL (will receive Shopify events)
    const webhookUrl = `${process.env.API_URL || 'http://localhost:3001'}/webhooks/commerce/shopify`;

    // Required webhooks
    const webhooks = [
      { topic: 'orders/create', address: webhookUrl },
      { topic: 'orders/fulfilled', address: webhookUrl },
      { topic: 'orders/updated', address: webhookUrl },
    ];

    const results = [];

    // Check existing webhooks first
    const existingWebhooks = await listWebhooks(shop, access_token);
    const existingTopics = (existingWebhooks.webhooks || []).map((w: any) => w.topic);

    // Create webhooks
    for (const webhook of webhooks) {
      if (existingTopics.includes(webhook.topic)) {
        results.push({
          topic: webhook.topic,
          status: 'already_exists',
        });
        continue;
      }

      try {
        const result = await createWebhook(shop, access_token, webhook.topic, webhook.address);
        results.push({
          topic: webhook.topic,
          status: 'created',
          webhookId: result.webhook?.id,
        });
      } catch (error) {
        results.push({
          topic: webhook.topic,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return c.json({
      message: 'Webhook subscription completed',
      results,
    });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Get Shopify store products (Admin GraphQL) for product→recipe mapping
 * GET /api/integrations/shopify/products?after=<cursor>&first=50
 */
shopify.get('/products', authMiddleware, async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const after = c.req.query('after');
    const first = Math.min(parseInt(c.req.query('first') || '50', 10) || 50, 250);

    const serviceClient = getSupabaseServiceClient();
    const { data: integration, error: fetchError } = await serviceClient
      .from('integrations')
      .select('id, auth_data')
      .eq('merchant_id', merchantId)
      .eq('provider', 'shopify')
      .eq('status', 'active')
      .single();

    if (fetchError || !integration) {
      return c.json({ error: 'Shopify integration not found or inactive' }, 404);
    }

    const authData = integration.auth_data as { shop: string; access_token: string; scope?: string };
    const shopDomain = authData?.shop;
    const accessToken = authData?.access_token;
    if (!shopDomain || !accessToken) {
      return c.json({ error: 'Invalid integration auth data' }, 400);
    }

    // If stored scope is missing read_products, ask user to re-authorize (avoids opaque Shopify errors)
    const scope = (authData.scope || '').toLowerCase();
    if (scope && !scope.includes('read_products')) {
      return c.json({
        error: 'Shopify app is missing product access',
        code: 'SHOPIFY_SCOPE_REQUIRED',
        message: 'Reconnect your Shopify store and accept product access so we can load your products.',
      }, 403);
    }

    const result = await fetchShopifyProducts(shopDomain, accessToken, first, after || undefined);
    return c.json({
      products: result.products,
      hasNextPage: result.hasNextPage,
      endCursor: result.endCursor,
    });
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'SHOPIFY_SCOPE_REQUIRED') {
      return c.json({
        error: 'Shopify product access required',
        code: 'SHOPIFY_SCOPE_REQUIRED',
        message: 'Reconnect your Shopify store and accept product access to load products.',
      }, 403);
    }
    logger.error({ error }, 'Error fetching Shopify products');
    return c.json({
      error: 'Internal server error',
      message: err.message || 'Unknown error',
    }, 500);
  }
});

/**
 * Verify Shopify session token (for App Bridge)
 * POST /api/integrations/shopify/verify-session
 */
shopify.post('/verify-session', async (c) => {
  try {
    const body = await c.req.json() as { token: string; shop: string };
    const { token, shop } = body;

    if (!token || !shop) {
      return c.json({ error: 'Missing token or shop' }, 400);
    }

    const verification = await verifyShopifySessionToken(token, shop);

    if (!verification.valid) {
      return c.json({
        error: verification.error || 'Invalid session token'
      }, 401);
    }

    return c.json({
      valid: true,
      merchantId: verification.merchantId,
    });
  } catch (error) {
    logger.error({ error }, 'Error verifying session token');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default shopify;
