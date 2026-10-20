import type { ActionFunctionArgs } from "react-router";
import { timingSafeEqual } from "node:crypto";
import { SessionNotFoundError } from "@shopify/shopify-app-react-router/server";
import { unauthenticated } from "../shopify.server";

/**
 * POST /internal/offline-token — current offline access token for a shop.
 *
 * This app owns each shop's expiring offline token: the library refreshes it in
 * the Session table when it is within five minutes of expiry. The platform API
 * and workers used to keep their own copy from install-sync with no refresh
 * token, so it died an hour after install. Shopify keeps one token chain per app
 * and store, and refreshing from two places retires each other's tokens, so they
 * ask here instead of refreshing themselves.
 */

function hasInternalSecret(request: Request): boolean {
  const provided = request.headers.get("X-Internal-Secret")?.trim() || "";
  if (!provided) return false;

  const expected = [
    process.env.INTERNAL_SERVICE_SECRET?.trim(),
    process.env.PLATFORM_INTERNAL_SECRET?.trim(),
  ].filter((value): value is string => Boolean(value));

  return expected.some((candidate) => {
    const a = Buffer.from(provided);
    const b = Buffer.from(candidate);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

// One refresh per shop at a time in this process: concurrent refreshes from the
// same refresh token race each other's rotation.
const inFlight = new Map<string, Promise<Response>>();

async function loadToken(shop: string): Promise<Response> {
  try {
    const { session } = await unauthenticated.admin(shop);
    return Response.json({
      shop,
      accessToken: session.accessToken,
      expires: session.expires ? session.expires.toISOString() : null,
      scope: session.scope ?? null,
    });
  } catch (error) {
    if (error instanceof SessionNotFoundError) {
      return Response.json({ error: "no_offline_session" }, { status: 404 });
    }
    // The refresh token is expired or was retired: only a new token exchange,
    // i.e. the merchant opening the app, can recover this shop.
    console.error("[internal-offline-token] refresh failed", {
      shop,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "reauth_required" }, { status: 409 });
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!hasInternalSecret(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { shop?: unknown } | null;
  const shop = typeof body?.shop === "string" ? body.shop.trim().toLowerCase() : "";
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
    return Response.json({ error: "shop must be a *.myshopify.com domain" }, { status: 400 });
  }

  let pending = inFlight.get(shop);
  if (!pending) {
    pending = loadToken(shop).finally(() => inFlight.delete(shop));
    inFlight.set(shop, pending);
  }
  return (await pending).clone();
};
