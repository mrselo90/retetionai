/**
 * Billing and Subscription Management
 * Supports Shopify Billing API and usage tracking
 */

import { getSupabaseServiceClient, logger } from '@recete/shared';
import { getCachedPlanLimits, setCachedPlanLimits, invalidatePlanLimitsCache } from './cache.js';

export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'trial' | 'active' | 'cancelled' | 'expired' | 'past_due';
export type BillingProvider = 'shopify' | 'stripe' | 'manual';

export interface PlanLimits {
  messages_per_month: number; // -1 for unlimited
  api_calls_per_hour: number; // -1 for unlimited
  products_limit: number; // -1 for unlimited
  storage_gb: number; // -1 for unlimited
  support_level: 'community' | 'email' | 'priority' | 'dedicated';
}

export interface SubscriptionInfo {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  subscriptionId?: string;
  billingProvider: BillingProvider;
  trialEndsAt?: Date;
  subscriptionStartsAt?: Date;
  subscriptionEndsAt?: Date;
  cancelledAt?: Date;
  billingEmail?: string;
}

/**
 * Get subscription info for a merchant
 */
export async function getMerchantSubscription(merchantId: string): Promise<SubscriptionInfo | null> {
  const serviceClient = getSupabaseServiceClient();
  
  const { data: merchant, error } = await serviceClient
    .from('merchants')
    .select('subscription_plan, subscription_status, subscription_id, billing_provider, trial_ends_at, subscription_starts_at, subscription_ends_at, cancelled_at, billing_email')
    .eq('id', merchantId)
    .single();
  
  if (error || !merchant) {
    logger.error({ error, merchantId }, 'Failed to get merchant subscription');
    return null;
  }
  
  return {
    plan: merchant.subscription_plan as SubscriptionPlan,
    status: merchant.subscription_status as SubscriptionStatus,
    subscriptionId: merchant.subscription_id || undefined,
    billingProvider: (merchant.billing_provider || 'shopify') as BillingProvider,
    trialEndsAt: merchant.trial_ends_at ? new Date(merchant.trial_ends_at) : undefined,
    subscriptionStartsAt: merchant.subscription_starts_at ? new Date(merchant.subscription_starts_at) : undefined,
    subscriptionEndsAt: merchant.subscription_ends_at ? new Date(merchant.subscription_ends_at) : undefined,
    cancelledAt: merchant.cancelled_at ? new Date(merchant.cancelled_at) : undefined,
    billingEmail: merchant.billing_email || undefined,
  };
}

/**
 * Get plan limits for a merchant (with caching)
 */
export async function getPlanLimits(merchantId: string): Promise<PlanLimits | null> {
  // Try cache first
  const cached = await getCachedPlanLimits(merchantId);
  if (cached) {
    return cached as PlanLimits;
  }
  
  const serviceClient = getSupabaseServiceClient();
  
  // Get merchant's plan
  const { data: merchant, error: merchantError } = await serviceClient
    .from('merchants')
    .select('subscription_plan')
    .eq('id', merchantId)
    .single();
  
  if (merchantError || !merchant) {
    logger.error({ error: merchantError, merchantId }, 'Failed to get merchant plan');
    return null;
  }
  
  // Get plan features
  const { data: plan, error: planError } = await serviceClient
    .from('subscription_plans')
    .select('features')
    .eq('id', merchant.subscription_plan)
    .single();
  
  if (planError || !plan) {
    logger.error({ error: planError, planId: merchant.subscription_plan }, 'Failed to get plan limits');
    return null;
  }
  
  const limits = plan.features as PlanLimits;
  
  // Cache the result (30 minutes)
  await setCachedPlanLimits(merchantId, limits, 1800);
  
  return limits;
}

/**
 * Update merchant subscription
 */
export async function updateMerchantSubscription(
  merchantId: string,
  updates: Partial<SubscriptionInfo>
): Promise<boolean> {
  const serviceClient = getSupabaseServiceClient();
  
  const updateData: any = {};
  
  if (updates.plan) updateData.subscription_plan = updates.plan;
  if (updates.status) updateData.subscription_status = updates.status;
  if (updates.subscriptionId !== undefined) updateData.subscription_id = updates.subscriptionId;
  if (updates.billingProvider) updateData.billing_provider = updates.billingProvider;
  if (updates.trialEndsAt) updateData.trial_ends_at = updates.trialEndsAt.toISOString();
  if (updates.subscriptionStartsAt) updateData.subscription_starts_at = updates.subscriptionStartsAt.toISOString();
  if (updates.subscriptionEndsAt) updateData.subscription_ends_at = updates.subscriptionEndsAt.toISOString();
  if (updates.cancelledAt) updateData.cancelled_at = updates.cancelledAt.toISOString();
  if (updates.billingEmail) updateData.billing_email = updates.billingEmail;
  
  const { error } = await serviceClient
    .from('merchants')
    .update(updateData)
    .eq('id', merchantId);
  
  if (error) {
    logger.error({ error, merchantId, updates }, 'Failed to update merchant subscription');
    return false;
  }
  
  // Invalidate plan limits cache if plan changed
  if (updates.plan) {
    await invalidatePlanLimitsCache(merchantId);
  }
  
  return true;
}

/**
 * Check if merchant is on trial
 */
export async function isMerchantOnTrial(merchantId: string): Promise<boolean> {
  const subscription = await getMerchantSubscription(merchantId);
  if (!subscription) return false;
  
  if (subscription.status === 'trial' && subscription.trialEndsAt) {
    return new Date() < subscription.trialEndsAt;
  }
  
  return false;
}

/**
 * Check if subscription is active
 */
export async function isSubscriptionActive(merchantId: string): Promise<boolean> {
  const subscription = await getMerchantSubscription(merchantId);
  if (!subscription) return false;
  
  return subscription.status === 'active' || subscription.status === 'trial';
}

/**
 * Get all available subscription plans
 */
export async function getAvailablePlans(): Promise<Array<{
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: PlanLimits;
}>> {
  const serviceClient = getSupabaseServiceClient();
  
  const { data: plans, error } = await serviceClient
    .from('subscription_plans')
    .select('id, name, description, price_monthly, price_yearly, currency, features')
    .eq('is_active', true)
    .order('price_monthly', { ascending: true });
  
  if (error) {
    logger.error({ error }, 'Failed to get available plans');
    return [];
  }
  
  return (plans || []).map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description || '',
    priceMonthly: parseFloat(plan.price_monthly.toString()),
    priceYearly: parseFloat(plan.price_yearly?.toString() || '0'),
    currency: plan.currency || 'USD',
    features: plan.features as PlanLimits,
  }));
}
