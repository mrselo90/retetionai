/**
 * Add-on Module System
 * Manages optional paid modules (e.g. Return Prevention)
 * Each add-on has its own Shopify RecurringApplicationCharge
 */

import { getSupabaseServiceClient, logger } from '@glowguide/shared';
import { getCache, setCache, deleteCache } from './cache.js';
import type { SubscriptionPlan } from './billing.js';

export interface AddonDefinition {
  key: string;
  name: string;
  description: string;
  priceMonthly: number;
  requiredPlan: SubscriptionPlan[];
}

export const ADDON_DEFINITIONS: Record<string, AddonDefinition> = {
  return_prevention: {
    key: 'return_prevention',
    name: 'Return Prevention',
    description: 'AI-powered return prevention with usage guides and video tutorials',
    priceMonthly: 19.0,
    requiredPlan: ['starter', 'pro', 'enterprise'],
  },
};

const ADDON_CACHE_TTL = 300; // 5 minutes

/**
 * Check if an add-on is active for a merchant (cached)
 */
export async function isAddonActive(merchantId: string, addonKey: string): Promise<boolean> {
  const cacheKey = `${merchantId}:${addonKey}`;
  const cached = await getCache<boolean>('addon_status', cacheKey);
  if (cached !== null) return cached;

  const serviceClient = getSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from('merchant_addons')
    .select('status')
    .eq('merchant_id', merchantId)
    .eq('addon_key', addonKey)
    .maybeSingle();

  const active = !error && data?.status === 'active';
  await setCache('addon_status', cacheKey, active, ADDON_CACHE_TTL);
  return active;
}

/**
 * Activate an add-on after Shopify charge is confirmed
 */
export async function activateAddon(
  merchantId: string,
  addonKey: string,
  chargeId: string,
  priceMonthly: number
): Promise<boolean> {
  const serviceClient = getSupabaseServiceClient();

  const { error } = await serviceClient
    .from('merchant_addons')
    .upsert(
      {
        merchant_id: merchantId,
        addon_key: addonKey,
        status: 'active',
        billing_charge_id: chargeId,
        price_monthly: priceMonthly,
        activated_at: new Date().toISOString(),
        cancelled_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'merchant_id,addon_key', ignoreDuplicates: false }
    );

  if (error) {
    logger.error({ error, merchantId, addonKey }, 'Failed to activate addon');
    return false;
  }

  await deleteCache('addon_status', `${merchantId}:${addonKey}`);
  return true;
}

/**
 * Deactivate (cancel) an add-on
 */
export async function deactivateAddon(merchantId: string, addonKey: string): Promise<boolean> {
  const serviceClient = getSupabaseServiceClient();

  const { error } = await serviceClient
    .from('merchant_addons')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('merchant_id', merchantId)
    .eq('addon_key', addonKey);

  if (error) {
    logger.error({ error, merchantId, addonKey }, 'Failed to deactivate addon');
    return false;
  }

  await deleteCache('addon_status', `${merchantId}:${addonKey}`);
  return true;
}

/**
 * Get a merchant's add-on statuses (for the settings UI)
 */
export async function getMerchantAddons(merchantId: string): Promise<
  Array<{
    addon_key: string;
    status: string;
    billing_charge_id: string | null;
    price_monthly: number;
    activated_at: string | null;
  }>
> {
  const serviceClient = getSupabaseServiceClient();

  const { data, error } = await serviceClient
    .from('merchant_addons')
    .select('addon_key, status, billing_charge_id, price_monthly, activated_at')
    .eq('merchant_id', merchantId);

  if (error) {
    logger.error({ error, merchantId }, 'Failed to get merchant addons');
    return [];
  }

  return data || [];
}

/**
 * Log a return prevention attempt
 */
export async function logReturnPreventionAttempt(params: {
  merchantId: string;
  conversationId: string;
  userId: string;
  orderId?: string;
  productId?: string;
  triggerMessage: string;
  preventionResponse: string;
}): Promise<string | null> {
  const serviceClient = getSupabaseServiceClient();

  const { data, error } = await serviceClient
    .from('return_prevention_attempts')
    .insert({
      merchant_id: params.merchantId,
      conversation_id: params.conversationId,
      user_id: params.userId,
      order_id: params.orderId || null,
      product_id: params.productId || null,
      trigger_message: params.triggerMessage,
      prevention_response: params.preventionResponse,
      outcome: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error, ...params }, 'Failed to log return prevention attempt');
    return null;
  }

  return data.id;
}

/**
 * Update the outcome of a return prevention attempt
 */
export async function updatePreventionOutcome(
  conversationId: string,
  outcome: 'prevented' | 'returned' | 'escalated'
): Promise<boolean> {
  const serviceClient = getSupabaseServiceClient();

  const { error } = await serviceClient
    .from('return_prevention_attempts')
    .update({ outcome, updated_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('outcome', 'pending');

  if (error) {
    logger.error({ error, conversationId, outcome }, 'Failed to update prevention outcome');
    return false;
  }

  return true;
}

/**
 * Check if a conversation already has a pending prevention attempt
 */
export async function hasPendingPreventionAttempt(conversationId: string): Promise<boolean> {
  const serviceClient = getSupabaseServiceClient();

  const { count, error } = await serviceClient
    .from('return_prevention_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId);

  if (error) return false;
  return (count || 0) > 0;
}
