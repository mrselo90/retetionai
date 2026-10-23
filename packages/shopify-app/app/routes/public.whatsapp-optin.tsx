import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
import { getOptInStatus, subscribeToWhatsApp } from "../lib/whatsappOptIn.server";

/**
 * Called by the Thank you page extension (extensions/whatsapp-optin) with the
 * checkout session token. GET: can this order's customer opt in, and are they
 * already subscribed? POST: record the WhatsApp opt-in in Shopify.
 * authenticate.public.checkout verifies the token and answers CORS preflights.
 */

const shopFromToken = (dest: unknown) => String(dest || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

function readParams(url: URL, body?: Record<string, unknown>) {
  return {
    orderId: String(body?.orderId ?? url.searchParams.get("orderId") ?? ""),
    checkoutToken: String(body?.checkoutToken ?? url.searchParams.get("checkoutToken") ?? ""),
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { sessionToken, cors } = await authenticate.public.checkout(request);
  const { admin } = await unauthenticated.admin(shopFromToken(sessionToken.dest));
  const status = await getOptInStatus(admin, readParams(new URL(request.url)));
  return cors(
    Response.json(
      status.eligible
        ? { eligible: true, subscribed: status.state === "SUBSCRIBED" }
        : { eligible: false, reason: status.reason }
    )
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { sessionToken, cors } = await authenticate.public.checkout(request);
  if (request.method !== "POST") return cors(new Response(null, { status: 405 }));

  const shop = shopFromToken(sessionToken.dest);
  const { admin } = await unauthenticated.admin(shop);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const status = await getOptInStatus(admin, readParams(new URL(request.url), body));
  if (!status.eligible) {
    return cors(Response.json({ ok: false, reason: status.reason }, { status: 409 }));
  }
  if (status.state === "SUBSCRIBED") return cors(Response.json({ ok: true, subscribed: true }));

  const result = await subscribeToWhatsApp(admin, status.customerId);
  if (!result.ok) {
    console.error(`[whatsapp-optin] Shopify rejected the opt-in for ${shop}: ${result.errors.join("; ")}`);
    return cors(Response.json({ ok: false, reason: "rejected" }, { status: 422 }));
  }
  return cors(Response.json({ ok: true, subscribed: true }));
};
