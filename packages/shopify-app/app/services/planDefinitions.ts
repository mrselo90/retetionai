import { BillingInterval as ShopifyBillingInterval } from "@shopify/shopify-app-react-router/server";
import type { BillingInterval as PrismaBillingInterval, PlanType as PrismaPlanType } from "@prisma/client";

export const STARTER_MONTHLY_PLAN = "starter-monthly";
export const STARTER_YEARLY_PLAN = "starter-yearly";
export const GROWTH_MONTHLY_PLAN = "growth-monthly";
export const GROWTH_YEARLY_PLAN = "growth-yearly";
export const PRO_MONTHLY_PLAN = "pro-monthly";
export const PRO_YEARLY_PLAN = "pro-yearly";

export type PlanKey =
  | typeof STARTER_MONTHLY_PLAN
  | typeof STARTER_YEARLY_PLAN
  | typeof GROWTH_MONTHLY_PLAN
  | typeof GROWTH_YEARLY_PLAN
  | typeof PRO_MONTHLY_PLAN
  | typeof PRO_YEARLY_PLAN;

export type PlanCapability = {
  planType: PrismaPlanType;
  billingInterval: PrismaBillingInterval;
  label: string;
  price: number;
  recurringInterval: ShopifyBillingInterval.Every30Days | ShopifyBillingInterval.Annual;
  includedChats: number;
  overageRate: number;
  recipeLimit: number | null;
  aiVision: boolean;
  whatsAppConfig: "SHARED" | "CUSTOM";
  analyticsLevel: "BASIC" | "ADVANCED";
  upsellStrategy: "BASIC" | "LINKS" | "SMART_REORDER";
};

export const DEFAULT_CAPPED_AMOUNT = 500;

export const PLAN_DEFINITIONS: Record<PlanKey, PlanCapability> = {
  [STARTER_MONTHLY_PLAN]: {
    planType: "STARTER",
    billingInterval: "MONTHLY",
    label: "Starter Monthly",
    price: 29,
    recurringInterval: ShopifyBillingInterval.Every30Days,
    includedChats: 150,
    overageRate: 0.18,
    recipeLimit: 20,
    aiVision: false,
    whatsAppConfig: "SHARED",
    analyticsLevel: "BASIC",
    upsellStrategy: "BASIC",
  },
  [STARTER_YEARLY_PLAN]: {
    planType: "STARTER",
    billingInterval: "ANNUAL",
    label: "Starter Yearly",
    price: 290,
    recurringInterval: ShopifyBillingInterval.Annual,
    includedChats: 150,
    overageRate: 0.18,
    recipeLimit: 20,
    aiVision: false,
    whatsAppConfig: "SHARED",
    analyticsLevel: "BASIC",
    upsellStrategy: "BASIC",
  },
  [GROWTH_MONTHLY_PLAN]: {
    planType: "GROWTH",
    billingInterval: "MONTHLY",
    label: "Growth Monthly",
    price: 69,
    recurringInterval: ShopifyBillingInterval.Every30Days,
    includedChats: 1000,
    overageRate: 0.12,
    recipeLimit: 500,
    aiVision: true,
    whatsAppConfig: "SHARED",
    analyticsLevel: "BASIC",
    upsellStrategy: "LINKS",
  },
  [GROWTH_YEARLY_PLAN]: {
    planType: "GROWTH",
    billingInterval: "ANNUAL",
    label: "Growth Yearly",
    price: 690,
    recurringInterval: ShopifyBillingInterval.Annual,
    includedChats: 1000,
    overageRate: 0.12,
    recipeLimit: 500,
    aiVision: true,
    whatsAppConfig: "SHARED",
    analyticsLevel: "BASIC",
    upsellStrategy: "LINKS",
  },
  [PRO_MONTHLY_PLAN]: {
    planType: "PRO",
    billingInterval: "MONTHLY",
    label: "Pro Monthly",
    price: 169,
    recurringInterval: ShopifyBillingInterval.Every30Days,
    includedChats: 3000,
    overageRate: 0.08,
    recipeLimit: null,
    aiVision: true,
    whatsAppConfig: "CUSTOM",
    analyticsLevel: "ADVANCED",
    upsellStrategy: "SMART_REORDER",
  },
  [PRO_YEARLY_PLAN]: {
    planType: "PRO",
    billingInterval: "ANNUAL",
    label: "Pro Yearly",
    price: 1690,
    recurringInterval: ShopifyBillingInterval.Annual,
    includedChats: 3000,
    overageRate: 0.08,
    recipeLimit: null,
    aiVision: true,
    whatsAppConfig: "CUSTOM",
    analyticsLevel: "ADVANCED",
    upsellStrategy: "SMART_REORDER",
  },
};

export const PLAN_ORDER: PrismaPlanType[] = ["STARTER", "GROWTH", "PRO"];

export function isPlanKey(value: string): value is PlanKey {
  return value in PLAN_DEFINITIONS;
}

export function getPlanDefinitionByKey(planKey: PlanKey): PlanCapability {
  return PLAN_DEFINITIONS[planKey];
}

export function getPlanDefinition(
  planType: PrismaPlanType,
  billingInterval: PrismaBillingInterval,
): PlanCapability {
  const match = Object.values(PLAN_DEFINITIONS).find(
    (definition) =>
      definition.planType === planType &&
      definition.billingInterval === billingInterval,
  );

  if (!match) {
    throw new Error(`Unknown plan configuration for ${planType}/${billingInterval}`);
  }

  return match;
}

export function comparePlans(
  currentPlan: PrismaPlanType,
  requiredPlan: PrismaPlanType,
): number {
  return PLAN_ORDER.indexOf(currentPlan) - PLAN_ORDER.indexOf(requiredPlan);
}

export function getUsageTerms(planKey: PlanKey): string {
  const definition = getPlanDefinitionByKey(planKey);
  return `$${definition.overageRate.toFixed(2)} per chat after ${definition.includedChats} chats per monthly usage cycle.`;
}
