// "trial" is deliberately NOT here. The API puts every fresh install on
// subscription_status "trial" (reactivateMerchantForShopifyInstall), so counting
// it marked "Pick a plan" done for stores that never approved a plan, while the
// Billing page correctly said "No plan". A real Shopify trial shows up as an
// active subscription (billing.check hasActivePayment) and still counts.
const BILLING_READY_STATUSES = new Set(['active', 'accepted']);

export function normalizeSubscriptionStatus(status?: string | null): string {
  return String(status || '')
    .trim()
    .toLowerCase();
}

export function isBillingReady(status?: string | null): boolean {
  return BILLING_READY_STATUSES.has(normalizeSubscriptionStatus(status));
}
