/**
 * Shopify Billing API Integration
 * Handles subscription charges and billing for Shopify apps
 */

import { getSupabaseServiceClient } from '@glowguide/shared';
import { logger } from '@glowguide/shared';
import type { SubscriptionPlan } from './billing';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

/**
 * Create a recurring charge (subscription) in Shopify
 * This is used for Shopify App Store apps
 */
export async function createShopifyRecurringCharge(
  shop: string,
  accessToken: string,
  planId: SubscriptionPlan,
  planName: string,
  price: number,
  returnUrl: string
): Promise<{ confirmationUrl: string; chargeId: number } | null> {
  try {
    const url = `https://${shop}/admin/api/2024-01/recurring_application_charges.json`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({
        recurring_application_charge: {
          name: planName,
          price: price,
          return_url: returnUrl,
          test: process.env.NODE_ENV !== 'production', // Test mode in development
        },
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, shop, planId }, 'Failed to create Shopify recurring charge');
      return null;
    }
    
    const data = await response.json() as { recurring_application_charge: any };
    const charge = data.recurring_application_charge;
    
    return {
      confirmationUrl: charge.confirmation_url,
      chargeId: charge.id,
    };
  } catch (error) {
    logger.error({ error, shop, planId }, 'Error creating Shopify recurring charge');
    return null;
  }
}

/**
 * Get recurring charge status
 */
export async function getShopifyRecurringCharge(
  shop: string,
  accessToken: string,
  chargeId: number
): Promise<{
  status: 'pending' | 'accepted' | 'active' | 'declined' | 'expired' | 'cancelled';
  createdAt: string;
  updatedAt: string;
} | null> {
  try {
    const url = `https://${shop}/admin/api/2024-01/recurring_application_charges/${chargeId}.json`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, shop, chargeId }, 'Failed to get Shopify recurring charge');
      return null;
    }
    
    const data = await response.json() as { recurring_application_charge: any };
    const charge = data.recurring_application_charge;
    
    return {
      status: charge.status,
      createdAt: charge.created_at,
      updatedAt: charge.updated_at,
    };
  } catch (error) {
    logger.error({ error, shop, chargeId }, 'Error getting Shopify recurring charge');
    return null;
  }
}

/**
 * Cancel a recurring charge
 */
export async function cancelShopifyRecurringCharge(
  shop: string,
  accessToken: string,
  chargeId: number
): Promise<boolean> {
  try {
    const url = `https://${shop}/admin/api/2024-01/recurring_application_charges/${chargeId}.json`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      logger.error({ error, shop, chargeId }, 'Failed to cancel Shopify recurring charge');
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error({ error, shop, chargeId }, 'Error cancelling Shopify recurring charge');
    return false;
  }
}

/**
 * Handle Shopify billing webhook
 * Called when subscription status changes
 */
export async function handleShopifyBillingWebhook(
  merchantId: string,
  chargeId: number,
  status: string
): Promise<boolean> {
  const serviceClient = getSupabaseServiceClient();
  
  let subscriptionStatus: 'trial' | 'active' | 'cancelled' | 'expired' | 'past_due' = 'active';
  
  switch (status) {
    case 'active':
      subscriptionStatus = 'active';
      break;
    case 'cancelled':
      subscriptionStatus = 'cancelled';
      break;
    case 'expired':
      subscriptionStatus = 'expired';
      break;
    case 'declined':
      subscriptionStatus = 'past_due';
      break;
    default:
      subscriptionStatus = 'active';
  }
  
  const { error } = await serviceClient
    .from('merchants')
    .update({
      subscription_status: subscriptionStatus,
      subscription_id: chargeId.toString(),
      cancelled_at: status === 'cancelled' ? new Date().toISOString() : null,
    })
    .eq('id', merchantId);
  
  if (error) {
    logger.error({ error, merchantId, chargeId, status }, 'Failed to update subscription from webhook');
    return false;
  }
  
  logger.info({ merchantId, chargeId, status }, 'Subscription updated from Shopify webhook');
  return true;
}

/**
 * Get plan price for Shopify billing
 */
export function getPlanPrice(planId: SubscriptionPlan, billingCycle: 'monthly' | 'yearly' = 'monthly'): number {
  const prices: Record<SubscriptionPlan, { monthly: number; yearly: number }> = {
    free: { monthly: 0, yearly: 0 },
    starter: { monthly: 29.00, yearly: 290.00 },
    pro: { monthly: 99.00, yearly: 990.00 },
    enterprise: { monthly: 0, yearly: 0 }, // Custom pricing
  };
  
  return billingCycle === 'yearly' ? prices[planId].yearly : prices[planId].monthly;
}
