/**
 * Billing and Subscription Routes
 * Handles subscription management, plan changes, and billing
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getMerchantSubscription, getPlanLimits, getAvailablePlans, updateMerchantSubscription, isSubscriptionActive } from '../lib/billing.js';
import { getCurrentUsage, getUsageHistory } from '../lib/usageTracking.js';
import { createShopifyRecurringCharge, cancelShopifyRecurringCharge, getShopifyRecurringCharge, getPlanPrice, handleShopifyBillingWebhook } from '../lib/shopifyBilling.js';
import { ADDON_DEFINITIONS, getMerchantAddons, activateAddon, deactivateAddon } from '../lib/addons.js';
import { getSupabaseServiceClient } from '@recete/shared';
import { logger } from '@recete/shared';
import { validateBody } from '../middleware/validation.js';
import { z } from 'zod';

const billing = new Hono();

// All routes require authentication
billing.use('/*', authMiddleware);

/**
 * Get current subscription
 * GET /api/billing/subscription
 */
billing.get('/subscription', async (c) => {
  const merchantId = c.get('merchantId');

  const subscription = await getMerchantSubscription(merchantId);

  if (!subscription) {
    return c.json({ error: 'Subscription not found' }, 404);
  }

  const limits = await getPlanLimits(merchantId);
  const usage = await getCurrentUsage(merchantId);

  return c.json({
    subscription,
    limits,
    usage,
  });
});

/**
 * Get current usage
 * GET /api/billing/usage
 */
billing.get('/usage', async (c) => {
  const merchantId = c.get('merchantId');

  const usage = await getCurrentUsage(merchantId);
  const limits = await getPlanLimits(merchantId);

  return c.json({
    usage,
    limits,
    percentage: {
      messages: limits && limits.messages_per_month > 0
        ? Math.round((usage.messagesSent / limits.messages_per_month) * 100)
        : 0,
      apiCalls: limits && limits.api_calls_per_hour > 0
        ? Math.round((usage.apiCalls / limits.api_calls_per_hour) * 100)
        : 0,
      storage: limits && limits.storage_gb > 0
        ? Math.round((usage.storageBytes / (limits.storage_gb * 1024 * 1024 * 1024)) * 100)
        : 0,
    },
  });
});

/**
 * Get usage history
 * GET /api/billing/usage/history?months=6
 */
billing.get('/usage/history', async (c) => {
  const merchantId = c.get('merchantId');
  const months = parseInt(c.req.query('months') || '6', 10);

  const history = await getUsageHistory(merchantId, months);

  return c.json({ history });
});

/**
 * Get available plans
 * GET /api/billing/plans
 */
billing.get('/plans', async (c) => {
  const plans = await getAvailablePlans();

  return c.json({ plans });
});

/**
 * Start subscription (Shopify)
 * POST /api/billing/subscribe
 * Body: { planId: 'starter' | 'pro', billingCycle: 'monthly' | 'yearly' }
 */
const subscribeSchema = z.object({
  planId: z.enum(['starter', 'pro', 'enterprise']),
  billingCycle: z.enum(['monthly', 'yearly']).optional().default('monthly'),
});

billing.post('/subscribe', validateBody(subscribeSchema), async (c) => {
  const merchantId = c.get('merchantId');
  const body = c.get('validatedBody') as z.infer<typeof subscribeSchema>;
  const { planId, billingCycle } = body;

  // Get merchant's Shopify integration
  const serviceClient = getSupabaseServiceClient();
  const { data: integration, error: integrationError } = await serviceClient
    .from('integrations')
    .select('id, auth_data')
    .eq('merchant_id', merchantId)
    .eq('provider', 'shopify')
    .eq('status', 'active')
    .single();

  if (integrationError || !integration) {
    return c.json({
      error: 'Shopify integration not found',
      message: 'Please connect your Shopify store first',
    }, 400);
  }

  const authData = integration.auth_data as any;
  const shop = authData?.shop;
  const accessToken = authData?.access_token;

  if (!shop || !accessToken) {
    return c.json({
      error: 'Shopify credentials not found',
      message: 'Please reconnect your Shopify store',
    }, 400);
  }

  // Get plan price
  const price = getPlanPrice(planId, billingCycle);
  const planName = `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan (${billingCycle})`;

  // Create return URL (where user is redirected after accepting charge)
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const returnUrl = `${frontendUrl}/dashboard/settings?billing=success`;

  // Create recurring charge in Shopify
  const chargeResult = await createShopifyRecurringCharge(
    shop,
    accessToken,
    planId,
    planName,
    price,
    returnUrl
  );

  if (!chargeResult) {
    return c.json({
      error: 'Failed to create subscription',
      message: 'Could not create Shopify billing charge',
    }, 500);
  }

  // Update merchant subscription status to pending
  await updateMerchantSubscription(merchantId, {
    plan: planId,
    status: 'trial', // Will be updated to 'active' when webhook confirms
    subscriptionId: chargeResult.chargeId.toString(),
    billingProvider: 'shopify',
  });

  return c.json({
    message: 'Subscription created',
    confirmationUrl: chargeResult.confirmationUrl,
    chargeId: chargeResult.chargeId,
  });
});

/**
 * Cancel subscription
 * POST /api/billing/cancel
 */
billing.post('/cancel', async (c) => {
  const merchantId = c.get('merchantId');

  const subscription = await getMerchantSubscription(merchantId);

  if (!subscription || !subscription.subscriptionId) {
    return c.json({ error: 'No active subscription found' }, 400);
  }

  // If Shopify billing, cancel the charge
  if (subscription.billingProvider === 'shopify') {
    const serviceClient = getSupabaseServiceClient();
    const { data: integration } = await serviceClient
      .from('integrations')
      .select('auth_data')
      .eq('merchant_id', merchantId)
      .eq('provider', 'shopify')
      .eq('status', 'active')
      .single();

    if (integration) {
      const authData = integration.auth_data as any;
      const shop = authData?.shop;
      const accessToken = authData?.access_token;

      if (shop && accessToken) {
        await cancelShopifyRecurringCharge(shop, accessToken, parseInt(subscription.subscriptionId));
      }
    }
  }

  // Update subscription status
  await updateMerchantSubscription(merchantId, {
    status: 'cancelled',
    cancelledAt: new Date(),
  });

  return c.json({
    message: 'Subscription cancelled',
  });
});



// ============================================================================
// ADD-ON MODULE ROUTES
// ============================================================================

/**
 * List available add-ons with merchant's current status
 * GET /api/billing/addons
 */
billing.get('/addons', async (c) => {
  const merchantId = c.get('merchantId');

  // Gracefully handle missing subscription - always return addon list (Shopify standard)
  let subscription = null;
  try { subscription = await getMerchantSubscription(merchantId); } catch (_) { /* show locked */ }

  let merchantAddons: any[] = [];
  try { merchantAddons = await getMerchantAddons(merchantId); } catch (_) { /* non-critical */ }

  const addonStatusMap = new Map(merchantAddons.map((a) => [a.addon_key, a]));

  // Shopify pattern: ALWAYS return all addon definitions, never hide them.
  // planAllowed=false = locked with upgrade CTA, not invisible.
  // Trial merchants get planAllowed=true so they can test the full product.
  const addons = Object.values(ADDON_DEFINITIONS).map((def) => {
    const merchantAddon = addonStatusMap.get(def.key);
    const planAllowed = subscription
      ? def.requiredPlan.includes(subscription.plan)
      || subscription.status === 'trial'
      || merchantAddon?.status === 'active'
      : false;

    return {
      ...def,
      status: merchantAddon?.status || 'inactive',
      activatedAt: merchantAddon?.activated_at || null,
      planAllowed,
    };
  });

  return c.json({ addons });
});

/**
 * Subscribe to an add-on (creates a separate Shopify RecurringApplicationCharge)
 * POST /api/billing/addons/:key/subscribe
 */
billing.post('/addons/:key/subscribe', async (c) => {
  const merchantId = c.get('merchantId');
  const addonKey = c.req.param('key');

  const definition = ADDON_DEFINITIONS[addonKey];
  if (!definition) {
    return c.json({ error: 'Add-on not found' }, 404);
  }

  const subscription = await getMerchantSubscription(merchantId);
  if (!subscription || !definition.requiredPlan.includes(subscription.plan)) {
    return c.json({
      error: 'Plan not eligible',
      message: `This add-on requires one of: ${definition.requiredPlan.join(', ')}`,
    }, 403);
  }

  const serviceClient = getSupabaseServiceClient();
  const { data: integration } = await serviceClient
    .from('integrations')
    .select('auth_data')
    .eq('merchant_id', merchantId)
    .eq('provider', 'shopify')
    .eq('status', 'active')
    .single();

  if (!integration) {
    return c.json({ error: 'Shopify integration not found' }, 400);
  }

  const authData = integration.auth_data as any;
  const shop = authData?.shop;
  const accessToken = authData?.access_token;

  if (!shop || !accessToken) {
    return c.json({ error: 'Shopify credentials not found' }, 400);
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const returnUrl = `${frontendUrl}/dashboard/settings?addon=${addonKey}&action=confirm`;

  const chargeResult = await createShopifyRecurringCharge(
    shop,
    accessToken,
    'starter',
    `Add-on: ${definition.name}`,
    definition.priceMonthly,
    returnUrl
  );

  if (!chargeResult) {
    return c.json({ error: 'Failed to create billing charge' }, 500);
  }

  return c.json({
    confirmationUrl: chargeResult.confirmationUrl,
    chargeId: chargeResult.chargeId,
  });
});

/**
 * Confirm add-on activation after Shopify approval
 * GET /api/billing/addons/:key/confirm?charge_id=...
 */
billing.get('/addons/:key/confirm', async (c) => {
  const merchantId = c.get('merchantId');
  const addonKey = c.req.param('key');
  const chargeId = c.req.query('charge_id');

  const definition = ADDON_DEFINITIONS[addonKey];
  if (!definition) {
    return c.json({ error: 'Add-on not found' }, 404);
  }

  if (!chargeId) {
    return c.json({ error: 'charge_id is required' }, 400);
  }

  const serviceClient = getSupabaseServiceClient();
  const { data: integration } = await serviceClient
    .from('integrations')
    .select('auth_data')
    .eq('merchant_id', merchantId)
    .eq('provider', 'shopify')
    .eq('status', 'active')
    .single();

  if (!integration) {
    return c.json({ error: 'Shopify integration not found' }, 400);
  }

  const authData = integration.auth_data as any;
  const shop = authData?.shop;
  const accessToken = authData?.access_token;

  if (!shop || !accessToken) {
    return c.json({ error: 'Shopify credentials not found' }, 400);
  }

  const charge = await getShopifyRecurringCharge(shop, accessToken, parseInt(chargeId));

  if (!charge || charge.status !== 'active') {
    return c.json({
      error: 'Charge not active',
      message: `Charge status: ${charge?.status || 'unknown'}`,
    }, 400);
  }

  const activated = await activateAddon(merchantId, addonKey, chargeId, definition.priceMonthly);

  if (!activated) {
    return c.json({ error: 'Failed to activate add-on' }, 500);
  }

  return c.json({ message: 'Add-on activated', addon: addonKey });
});

/**
 * Cancel an add-on subscription
 * POST /api/billing/addons/:key/cancel
 */
billing.post('/addons/:key/cancel', async (c) => {
  const merchantId = c.get('merchantId');
  const addonKey = c.req.param('key');

  const definition = ADDON_DEFINITIONS[addonKey];
  if (!definition) {
    return c.json({ error: 'Add-on not found' }, 404);
  }

  const merchantAddons = await getMerchantAddons(merchantId);
  const addon = merchantAddons.find((a) => a.addon_key === addonKey);

  if (!addon || addon.status !== 'active') {
    return c.json({ error: 'Add-on is not active' }, 400);
  }

  if (addon.billing_charge_id) {
    const serviceClient = getSupabaseServiceClient();
    const { data: integration } = await serviceClient
      .from('integrations')
      .select('auth_data')
      .eq('merchant_id', merchantId)
      .eq('provider', 'shopify')
      .eq('status', 'active')
      .single();

    if (integration) {
      const authData = integration.auth_data as any;
      if (authData?.shop && authData?.access_token) {
        await cancelShopifyRecurringCharge(
          authData.shop,
          authData.access_token,
          parseInt(addon.billing_charge_id)
        );
      }
    }
  }

  const deactivated = await deactivateAddon(merchantId, addonKey);

  if (!deactivated) {
    return c.json({ error: 'Failed to deactivate add-on' }, 500);
  }

  return c.json({ message: 'Add-on cancelled', addon: addonKey });
});

export default billing;
