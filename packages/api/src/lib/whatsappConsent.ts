/**
 * WhatsApp consent: where it comes from, which decision wins, and keeping
 * Shopify in step.
 *
 * users.consent_status gates every message Recete sends ('opt_in' only). It
 * used to be derived from Shopify's email/SMS marketing consent and overwritten
 * by every order webhook, so a WhatsApp STOP came back on the customer's next
 * order. Now:
 * - Shopify orders read the customer's WhatsApp marketing consent
 *   (Customer.defaultPhoneNumber.whatsAppMarketingConsent), and only for the
 *   number we would message;
 * - customers_whats_app_marketing_consent/update keeps it in step when the
 *   merchant or another app changes it;
 * - a STOP reply opts the customer out here and in Shopify;
 * - the thank-you page opt-in writes SUBSCRIBED in Shopify, which arrives
 *   through the same webhook.
 * decideConsentUpdate() makes newer decisions win and never lets "unknown"
 * overwrite a known answer.
 */
import {
  getShopifyAccessToken,
  getSupabaseServiceClient,
  logger,
  shopifyAdminGraphqlUrl,
} from '@recete/shared';
import { normalizePhone } from './events.js';
import { decryptPhone } from './encryption.js';

export type ConsentStatus = 'opt_in' | 'opt_out' | 'pending';
export type ConsentSource =
  | 'shopify'
  | 'whatsapp_reply'
  | 'thank_you_page'
  | 'merchant_manual'
  | 'import'
  | 'legacy';

export interface ConsentDecision {
  status: ConsentStatus;
  source: ConsentSource;
  /** ISO time the decision was made at its source; null when unknown. */
  updatedAt: string | null;
}

export interface StoredConsent {
  consent_status: string | null;
  consent_source?: string | null;
  consent_updated_at?: string | null;
}

/** Shopify CustomerMarketingConsentState -> our gate. */
export function mapShopifyWhatsAppState(state: string | null | undefined): ConsentStatus {
  switch ((state || '').toUpperCase()) {
    case 'SUBSCRIBED':
      return 'opt_in';
    case 'UNSUBSCRIBED':
    case 'REDACTED':
      return 'opt_out';
    default:
      // NEVER_SUBSCRIBED, PENDING (awaiting confirmation) or nothing at all.
      return 'pending';
  }
}

const time = (iso: string | null | undefined) => {
  const value = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(value) ? value : null;
};

/**
 * The patch to store, or null to keep what we have.
 * - Nothing stored yet: take the incoming decision.
 * - 'pending' never replaces a known opt_in/opt_out.
 * - An opt-out always applies.
 * - An opt-in replaces a stored opt-out only when it is newer: a customer who
 *   replied STOP is messaged again only after they opted in afterwards.
 */
export function decideConsentUpdate(
  current: StoredConsent | null,
  incoming: ConsentDecision
): { consent_status: ConsentStatus; consent_source: ConsentSource; consent_updated_at: string } | null {
  const patch = {
    consent_status: incoming.status,
    consent_source: incoming.source,
    consent_updated_at: incoming.updatedAt ?? new Date().toISOString(),
  };
  const stored = (current?.consent_status || 'pending') as ConsentStatus;
  const storedIsLegacy = !current?.consent_source || current.consent_source === 'legacy';

  if (!current) return patch;
  if (incoming.status === 'pending') {
    // Legacy values were derived from email/SMS consent, not WhatsApp: a real
    // Shopify answer of "never subscribed" replaces them.
    return storedIsLegacy && incoming.source === 'shopify' && stored !== 'pending' ? patch : null;
  }
  if (incoming.status === stored) {
    return current.consent_source === incoming.source ? null : patch;
  }
  if (incoming.status === 'opt_out') return patch;

  // incoming opt_in over a stored opt_out or pending
  if (stored === 'opt_out' && !storedIsLegacy) {
    const storedAt = time(current.consent_updated_at);
    const incomingAt = time(incoming.updatedAt);
    if (storedAt === null || incomingAt === null || incomingAt <= storedAt) return null;
  }
  return patch;
}

interface ShopifyWhatsAppConsent {
  phoneNumber: string | null;
  state: string | null;
  updatedAt: string | null;
}

async function shopifyGraphql<T>(shop: string, accessToken: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch(shopifyAdminGraphqlUrl(shop), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Shopify GraphQL ${response.status}`);
  return (await response.json()) as { data?: T; errors?: Array<{ message: string; extensions?: { code?: string } }> };
}

export function toCustomerGid(customerId: string | number): string {
  const raw = String(customerId).trim();
  return raw.startsWith('gid://') ? raw : `gid://shopify/Customer/${raw}`;
}

/** The customer's default phone number and its WhatsApp marketing consent. */
export async function fetchShopifyWhatsAppConsent(
  shop: string,
  accessToken: string,
  customerId: string | number
): Promise<ShopifyWhatsAppConsent | null> {
  const result = await shopifyGraphql<{
    customer: {
      defaultPhoneNumber: {
        phoneNumber: string | null;
        whatsAppMarketingConsent: { state: string | null; updatedAt: string | null } | null;
      } | null;
    } | null;
  }>(
    shop,
    accessToken,
    `query CustomerWhatsAppConsent($id: ID!) {
      customer(id: $id) {
        defaultPhoneNumber {
          phoneNumber
          whatsAppMarketingConsent { state updatedAt }
        }
      }
    }`,
    { id: toCustomerGid(customerId) }
  );
  if (result.errors?.length) {
    throw new Error(`Shopify consent query failed: ${result.errors.map((e) => e.message).join('; ')}`);
  }
  const phone = result.data?.customer?.defaultPhoneNumber;
  if (!result.data?.customer) return null;
  return {
    phoneNumber: phone?.phoneNumber ?? null,
    state: phone?.whatsAppMarketingConsent?.state ?? null,
    updatedAt: phone?.whatsAppMarketingConsent?.updatedAt ?? null,
  };
}

const samePhone = (a: string | null | undefined, b: string | null | undefined) => {
  if (!a || !b) return false;
  try {
    return normalizePhone(a) === normalizePhone(b);
  } catch {
    return false;
  }
};

/**
 * The consent decision for messaging `phone`: Shopify's WhatsApp consent when
 * it belongs to that number, otherwise 'pending' (consent given for another
 * number doesn't cover this one).
 */
export function decisionForPhone(consent: ShopifyWhatsAppConsent | null, phone: string): ConsentDecision {
  if (!consent || !samePhone(consent.phoneNumber, phone)) {
    return { status: 'pending', source: 'shopify', updatedAt: null };
  }
  return { status: mapShopifyWhatsAppState(consent.state), source: 'shopify', updatedAt: consent.updatedAt };
}

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>;

async function shopifyCredentialsForMerchant(client: ServiceClient, merchantId: string) {
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

/**
 * The Shopify WhatsApp consent decision for an order's customer and the phone
 * we would message. Null when it can't be read (no Shopify integration, no
 * customer, Shopify error): callers then keep what they have.
 */
export async function shopifyConsentDecisionForOrder(input: {
  merchantId: string;
  shopifyCustomerId: string;
  phone: string;
}): Promise<ConsentDecision | null> {
  const client = getSupabaseServiceClient();
  try {
    const credentials = await shopifyCredentialsForMerchant(client, input.merchantId);
    if (!credentials) return null;
    const consent = await fetchShopifyWhatsAppConsent(credentials.shop, credentials.accessToken, input.shopifyCustomerId);
    return decisionForPhone(consent, input.phone);
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error), merchantId: input.merchantId },
      '[consent] Could not read Shopify WhatsApp consent'
    );
    return null;
  }
}

/** Apply a decision to one user row if decideConsentUpdate() says so. */
export async function applyConsentDecision(
  client: ServiceClient,
  userId: string,
  merchantId: string,
  decision: ConsentDecision
): Promise<{ changed: boolean; status: string | null }> {
  const { data: current } = await client
    .from('users')
    .select('consent_status, consent_source, consent_updated_at')
    .eq('id', userId)
    .eq('merchant_id', merchantId)
    .maybeSingle();
  const patch = decideConsentUpdate(current ?? null, decision);
  if (!patch) return { changed: false, status: current?.consent_status ?? null };
  const { error } = await client.from('users').update(patch).eq('id', userId).eq('merchant_id', merchantId);
  if (error) {
    logger.error({ error, userId, merchantId }, '[consent] Could not store consent decision');
    return { changed: false, status: current?.consent_status ?? null };
  }
  if (patch.consent_status === 'opt_out') {
    await client.from('scheduled_tasks').update({ status: 'cancelled' }).eq('user_id', userId).eq('status', 'pending');
  }
  return { changed: true, status: patch.consent_status };
}

/**
 * customers_whats_app_marketing_consent/update: re-read the customer's consent
 * from Shopify (the source of truth, whatever the payload shape) and apply it
 * to the users we know for that customer.
 */
export async function syncShopifyWhatsAppConsent(input: {
  merchantId: string;
  shop: string;
  accessToken: string;
  shopifyCustomerId: string;
}): Promise<{ users: number; changed: number }> {
  const client = getSupabaseServiceClient();
  const numericId = input.shopifyCustomerId.replace(/^gid:\/\/shopify\/Customer\//, '');
  const { data: users } = await client
    .from('users')
    .select('id, phone')
    .eq('merchant_id', input.merchantId)
    .eq('shopify_customer_id', numericId);
  if (!users?.length) return { users: 0, changed: 0 };

  const consent = await fetchShopifyWhatsAppConsent(input.shop, input.accessToken, numericId);
  let changed = 0;
  for (const user of users) {
    let phone: string | null = null;
    try {
      phone = decryptPhone(user.phone);
    } catch {
      phone = null;
    }
    if (!phone) continue;
    const result = await applyConsentDecision(client, user.id, input.merchantId, decisionForPhone(consent, phone));
    if (result.changed) changed++;
  }
  return { users: users.length, changed };
}

/**
 * Tell Shopify the customer unsubscribed from WhatsApp marketing. Best effort:
 * our own opt-out is already stored and enforced. Needs write_customers; shops
 * that haven't approved it yet are skipped with a warning.
 */
export async function pushWhatsAppOptOutToShopify(input: { merchantId: string; userId: string }): Promise<boolean> {
  const client = getSupabaseServiceClient();
  try {
    const { data: user } = await client
      .from('users')
      .select('shopify_customer_id')
      .eq('id', input.userId)
      .eq('merchant_id', input.merchantId)
      .maybeSingle();
    if (!user?.shopify_customer_id) return false;
    const credentials = await shopifyCredentialsForMerchant(client, input.merchantId);
    if (!credentials) return false;

    const result = await shopifyGraphql<{
      customerWhatsAppMarketingConsentUpdate: { userErrors: Array<{ field?: string[]; message: string }> };
    }>(
      credentials.shop,
      credentials.accessToken,
      `mutation WhatsAppOptOut($input: CustomerWhatsAppMarketingConsentUpdateInput!) {
        customerWhatsAppMarketingConsentUpdate(input: $input) {
          userErrors { field message }
        }
      }`,
      {
        input: {
          customerId: toCustomerGid(user.shopify_customer_id),
          whatsAppMarketingConsent: { state: 'UNSUBSCRIBED', updatedAt: new Date().toISOString() },
        },
      }
    );
    const denied = result.errors?.some((e) => e.extensions?.code === 'ACCESS_DENIED');
    const userErrors = result.data?.customerWhatsAppMarketingConsentUpdate?.userErrors ?? [];
    if (result.errors?.length || userErrors.length) {
      logger.warn(
        {
          merchantId: input.merchantId,
          userId: input.userId,
          missingScope: denied,
          errors: result.errors?.map((e) => e.message),
          userErrors: userErrors.map((e) => e.message),
        },
        denied
          ? '[consent] Shop has not approved write_customers yet; WhatsApp opt-out kept in Recete only'
          : '[consent] Shopify did not accept the WhatsApp opt-out'
      );
      return false;
    }
    return true;
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error), ...input },
      '[consent] Could not send WhatsApp opt-out to Shopify'
    );
    return false;
  }
}
