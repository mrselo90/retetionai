import { logger } from '@recete/shared';

export interface ShopifyShellPlanSnapshot {
  shopId: string;
  shopDomain: string;
  planType: 'STARTER' | 'GROWTH' | 'PRO';
  billingInterval: 'MONTHLY' | 'ANNUAL';
  isTrial: boolean;
  subscriptionId: string | null;
  subscriptionLineItemId: string | null;
  recipeCount: number;
  chatsSentThisMonth: number;
  photosAnalyzedCount: number;
  recipesCreatedCount: number;
  includedChats: number;
  recipeLimit: number | null;
  overageRate: number;
}

function getShellBaseUrl(): string | null {
  const raw =
    process.env.SHOPIFY_SHELL_URL?.trim() ||
    process.env.SHOPIFY_APP_URL?.trim() ||
    null;

  return raw ? raw.replace(/\/$/, '') : null;
}

function getInternalSecret(): string {
  const secret = process.env.INTERNAL_SERVICE_SECRET?.trim();
  if (!secret) {
    throw new Error('INTERNAL_SERVICE_SECRET is required for Shopify shell integration');
  }
  return secret;
}

async function shellRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getShellBaseUrl();
  if (!baseUrl) {
    throw new Error('SHOPIFY_SHELL_URL or SHOPIFY_APP_URL is required for Shopify shell integration');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': getInternalSecret(),
      ...(init?.headers || {}),
    },
  });

  const bodyText = await response.text();
  const payload = bodyText ? JSON.parse(bodyText) : null;

  if (!response.ok) {
    throw new Error(`Shopify shell request ${path} failed with ${response.status}: ${bodyText}`);
  }

  return payload as T;
}

export async function fetchShellPlanByShop(shopDomain: string): Promise<ShopifyShellPlanSnapshot> {
  const payload = await shellRequest<{ plan: ShopifyShellPlanSnapshot }>(
    `/internal/plan?shop=${encodeURIComponent(shopDomain)}`,
  );
  return payload.plan;
}

export async function reportShellUsageEvent(input: {
  shopDomain: string;
  usageType: 'chat' | 'photo';
  externalEventId: string;
  description?: string;
  quantity?: number;
}) {
  return shellRequest<{ ok: true; result: { chargedUnits: number; usageRecordId?: string | null; alreadyProcessed: boolean } }>(
    '/internal/billing/usage',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function logShellIntegrationWarning(error: unknown, context: Record<string, unknown>) {
  logger.warn(
    {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    },
    'Shopify shell integration fallback triggered',
  );
}
