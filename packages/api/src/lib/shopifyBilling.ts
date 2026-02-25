/**
 * Shopify Billing API Integration
 * Handles subscription charges and billing for Shopify apps using GraphQL API
 */

import { getSupabaseServiceClient, logger } from '@recete/shared';
import type { SubscriptionPlan } from './billing.js';

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

/**
 * GraphQL Client for Shopify Admin API
 */
async function shopifyGraphQL(shop: string, accessToken: string, query: string, variables: any = {}): Promise<any> {
  const url = `https://${shop}/admin/api/2024-01/graphql.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ shop, errorText }, 'Shopify GraphQL Error');
    throw new Error('Shopify GraphQL request failed.');
  }

  return await response.json();
}

/**
 * Create a recurring charge (subscription) combined with Usage limits via GraphQL
 * This is the required method for Shopify App Store billing compliance.
 */
export async function createShopifyRecurringCharge(
  shop: string,
  accessToken: string,
  planId: SubscriptionPlan,
  planName: string,
  price: number,
  returnUrl: string,
  cappedAmount: number = 100.0 // Default $100 Capped Amount
): Promise<{ confirmationUrl: string; chargeId: number } | null> {
  try {
    const mutation = `
      mutation appSubscriptionCreate($name: String!, $returnUrl: URL!, $lineItems: [AppSubscriptionLineItemInput!]!, $test: Boolean) {
        appSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test) {
          appSubscription {
            id
          }
          confirmationUrl
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      name: planName,
      returnUrl: returnUrl,
      test: process.env.NODE_ENV !== 'production',
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: price, currencyCode: "USD" },
              interval: "EVERY_30_DAYS"
            }
          }
        },
        // Usage-based billing (Capped Amount) for extra AI and WhatsApp usage
        {
          plan: {
            appUsagePricingDetails: {
              cappedAmount: { amount: cappedAmount, currencyCode: "USD" },
              terms: "Extra WhatsApp message or AI token usage limit costs"
            }
          }
        }
      ]
    };

    const response = await shopifyGraphQL(shop, accessToken, mutation, variables);
    const data = response.data as any;
    const errors = response.errors as any;

    if (errors || data?.appSubscriptionCreate?.userErrors?.length > 0) {
      logger.error({ shop, errors, userErrors: data?.appSubscriptionCreate?.userErrors }, 'Failed to create App Subscription via GraphQL');
      return null;
    }

    const appSubscriptionId = data.appSubscriptionCreate.appSubscription.id;
    // Extract numeric ID from GraphQL gid (e.g. gid://shopify/AppSubscription/12345 -> 12345)
    // The previous implementation and DB expect a number
    const chargeIdMatch = appSubscriptionId.match(/(\d+)$/);
    const chargeId = chargeIdMatch ? parseInt(chargeIdMatch[1], 10) : 0;

    return {
      confirmationUrl: data.appSubscriptionCreate.confirmationUrl,
      chargeId: chargeId
    };
  } catch (error) {
    logger.error({ error, shop, planId }, 'Error creating Shopify GraphQL recurring charge');
    return null;
  }
}

/**
 * Send an App Usage Record (Kullanım Bazlı Ücretlendirme) via GraphQL
 */
export async function createShopifyUsageRecord(
  shop: string,
  accessToken: string,
  subscriptionLineItemId: string, // Provide the usage-billing subscriptionLineItemId here
  priceAmount: number,
  description: string
): Promise<boolean> {
  try {
    const mutation = `
      mutation appUsageRecordCreate($subscriptionLineItemId: ID!, $price: MoneyInput!, $description: String!) {
        appUsageRecordCreate(subscriptionLineItemId: $subscriptionLineItemId, price: $price, description: $description) {
          appUsageRecord {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      subscriptionLineItemId,
      price: { amount: priceAmount, currencyCode: "USD" },
      description
    };

    const response = await shopifyGraphQL(shop, accessToken, mutation, variables);
    const data = response.data as any;
    const errors = response.errors as any;

    if (errors || data?.appUsageRecordCreate?.userErrors?.length > 0) {
      logger.error({ shop, errors, userErrors: data?.appUsageRecordCreate?.userErrors }, 'Failed to create usage record');
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ error, shop }, 'Error creating app usage record');
    return false;
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
    const gid = `gid://shopify/AppSubscription/${chargeId}`;
    const query = `
      query appSubscription($id: ID!) {
        appSubscription(id: $id) {
          status
          createdAt
          updatedAt
        }
      }
    `;

    const response = await shopifyGraphQL(shop, accessToken, query, { id: gid });
    const data = response.data as any;
    const errors = response.errors as any;

    if (errors || !data?.appSubscription) {
      logger.error({ shop, chargeId, errors }, 'Failed to get Shopify AppSubscription via GraphQL');
      return null;
    }

    const normalizedStatus = (data.appSubscription.status || '').toLowerCase();

    return {
      status: normalizedStatus as 'pending' | 'accepted' | 'active' | 'declined' | 'expired' | 'cancelled',
      createdAt: data.appSubscription.createdAt || '',
      updatedAt: data.appSubscription.updatedAt || '',
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
    const gid = `gid://shopify/AppSubscription/${chargeId}`;
    const mutation = `
      mutation appSubscriptionCancel($id: ID!) {
        appSubscriptionCancel(id: $id) {
          appSubscription {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await shopifyGraphQL(shop, accessToken, mutation, { id: gid });
    const data = response.data as any;
    const errors = response.errors as any;

    if (errors || data?.appSubscriptionCancel?.userErrors?.length > 0) {
      logger.error({ shop, chargeId, errors, userErrors: data?.appSubscriptionCancel?.userErrors }, 'Failed to cancel Shopify AppSubscription via GraphQL');
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
  chargeId: string | number,
  status: string
): Promise<boolean> {
  const serviceClient = getSupabaseServiceClient();

  let subscriptionStatus: 'trial' | 'active' | 'cancelled' | 'expired' | 'past_due' = 'active';

  // Clean and lowercase the status to handle both REST ('active') and GraphQL ('ACTIVE') responses
  const normalizedStatus = status.toLowerCase().trim();

  switch (normalizedStatus) {
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
    case 'frozen':
      subscriptionStatus = 'past_due';
      break;
    case 'pending':
      subscriptionStatus = 'trial';
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
