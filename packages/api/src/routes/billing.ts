/**
 * Billing and Subscription Routes
 * Handles subscription management, plan changes, and billing
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getMerchantSubscription, getPlanLimits, getAvailablePlans, updateMerchantSubscription, isSubscriptionActive } from '../lib/billing';
import { getCurrentUsage, getUsageHistory } from '../lib/usageTracking';
import { createShopifyRecurringCharge, cancelShopifyRecurringCharge, getPlanPrice, handleShopifyBillingWebhook } from '../lib/shopifyBilling';
import { getSupabaseServiceClient } from '@glowguide/shared';
import { logger } from '@glowguide/shared';
import { validateBody } from '../middleware/validation';
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

/**
 * Handle Shopify billing webhook callback
 * POST /api/billing/webhooks/shopify
 * This is called by Shopify when subscription status changes
 */
billing.post('/webhooks/shopify', async (c) => {
  try {
    const body = await c.req.json() as { charge_id?: number; status?: string; shop?: string };
    
    // Verify webhook (HMAC verification should be done in middleware)
    const chargeId = body.charge_id;
    const status = body.status;
    const shop = body.shop;
    
    if (!chargeId || !status || !shop) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    // Find merchant by Shopify shop
    const serviceClient = getSupabaseServiceClient();
    const { data: integration } = await serviceClient
      .from('integrations')
      .select('merchant_id')
      .eq('provider', 'shopify')
      .eq('status', 'active')
      .single();
    
    if (!integration) {
      logger.warn({ shop, chargeId }, 'Shopify billing webhook received but integration not found');
      return c.json({ error: 'Integration not found' }, 404);
    }
    
    // Update subscription
    await handleShopifyBillingWebhook(integration.merchant_id, chargeId, status);
    
    return c.json({ message: 'Webhook processed' });
  } catch (error) {
    logger.error({ error }, 'Error processing Shopify billing webhook');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default billing;
