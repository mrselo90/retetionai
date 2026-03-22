import { getSupabaseServiceClient } from '@recete/shared';
import {
  fetchShellPlanByShop,
  logShellIntegrationWarning,
  reportShellUsageEvent,
  type ShopifyShellPlanSnapshot,
} from './shopifyShell.js';

export type MerchantPlanType = 'STARTER' | 'GROWTH' | 'PRO';
export type MerchantAnalyticsLevel = 'BASIC' | 'ADVANCED';
export type MerchantWhatsAppConfig = 'SHARED' | 'CUSTOM';
export type MerchantUpsellStrategy = 'BASIC' | 'LINKS' | 'SMART_REORDER';

export interface MerchantPlanFeatures {
  planType: MerchantPlanType;
  billingInterval: 'MONTHLY' | 'ANNUAL';
  includedChats: number;
  overageRate: number;
  recipeLimit: number | null;
  aiVision: boolean;
  analyticsLevel: MerchantAnalyticsLevel;
  whatsAppConfig: MerchantWhatsAppConfig;
  upsellStrategy: MerchantUpsellStrategy;
  shopDomain?: string | null;
}

function getFallbackPlanFeatures(rawPlan?: string | null): MerchantPlanFeatures {
  switch ((rawPlan || '').trim().toLowerCase()) {
    case 'growth':
      return {
        planType: 'GROWTH',
        billingInterval: 'MONTHLY',
        includedChats: 1000,
        overageRate: 0.12,
        recipeLimit: 500,
        aiVision: true,
        analyticsLevel: 'BASIC',
        whatsAppConfig: 'SHARED',
        upsellStrategy: 'LINKS',
      };
    case 'pro':
    case 'enterprise':
      return {
        planType: 'PRO',
        billingInterval: 'MONTHLY',
        includedChats: 3000,
        overageRate: 0.08,
        recipeLimit: null,
        aiVision: true,
        analyticsLevel: 'ADVANCED',
        whatsAppConfig: 'CUSTOM',
        upsellStrategy: 'SMART_REORDER',
      };
    case 'starter':
    case 'free':
    default:
      return {
        planType: 'STARTER',
        billingInterval: 'MONTHLY',
        includedChats: 150,
        overageRate: 0.18,
        recipeLimit: 20,
        aiVision: false,
        analyticsLevel: 'BASIC',
        whatsAppConfig: 'SHARED',
        upsellStrategy: 'BASIC',
      };
  }
}

function mapShellPlan(plan: ShopifyShellPlanSnapshot): MerchantPlanFeatures {
  const whatsAppConfig: MerchantWhatsAppConfig =
    plan.planType === 'PRO' ? 'CUSTOM' : 'SHARED';
  const analyticsLevel: MerchantAnalyticsLevel =
    plan.planType === 'PRO' ? 'ADVANCED' : 'BASIC';
  const upsellStrategy: MerchantUpsellStrategy =
    plan.planType === 'PRO'
      ? 'SMART_REORDER'
      : plan.planType === 'GROWTH'
        ? 'LINKS'
        : 'BASIC';

  return {
    planType: plan.planType,
    billingInterval: plan.billingInterval,
    includedChats: plan.includedChats,
    overageRate: plan.overageRate,
    recipeLimit: plan.recipeLimit,
    aiVision: plan.planType !== 'STARTER',
    analyticsLevel,
    whatsAppConfig,
    upsellStrategy,
    shopDomain: plan.shopDomain,
  };
}

export async function getMerchantShopifyShopDomain(merchantId: string): Promise<string | null> {
  const serviceClient = getSupabaseServiceClient();
  const { data: integration } = await serviceClient
    .from('integrations')
    .select('auth_data')
    .eq('merchant_id', merchantId)
    .eq('provider', 'shopify')
    .eq('status', 'active')
    .maybeSingle();

  const shop = typeof integration?.auth_data?.shop === 'string' ? integration.auth_data.shop : null;
  return shop?.trim() || null;
}

export async function getMerchantPlanFeatures(merchantId: string): Promise<MerchantPlanFeatures> {
  const serviceClient = getSupabaseServiceClient();
  const shopDomain = await getMerchantShopifyShopDomain(merchantId);
  const { data: merchant } = await serviceClient
    .from('merchants')
    .select('subscription_plan, persona_settings')
    .eq('id', merchantId)
    .single();
  const aiVisionEnabled = Boolean((merchant?.persona_settings as any)?.ai_vision_enabled);

  if (shopDomain) {
    try {
      const shellPlan = mapShellPlan(await fetchShellPlanByShop(shopDomain));
      return {
        ...shellPlan,
        aiVision: shellPlan.aiVision && aiVisionEnabled,
      };
    } catch (error) {
      logShellIntegrationWarning(error, { merchantId, shopDomain, step: 'fetch_plan' });
    }
  }

  return {
    ...getFallbackPlanFeatures(merchant?.subscription_plan),
    aiVision: getFallbackPlanFeatures(merchant?.subscription_plan).aiVision && aiVisionEnabled,
    shopDomain,
  };
}

export async function canMerchantUseAiVision(merchantId: string) {
  const plan = await getMerchantPlanFeatures(merchantId);
  return plan.aiVision;
}

export async function canMerchantAccessAdvancedAnalytics(merchantId: string) {
  const plan = await getMerchantPlanFeatures(merchantId);
  return plan.analyticsLevel === 'ADVANCED';
}

export async function getMerchantWhatsAppSenderMode(merchantId: string) {
  const plan = await getMerchantPlanFeatures(merchantId);
  return plan.whatsAppConfig === 'CUSTOM' ? 'merchant_own' : 'corporate';
}

export async function getMerchantUpsellStrategy(merchantId: string) {
  const plan = await getMerchantPlanFeatures(merchantId);
  return plan.upsellStrategy;
}

export async function checkMerchantRecipeCapacity(merchantId: string, currentCount: number) {
  const plan = await getMerchantPlanFeatures(merchantId);
  if (plan.recipeLimit === null) {
    return { allowed: true, limit: null, current: currentCount };
  }

  return {
    allowed: currentCount < plan.recipeLimit,
    limit: plan.recipeLimit,
    current: currentCount,
  };
}

export async function recordMerchantBillableChat(input: {
  merchantId: string;
  externalEventId: string;
  description?: string;
}) {
  const shopDomain = await getMerchantShopifyShopDomain(input.merchantId);
  if (!shopDomain) {
    return { ok: false as const, reason: 'shopify_not_connected' as const };
  }

  try {
    const payload = await reportShellUsageEvent({
      shopDomain,
      usageType: 'chat',
      externalEventId: input.externalEventId,
      description: input.description,
    });

    return { ok: true as const, payload };
  } catch (error) {
    logShellIntegrationWarning(error, {
      merchantId: input.merchantId,
      shopDomain,
      externalEventId: input.externalEventId,
      step: 'record_chat_usage',
    });
    return { ok: false as const, reason: 'shell_request_failed' as const };
  }
}

export async function recordMerchantPhotoAnalysis(input: {
  merchantId: string;
  externalEventId: string;
  description?: string;
}) {
  const shopDomain = await getMerchantShopifyShopDomain(input.merchantId);
  if (!shopDomain) {
    return { ok: false as const, reason: 'shopify_not_connected' as const };
  }

  try {
    const payload = await reportShellUsageEvent({
      shopDomain,
      usageType: 'photo',
      externalEventId: input.externalEventId,
      description: input.description,
    });

    return { ok: true as const, payload };
  } catch (error) {
    logShellIntegrationWarning(error, {
      merchantId: input.merchantId,
      shopDomain,
      externalEventId: input.externalEventId,
      step: 'record_photo_usage',
    });
    return { ok: false as const, reason: 'shell_request_failed' as const };
  }
}
