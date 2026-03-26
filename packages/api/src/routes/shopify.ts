/**
 * Shopify OAuth and webhook routes
 */

import { Hono } from 'hono';
import { getSupabaseServiceClient } from '@recete/shared';
import { authMiddleware } from '../middleware/auth.js';
import {
  fetchShopifyProducts,
  exchangeSessionToken,
  getShopifyAuthUrl,
  verifyShopifyHmac,
  exchangeCodeForToken,
} from '../lib/shopify.js';
import { verifyShopifySessionToken } from '../lib/shopifySession.js';
import { getMerchantSubscription } from '../lib/billing.js';
import { getCachedApiResponse, setCachedApiResponse } from '../lib/cache.js';
import { logger } from '@recete/shared';
import * as crypto from 'crypto';

const shopify = new Hono();

function verifyInternalSecret(c: any) {
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET?.trim() || '';
  const providedSecret = c.req.header('X-Internal-Secret')?.trim() || '';

  if (!expectedSecret) {
    return { ok: false as const, status: 500 as const, error: 'Internal auth is not configured' };
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    return { ok: false as const, status: 403 as const, error: 'Forbidden: Invalid internal secret' };
  }

  return { ok: true as const };
}

// Keep this aligned with `packages/shopify-app/shopify.app.toml` managed-install scopes.
const SHOPIFY_OAUTH_SCOPES = [
  'read_products',
  'read_orders',
  'read_fulfillments',
  'read_customers',
  'write_webhooks',
];

async function reactivateMerchantForShopifyInstall(
  merchantId: string,
  serviceClient: ReturnType<typeof getSupabaseServiceClient>,
) {
  const { data: merchant } = await serviceClient
    .from('merchants')
    .select('subscription_status')
    .eq('id', merchantId)
    .maybeSingle();

  const status = typeof merchant?.subscription_status === 'string'
    ? merchant.subscription_status
    : null;

  if (status === 'active' || status === 'trial') {
    return;
  }

  const { error: merchantUpdateError } = await serviceClient
    .from('merchants')
    .update({
      subscription_status: 'trial',
      cancelled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', merchantId);

  if (merchantUpdateError) {
    logger.error(
      { merchantUpdateError, merchantId },
      'Failed to reactivate merchant subscription during Shopify install'
    );
  }
}

/**
 * Official Shopify shell install sync.
 * POST /api/integrations/shopify/install-sync
 */
shopify.post('/install-sync', async (c) => {
  const internal = verifyInternalSecret(c);
  if (!internal.ok) {
    return c.json({ error: internal.error }, internal.status);
  }

  try {
    const body = (await c.req.json()) as {
      shop?: string;
      accessToken?: string;
      scope?: string | null;
    };

    const shopRaw = body.shop?.trim();
    const accessToken = body.accessToken?.trim();
    const scope = body.scope?.trim() || null;

    if (!shopRaw || !accessToken) {
      return c.json({ error: 'shop and accessToken are required' }, 400);
    }

    const shop = shopRaw.includes('.myshopify.com') ? shopRaw : `${shopRaw}.myshopify.com`;
    const serviceClient = getSupabaseServiceClient();

    const { data: existingIntegration } = await serviceClient
      .from('integrations')
      .select('id, merchant_id')
      .eq('provider', 'shopify')
      .contains('auth_data', { shop })
      .maybeSingle();

    if (existingIntegration) {
      const { error: updateError } = await serviceClient
        .from('integrations')
        .update({
          status: 'active',
          auth_type: 'oauth',
          auth_data: {
            shop,
            access_token: accessToken,
            scope,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingIntegration.id);

      if (updateError) {
        logger.error({ updateError, shop }, 'Failed to update Shopify integration via install sync');
        return c.json({ error: 'Failed to update integration' }, 500);
      }

      await reactivateMerchantForShopifyInstall(existingIntegration.merchant_id, serviceClient);

      return c.json({ ok: true, created: false, merchantId: existingIntegration.merchant_id });
    }

    const merchantId = crypto.randomUUID();
    const merchantName = shop.replace('.myshopify.com', '');

    const { error: merchantError } = await serviceClient
      .from('merchants')
      .insert({
        id: merchantId,
        name: merchantName,
      });

    if (merchantError) {
      logger.error({ merchantError, shop }, 'Failed to create merchant via install sync');
      return c.json({ error: 'Failed to create merchant' }, 500);
    }

    const { error: integrationError } = await serviceClient
      .from('integrations')
      .insert({
        merchant_id: merchantId,
        provider: 'shopify',
        status: 'active',
        auth_type: 'oauth',
        auth_data: {
          shop,
          access_token: accessToken,
          scope,
        },
      });

    if (integrationError) {
      logger.error({ integrationError, shop, merchantId }, 'Failed to create Shopify integration via install sync');
      return c.json({ error: 'Failed to create integration' }, 500);
    }

    return c.json({ ok: true, created: true, merchantId });
  } catch (err) {
    logger.error({ err }, 'Shopify install sync error');
    return c.json({ error: 'Failed to sync Shopify install' }, 500);
  }
});

async function buildMerchantOverviewResponse(c: any, merchantId: string, integration: any, shop: string) {
  try {
    const cacheKey = `shopify-merchant-overview:${merchantId}:${shop}`;
    const cached = await getCachedApiResponse(cacheKey);
    if (cached) {
      return c.json(cached);
    }

    const serviceClient = getSupabaseServiceClient();
    const [
      merchantResult,
      ordersCountResult,
      activeUsersCountResult,
      productsCountResult,
      productRowsResult,
      integrationsResult,
      recentOrdersResult,
    ] = await Promise.all([
      serviceClient
        .from('merchants')
        .select('id, name, created_at, subscription_plan, subscription_status, trial_ends_at, notification_phone, persona_settings')
        .eq('id', merchantId)
        .maybeSingle(),
      serviceClient
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchantId),
      serviceClient
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchantId)
        .eq('consent_status', 'active'),
      serviceClient
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchantId),
      serviceClient
        .from('products')
        .select('id, name, external_id, updated_at, created_at')
        .eq('merchant_id', merchantId)
        .order('updated_at', { ascending: false })
        .limit(6),
      serviceClient
        .from('integrations')
        .select('id, provider, status, updated_at')
        .eq('merchant_id', merchantId)
        .order('provider', { ascending: true }),
      serviceClient
        .from('orders')
        .select('id, external_order_id, status, created_at, delivery_date')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    if (merchantResult.error || !merchantResult.data) {
      return c.json({ error: 'Merchant not found' }, 404);
    }

    const { data: conversations } = await serviceClient
      .from('conversations')
      .select('id, history, users!inner(merchant_id)')
      .eq('users.merchant_id', merchantId);

    const conversationCount = (conversations || []).length;
    const resolvedConversationCount = (conversations || []).filter((conv: any) =>
      Array.isArray(conv.history) ? conv.history.length >= 2 : false,
    ).length;
    const responseRate = conversationCount > 0
      ? Math.round(
          (resolvedConversationCount /
            conversationCount) *
            100,
        )
      : 0;

    const [{ data: analyticsEvents }, { count: returnedOrders }, { count: preventedReturns }] =
      await Promise.all([
        serviceClient
          .from('analytics_events')
          .select('sentiment_score')
          .eq('merchant_id', merchantId)
          .not('sentiment_score', 'is', null),
        serviceClient
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('merchant_id', merchantId)
          .eq('status', 'returned'),
        serviceClient
          .from('return_prevention_attempts')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', merchantId)
          .eq('outcome', 'prevented'),
      ]);

    const avgSentiment = analyticsEvents && analyticsEvents.length > 0
      ? analyticsEvents.reduce((sum: number, event: any) => sum + (Number(event.sentiment_score) || 0), 0) / analyticsEvents.length
      : 0;

    const totalOrders = ordersCountResult.count || 0;
    const returnRate = totalOrders > 0
      ? Math.round(((returnedOrders || 0) / totalOrders) * 100)
      : 0;

    let subscription = null;
    try {
      subscription = await getMerchantSubscription(merchantId);
    } catch (error) {
      logger.warn({ error, merchantId }, 'Failed to resolve merchant subscription for Shopify overview');
    }

    const payload = {
      merchant: merchantResult.data,
      shop,
      integration: {
        id: integration.id,
        provider: integration.provider,
        status: integration.status,
        updated_at: integration.updated_at,
      },
      subscription,
      metrics: {
        totalOrders,
        activeUsers: activeUsersCountResult.count || 0,
        totalProducts: productsCountResult.count || 0,
        responseRate,
      },
      analytics: {
        avgSentiment: Math.round(avgSentiment * 100) / 100,
        returnRate,
        preventedReturns: preventedReturns || 0,
        totalConversations: conversationCount,
        resolvedConversations: resolvedConversationCount,
      },
      settings: {
        notificationPhone: (merchantResult.data as any).notification_phone || null,
        personaSettings: (merchantResult.data as any).persona_settings || {},
      },
      integrations: integrationsResult.data || [],
      products: productRowsResult.data || [],
      recentOrders: recentOrdersResult.data || [],
    };

    await setCachedApiResponse(cacheKey, payload, 15);
    return c.json(payload);
  } catch (err) {
    logger.error({ err, merchantId, shop }, 'Shopify merchant overview error');
    return c.json({ error: 'Failed to load merchant overview' }, 500);
  }
}

/**
 * Merchant overview for Shopify shell.
 * GET /api/integrations/shopify/merchant-overview
 */
shopify.get('/merchant-overview', authMiddleware, async (c) => {
  try {
    const serviceClient = getSupabaseServiceClient();
    const authMethod = c.get('authMethod') as 'jwt' | 'shopify' | 'internal' | undefined;
    const merchantId = c.get('merchantId') as string | undefined;

    if (!merchantId) {
      return c.json({ error: 'Unauthorized: Missing merchant context' }, 401);
    }

    if (authMethod === 'internal') {
      const shopRaw = c.req.query('shop')?.trim();
      if (!shopRaw) {
        return c.json({ error: 'shop is required' }, 400);
      }

      const shop = shopRaw.includes('.myshopify.com') ? shopRaw : `${shopRaw}.myshopify.com`;
      const { data: integration, error: integrationError } = await serviceClient
        .from('integrations')
        .select('id, merchant_id, status, provider, auth_data, updated_at')
        .eq('merchant_id', merchantId)
        .eq('provider', 'shopify')
        .contains('auth_data', { shop })
        .maybeSingle();

      if (integrationError) {
        logger.error({ integrationError, merchantId, shop }, 'Failed to load Shopify integration for merchant overview');
        return c.json({ error: 'Failed to load integration' }, 500);
      }

      if (!integration) {
        return c.json({ error: 'Integration not found' }, 404);
      }

      return buildMerchantOverviewResponse(c, merchantId, integration, shop);
    }

    const { data: integration, error: integrationError } = await serviceClient
      .from('integrations')
      .select('id, merchant_id, status, provider, auth_data, updated_at')
      .eq('merchant_id', merchantId)
      .eq('provider', 'shopify')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (integrationError) {
      logger.error({ integrationError, merchantId }, 'Failed to load Shopify integration for merchant overview');
      return c.json({ error: 'Failed to load integration' }, 500);
    }

    if (!integration) {
      return c.json({ error: 'Integration not found' }, 404);
    }

    const shop = typeof integration.auth_data?.shop === 'string' ? integration.auth_data.shop : null;
    if (!shop) {
      return c.json({ error: 'Integration shop is missing' }, 500);
    }

    return buildMerchantOverviewResponse(c, merchantId, integration, shop);
  } catch (err) {
    logger.error({ err }, 'Shopify merchant overview auth error');
    return c.json({ error: 'Failed to load merchant overview' }, 500);
  }
});

/**
 * Start Shopify OAuth (standalone connect from Integrations page)
 * POST /api/integrations/shopify/auth
 * Body: { shop: "store.myshopify.com" }
 * Returns: { authUrl } — redirect user to this URL
 */
shopify.post('/auth', authMiddleware, async (c) => {
  try {
    const body = (await c.req.json()) as { shop?: string };
    const shopRaw = body?.shop?.trim();
    if (!shopRaw) {
      return c.json({ error: 'shop is required' }, 400);
    }
    const shop = shopRaw.includes('.myshopify.com') ? shopRaw : `${shopRaw}.myshopify.com`;
    const merchantId = c.get('merchantId') as string;
    const state = Buffer.from(JSON.stringify({ merchantId, n: crypto.randomBytes(8).toString('hex') }), 'utf8').toString('base64url');
    const authUrl = getShopifyAuthUrl(shop, SHOPIFY_OAUTH_SCOPES, state);
    return c.json({ authUrl });
  } catch (err) {
    logger.error({ err }, 'Shopify auth URL error');
    return c.json({ error: 'Failed to build auth URL' }, 500);
  }
});

/**
 * Shopify OAuth callback (Shopify redirects here after merchant approves)
 * GET /api/integrations/shopify/oauth/callback?code=...&shop=...&state=...&hmac=...
 * Exchanges code for token, saves/updates integration for merchant in state, redirects to frontend.
 */
shopify.get('/oauth/callback', async (c) => {
  const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectBase = `${frontendUrl}/en/dashboard/integrations`;
  try {
    const query = c.req.query();
    const hmac = query.hmac;
    const code = query.code;
    const shop = query.shop;
    const state = query.state;
    if (!hmac || !code || !shop || !state) {
      const errMsg = encodeURIComponent('Missing code, shop, state, or hmac');
      return c.redirect(`${redirectBase}/shopify/callback?error=${errMsg}`);
    }
    const queryRecord: Record<string, string> = {};
    for (const [k, v] of Object.entries(query)) {
      if (typeof v === 'string') queryRecord[k] = v;
    }
    if (!verifyShopifyHmac(queryRecord)) {
      return c.redirect(`${redirectBase}/shopify/callback?error=${encodeURIComponent('Invalid HMAC')}`);
    }
    let merchantId: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      merchantId = decoded.merchantId;
    } catch {
      return c.redirect(`${redirectBase}/shopify/callback?error=${encodeURIComponent('Invalid state')}`);
    }
    const tokenData = await exchangeCodeForToken(shop, code);
    const serviceClient = getSupabaseServiceClient();
    const { data: existing } = await serviceClient
      .from('integrations')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('provider', 'shopify')
      .maybeSingle();
    const authData = { shop, access_token: tokenData.access_token, scope: tokenData.scope };
    if (existing) {
      await serviceClient
        .from('integrations')
        .update({ status: 'active', auth_data: authData, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await serviceClient
        .from('integrations')
        .insert({
          merchant_id: merchantId,
          provider: 'shopify',
          status: 'active',
          auth_type: 'oauth',
          auth_data: authData,
        });
    }
    return c.redirect(`${redirectBase}/shopify/callback?success=true&message=${encodeURIComponent('Shopify connected')}`);
  } catch (err) {
    logger.error({ err }, 'Shopify OAuth callback error');
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return c.redirect(`${redirectBase}/shopify/callback?error=${encodeURIComponent(msg)}`);
  }
});

/**
 * Subscribe to Shopify webhooks
 * POST /api/integrations/shopify/webhooks/subscribe
 * Note: With Shopify Managed Installation (packages/shopify-app/shopify.app.toml), this is largely redundant
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
      shopDomain,
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
 * Verify Shopify session token (no browser session conversion)
 * POST /api/integrations/shopify/verify-session
 * Verifies embedded tokens and can provision the merchant integration if needed.
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

        await reactivateMerchantForShopifyInstall(existingIntegration.merchant_id, serviceClient);

      } else {
        // Create New Merchant & Integration
        const newMerchantId = crypto.randomUUID();
        // Create Merchant
        const { error: merchantError } = await serviceClient
          .from('merchants')
          .insert({
            id: newMerchantId,
            name: shop.replace('.myshopify.com', ''),
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
