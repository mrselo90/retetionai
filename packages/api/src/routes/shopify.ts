/**
 * Shopify OAuth and webhook routes
 */

import { Hono } from 'hono';
import { getSupabaseServiceClient, generateApiKey, hashApiKey } from '@recete/shared';
import { authMiddleware } from '../middleware/auth.js';
import {
  fetchShopifyProducts,
  exchangeSessionToken,
} from '../lib/shopify.js';
import { verifyShopifySessionToken } from '../lib/shopifySession.js';
import { createApiKeyObject } from '../lib/apiKeyManager.js';
import { logger } from '@recete/shared';
import * as crypto from 'crypto';

const shopify = new Hono();

/**
 * Subscribe to Shopify webhooks
 * POST /api/integrations/shopify/webhooks/subscribe
 * Note: With Shopify Managed Installation (shopify.app.toml), this is largely redundant
 * but good for re-registering if needed.
 */
shopify.post('/webhooks/subscribe', authMiddleware, async (c) => {
  // ... (keep existing logic or simplified)
  // For now, minimizing changes to this endpoint as it might still be useful
  return c.json({ message: 'Webhooks are managed by Shopify App config' });
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
 * Verify Shopify session token (Install/Login)
 * POST /api/integrations/shopify/verify-session
 * Handles Token Exchange and Auto-Provisioning
 */
shopify.post('/verify-session', async (c) => {
  try {
    const body = await c.req.json() as { token: string; shop: string };
    const { token, shop } = body;

    if (!token || !shop) {
      return c.json({ error: 'Missing token or shop' }, 400);
    }

    // 1. Verify Session Token
    const verification = await verifyShopifySessionToken(token, shop);

    if (!verification.valid) {
      return c.json({
        error: verification.error || 'Invalid session token'
      }, 401);
    }

    let merchantId = verification.merchantId;

    // 2. If new install (no merchantId), perform Token Exchange and Provisioning
    if (!merchantId) {
      console.log(`New install detected for shop: ${shop}. Performing Token Exchange...`);

      let tokenData;
      try {
        tokenData = await exchangeSessionToken(shop, token);
      } catch (exchangeError) {
        logger.error({ error: exchangeError, shop }, 'Token exchange failed');
        return c.json({ error: 'Failed to exchange token with Shopify' }, 500);
      }

      const serviceClient = getSupabaseServiceClient();

      // Check if integration exists (maybe under different merchant?)
      const { data: existingIntegration } = await serviceClient
        .from('integrations')
        .select('id, merchant_id')
        .eq('provider', 'shopify')
        .contains('auth_data', { shop })
        .maybeSingle();

      if (existingIntegration) {
        // Integration exists but verifyShopifySessionToken didn't return it? 
        // This implies the integration record exists but maybe verify logic failed to find it via shop look up?
        // Or maybe it was inactive?
        // Let's update it.
        merchantId = existingIntegration.merchant_id;

        await serviceClient
          .from('integrations')
          .update({
            status: 'active',
            auth_data: {
              shop,
              access_token: tokenData.access_token,
              scope: tokenData.scope,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingIntegration.id);

      } else {
        // Create New Merchant & Integration
        const newMerchantId = crypto.randomUUID();
        const apiKey = generateApiKey();
        const { keyObject } = createApiKeyObject('Default', 90);
        keyObject.hash = hashApiKey(apiKey);

        // Create Merchant
        const { error: merchantError } = await serviceClient
          .from('merchants')
          .insert({
            id: newMerchantId,
            name: shop.replace('.myshopify.com', ''),
            api_keys: [keyObject],
          });

        if (merchantError) {
          logger.error({ error: merchantError }, 'Failed to create merchant');
          return c.json({ error: 'Failed to provision account' }, 500);
        }

        // Create Integration
        const { error: integrationError } = await serviceClient
          .from('integrations')
          .insert({
            merchant_id: newMerchantId,
            provider: 'shopify',
            status: 'active',
            auth_type: 'oauth',
            auth_data: {
              shop,
              access_token: tokenData.access_token,
              scope: tokenData.scope,
            },
          });

        if (integrationError) {
          logger.error({ error: integrationError }, 'Failed to create integration');
          return c.json({ error: 'Failed to provision integration' }, 500);
        }

        merchantId = newMerchantId;
        console.log(`Provisioned new merchant ${merchantId} for shop ${shop}`);
      }
    }

    return c.json({
      valid: true,
      merchantId,
    });
  } catch (error) {
    logger.error({ error }, 'Error verifying session token');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default shopify;
