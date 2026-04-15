const BILLING_READY_STATUSES = new Set(["active", "accepted", "trial"]);

export function normalizeSubscriptionStatus(status?: string | null): string {
  return String(status || "").trim().toLowerCase();
}

export function isBillingReady(status?: string | null): boolean {
  return BILLING_READY_STATUSES.has(normalizeSubscriptionStatus(status));
}

