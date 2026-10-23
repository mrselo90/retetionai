/**
 * WhatsApp opt-in from the Thank you page (extensions/whatsapp-optin).
 *
 * Checkout's own consent components only support SMS, so the extension asks
 * this app to record WhatsApp marketing consent in Shopify. Shopify then sends
 * customers_whats_app_marketing_consent/update and the platform applies it to
 * the customer it messages (packages/api/src/lib/whatsappConsent.ts); an order
 * processed later reads the same consent from Shopify.
 *
 * The request carries the session token (shop), the order id and the checkout
 * token. The order must belong to that checkout and be recent, so nobody can
 * opt somebody else in by guessing an order id.
 */

export const OPT_IN_WINDOW_MS = 24 * 60 * 60 * 1000;

interface AdminGraphql {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

export type OptInStatus =
  | { eligible: false; reason: "order_not_found" | "checkout_mismatch" | "expired" | "no_customer" | "no_phone" }
  | { eligible: true; customerId: string; state: string };

/** Thank-you page order ids are OrderIdentity GIDs; the Admin API wants Order. */
export function toOrderGid(orderId: string): string | null {
  const match = String(orderId || "").match(/(\d+)\s*$/);
  return match ? `gid://shopify/Order/${match[1]}` : null;
}

async function graphqlJson<T>(admin: AdminGraphql, query: string, variables: Record<string, unknown>) {
  const response = await admin.graphql(query, { variables });
  const body = (await response.json()) as { data?: T; errors?: unknown };
  if (body.errors) throw new Error(`Shopify GraphQL error: ${JSON.stringify(body.errors).slice(0, 300)}`);
  return body.data as T;
}

export async function getOptInStatus(
  admin: AdminGraphql,
  input: { orderId: string; checkoutToken: string },
  now = Date.now()
): Promise<OptInStatus> {
  const orderGid = toOrderGid(input.orderId);
  if (!orderGid || !input.checkoutToken) return { eligible: false, reason: "order_not_found" };

  const data = await graphqlJson<{
    order: {
      createdAt: string;
      checkoutToken: string | null;
      customer: {
        id: string;
        defaultPhoneNumber: {
          phoneNumber: string | null;
          whatsAppMarketingConsent: { state: string | null } | null;
        } | null;
      } | null;
    } | null;
  }>(
    admin,
    `#graphql
    query WhatsAppOptInOrder($id: ID!) {
      order(id: $id) {
        createdAt
        checkoutToken
        customer {
          id
          defaultPhoneNumber {
            phoneNumber
            whatsAppMarketingConsent { state }
          }
        }
      }
    }`,
    { id: orderGid }
  );

  const order = data?.order;
  if (!order) return { eligible: false, reason: "order_not_found" };
  if (!order.checkoutToken || order.checkoutToken !== input.checkoutToken) {
    return { eligible: false, reason: "checkout_mismatch" };
  }
  if (now - Date.parse(order.createdAt) > OPT_IN_WINDOW_MS) return { eligible: false, reason: "expired" };
  if (!order.customer) return { eligible: false, reason: "no_customer" };
  if (!order.customer.defaultPhoneNumber?.phoneNumber) return { eligible: false, reason: "no_phone" };
  return {
    eligible: true,
    customerId: order.customer.id,
    state: order.customer.defaultPhoneNumber.whatsAppMarketingConsent?.state ?? "NEVER_SUBSCRIBED",
  };
}

export async function subscribeToWhatsApp(
  admin: AdminGraphql,
  customerId: string,
  now = new Date()
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const data = await graphqlJson<{
    customerWhatsAppMarketingConsentUpdate: { userErrors: Array<{ message: string }> } | null;
  }>(
    admin,
    `#graphql
    mutation WhatsAppOptIn($input: CustomerWhatsAppMarketingConsentUpdateInput!) {
      customerWhatsAppMarketingConsentUpdate(input: $input) {
        userErrors { field message }
      }
    }`,
    {
      input: {
        customerId,
        whatsAppMarketingConsent: {
          state: "SUBSCRIBED",
          optInLevel: "SINGLE_OPT_IN",
          updatedAt: now.toISOString(),
        },
      },
    }
  );
  const errors = data?.customerWhatsAppMarketingConsentUpdate?.userErrors ?? [];
  return errors.length ? { ok: false, errors: errors.map((e) => e.message) } : { ok: true };
}
