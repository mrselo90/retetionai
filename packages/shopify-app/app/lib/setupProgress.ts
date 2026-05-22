import { isBillingReady } from "./billingStatus";
import type { ShopifyMerchantOverview } from "../platform.server";

type PersonaSettings = NonNullable<ShopifyMerchantOverview["settings"]["personaSettings"]>;

export type SetupStepKey = "billing" | "products" | "messaging" | "orders" | "themeEmbed";

// Required steps: gate the activation metric. Setup is "complete" once all of these are done.
export const REQUIRED_SETUP_STEPS: ReadonlyArray<SetupStepKey> = ["billing", "products", "messaging"] as const;

// Optional steps: shown in a separate "Polish your setup" section. Don't gate dashboard access.
export const OPTIONAL_SETUP_STEPS: ReadonlyArray<SetupStepKey> = ["orders", "themeEmbed"] as const;

export type SetupProgress = {
  hasBilling: boolean;
  hasProducts: boolean;
  hasMessagingConfigured: boolean;
  hasOrders: boolean;
  hasThemeEmbed: boolean;
  productCount: number;
  completedCount: number;       // completed REQUIRED steps only
  totalSteps: number;            // total REQUIRED steps only
  setupComplete: boolean;        // all REQUIRED steps complete
  postLaunchComplete: boolean;   // all OPTIONAL steps complete (informational)
  nextStep: SetupStepKey | null; // next REQUIRED step that's not done
  nextOptionalStep: SetupStepKey | null; // next OPTIONAL step that's not done
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
  themeEmbedEnabled?: boolean,
): SetupProgress {
  const productCount = Math.max(overview.metrics.totalProducts || 0, overview.products?.length || 0);
  const hasBilling = billingApproved ?? isBillingReady(overview.subscription?.status || overview.merchant.subscription_status);
  const hasProducts = productCount > 0;
  const hasMessagingConfigured = hasSavedMessagingConfiguration(
    overview.settings?.personaSettings,
    overview.settings?.notificationPhone,
  );
  const hasOrders = (overview.metrics.totalOrders || 0) > 0;
  const hasThemeEmbed = themeEmbedEnabled ?? false;

  const statusByKey: Record<SetupStepKey, boolean> = {
    billing: hasBilling,
    products: hasProducts,
    messaging: hasMessagingConfigured,
    orders: hasOrders,
    themeEmbed: hasThemeEmbed,
  };

  const requiredPairs = REQUIRED_SETUP_STEPS.map((key) => [key, statusByKey[key]] as const);
  const optionalPairs = OPTIONAL_SETUP_STEPS.map((key) => [key, statusByKey[key]] as const);

  return {
    hasBilling,
    hasProducts,
    hasMessagingConfigured,
    hasOrders,
    hasThemeEmbed,
    productCount,
    completedCount: requiredPairs.filter(([, complete]) => complete).length,
    totalSteps: requiredPairs.length,
    setupComplete: requiredPairs.every(([, complete]) => complete),
    postLaunchComplete: optionalPairs.every(([, complete]) => complete),
    nextStep: requiredPairs.find(([, complete]) => !complete)?.[0] ?? null,
    nextOptionalStep: optionalPairs.find(([, complete]) => !complete)?.[0] ?? null,
  };
}
