import { getShopifyAccessToken, getSupabaseServiceClient, shopifyAdminGraphqlUrl } from '@recete/shared';

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>;

export interface ShopifyIntegrationRow {
  id: string;
  merchant_id: string;
  status: string;
  auth_data: Record<string, unknown> | null;
  updated_at: string | null;
}

export interface ShopifyIntegrationLookup {
  integration: ShopifyIntegrationRow | null;
  error: { message: string; code?: string } | null;
}

/**
 * The one way to find a shop's Shopify integration.
 *
 * Every lookup used to end in `.maybeSingle()` with the error ignored. The moment
 * a shop had two rows, maybeSingle returned an error instead of a row, callers
 * read that as "no integration", and each reacted in its own way: install-sync
 * created another merchant, the webhook route answered 404 and dropped the event
 * (orders, uninstalls, GDPR requests alike), session verification called it a new
 * install, and the internal-auth check refused with 403 — which the Shopify shell
 * answered by calling install-sync again. One shop reached 41 merchants in a
 * single day that way.
 *
 * Two rules:
 * - An error is an error. It comes back as `error`, never folded into "not found",
 *   so no caller can mistake a failed query for an absent shop and provision a
 *   duplicate on the strength of it.
 * - The answer is deterministic. The most recently updated row wins, every time.
 *   Once migration 045's unique index is in place there is only ever one row; the
 *   ordering is what keeps behaviour sane on any database that has not had that
 *   cleanup, and it picks the row holding the newest access token.
 *
 * `activeOnly` mirrors the call sites that already filtered on status. GDPR
 * lookups must NOT pass it: shop/redact arrives 48 hours after an uninstall, when
 * the integration is no longer active and still has to be found.
 */
export async function findShopifyIntegration(
  client: ServiceClient,
  shop: string,
  opts: { activeOnly?: boolean } = {}
): Promise<ShopifyIntegrationLookup> {
  let query = client
    .from('integrations')
    .select('id, merchant_id, status, auth_data, updated_at')
    .eq('provider', 'shopify')
    .contains('auth_data', { shop });

  if (opts.activeOnly) {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    return { integration: null, error: { message: error.message, code: error.code } };
  }

  const row = (data?.[0] ?? null) as ShopifyIntegrationRow | null;
  return { integration: row, error: null };
}

/** Shop and a fresh Admin API token for the merchant's active Shopify integration, or null without one. */
export async function shopifyCredentialsForMerchant(client: ServiceClient, merchantId: string) {
  const { data: integration } = await client
    .from('integrations')
    .select('id, auth_data')
    .eq('merchant_id', merchantId)
    .eq('provider', 'shopify')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!integration) return null;
  return getShopifyAccessToken(integration);
}

export async function shopifyGraphql<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
  timeoutMs = 15_000,
) {
  const response = await fetch(shopifyAdminGraphqlUrl(shop), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Shopify GraphQL ${response.status}`);
  return (await response.json()) as { data?: T; errors?: Array<{ message: string; extensions?: { code?: string } }> };
}
