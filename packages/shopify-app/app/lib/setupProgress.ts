import { isBillingReady } from "./billingStatus";
import type { ShopifyMerchantOverview } from "../platform.server";

type PersonaSettings = NonNullable<ShopifyMerchantOverview["settings"]["personaSettings"]>;

export type SetupStepKey = "billing" | "products" | "messaging" | "orders";

export type SetupProgress = {
  hasBilling: boolean;
  hasProducts: boolean;
  hasMessagingConfigured: boolean;
  hasOrders: boolean;
  productCount: number;
  completedCount: number;
  totalSteps: number;
  setupComplete: boolean;
  nextStep: SetupStepKey | null;
};

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasSavedMessagingConfiguration(settings?: PersonaSettings | null, notificationPhone?: string | null) {
  return Boolean(
    hasNonEmptyString(settings?.onboarding_settings_configured_at) ||
      hasNonEmptyString(settings?.bot_name) ||
      hasNonEmptyString(settings?.whatsapp_welcome_template) ||
      hasNonEmptyString(notificationPhone),
  );
}

export function getSetupProgress(
  overview: ShopifyMerchantOverview,
  billingApproved?: boolean,
): SetupProgress {
  const productCount = Math.max(overview.metrics.totalProducts || 0, overview.products?.length || 0);
  const hasBilling = billingApproved ?? isBillingReady(overview.subscription?.status || overview.merchant.subscription_status);
  const hasProducts = productCount > 0;
  const hasMessagingConfigured = hasSavedMessagingConfiguration(
    overview.settings?.personaSettings,
    overview.settings?.notificationPhone,
  );
  const hasOrders = (overview.metrics.totalOrders || 0) > 0;

  const steps: Array<[SetupStepKey, boolean]> = [
    ["billing", hasBilling],
    ["products", hasProducts],
    ["messaging", hasMessagingConfigured],
    ["orders", hasOrders],
  ];

  return {
    hasBilling,
    hasProducts,
    hasMessagingConfigured,
    hasOrders,
    productCount,
    completedCount: steps.filter(([, complete]) => complete).length,
    totalSteps: steps.length,
    setupComplete: steps.every(([, complete]) => complete),
    nextStep: steps.find(([, complete]) => !complete)?.[0] ?? null,
  };
}
