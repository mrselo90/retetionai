import { isBillingReady } from './billingStatus';
import type { ShopifyMerchantOverview } from '../platform.server';

type PersonaSettings = NonNullable<ShopifyMerchantOverview['settings']['personaSettings']>;

export type SetupStepKey = 'billing' | 'whatsapp' | 'products' | 'messaging' | 'orders';

// Required steps: gate the activation metric. Setup is "complete" once all of these are done.
// 'whatsapp' joins them (second) only while connecting a number is available —
// see getSetupProgress. Nothing reaches customers without one, but a step no
// merchant can complete must not block setup either.
export const REQUIRED_SETUP_STEPS: ReadonlyArray<SetupStepKey> = [
  'billing',
  'products',
  'messaging',
] as const;

// Title and page of each required step. The Overview checklist and the
// setup banner shown on every other page both read these, so they always name
// the same step and send the merchant to the same place.
export const REQUIRED_STEP_INFO: Record<
  'billing' | 'whatsapp' | 'products' | 'messaging',
  { title: string; path: string }
> = {
  billing: { title: 'Pick a plan', path: '/app/billing' },
  whatsapp: { title: 'Connect WhatsApp', path: '/app/integrations' },
  products: { title: 'Add product instructions', path: '/app/products' },
  messaging: { title: 'Set up welcome message', path: '/app/setup/messaging' },
};

// Optional steps: shown in a separate "Polish your setup" section. Don't gate dashboard access.
export const OPTIONAL_SETUP_STEPS: ReadonlyArray<SetupStepKey> = ['orders'] as const;

/** From /app/bootstrap: whether connecting is available, and whether it is done. */
export type SetupWhatsApp = { enabled: boolean; connected: boolean } | null | undefined;

export type SetupProgress = {
  hasBilling: boolean;
  hasWhatsApp: boolean;
  whatsappRequired: boolean;
  hasProducts: boolean;
  hasMessagingConfigured: boolean;
  hasOrders: boolean;
  productCount: number;
  completedCount: number; // completed REQUIRED steps only
  totalSteps: number; // total REQUIRED steps only
  setupComplete: boolean; // all REQUIRED steps complete
  postLaunchComplete: boolean; // all OPTIONAL steps complete (informational)
  nextStep: SetupStepKey | null; // next REQUIRED step that's not done
  nextOptionalStep: SetupStepKey | null; // next OPTIONAL step that's not done
};

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasSavedMessagingConfiguration(
  settings?: PersonaSettings | null,
  notificationPhone?: string | null
) {
  return Boolean(
    hasNonEmptyString(settings?.onboarding_settings_configured_at) ||
    hasNonEmptyString(settings?.bot_name) ||
    hasNonEmptyString(settings?.whatsapp_welcome_template) ||
    hasNonEmptyString(notificationPhone)
  );
}

export function getSetupProgress(
  overview: ShopifyMerchantOverview,
  billingApproved?: boolean,
  whatsapp?: SetupWhatsApp
): SetupProgress {
  const productCount = Math.max(
    overview.metrics.totalProducts || 0,
    overview.products?.length || 0
  );
  const hasBilling =
    billingApproved ??
    isBillingReady(overview.subscription?.status || overview.merchant.subscription_status);
  const hasProducts = productCount > 0;
  const hasMessagingConfigured = hasSavedMessagingConfiguration(
    overview.settings?.personaSettings,
    overview.settings?.notificationPhone
  );
  const hasOrders = (overview.metrics.totalOrders || 0) > 0;

  const whatsappRequired = Boolean(whatsapp?.enabled);
  const hasWhatsApp = Boolean(whatsapp?.connected);

  const statusByKey: Record<SetupStepKey, boolean> = {
    billing: hasBilling,
    whatsapp: hasWhatsApp,
    products: hasProducts,
    messaging: hasMessagingConfigured,
    orders: hasOrders,
  };

  const requiredKeys: SetupStepKey[] = whatsappRequired
    ? ['billing', 'whatsapp', 'products', 'messaging']
    : [...REQUIRED_SETUP_STEPS];
  const requiredPairs = requiredKeys.map((key) => [key, statusByKey[key]] as const);
  const optionalPairs = OPTIONAL_SETUP_STEPS.map((key) => [key, statusByKey[key]] as const);

  return {
    hasBilling,
    hasWhatsApp,
    whatsappRequired,
    hasProducts,
    hasMessagingConfigured,
    hasOrders,
    productCount,
    completedCount: requiredPairs.filter(([, complete]) => complete).length,
    totalSteps: requiredPairs.length,
    setupComplete: requiredPairs.every(([, complete]) => complete),
    postLaunchComplete: optionalPairs.every(([, complete]) => complete),
    nextStep: requiredPairs.find(([, complete]) => !complete)?.[0] ?? null,
    nextOptionalStep: optionalPairs.find(([, complete]) => !complete)?.[0] ?? null,
  };
}
