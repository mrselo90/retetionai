import { authenticate } from "../shopify.server";
import { setVerifiedShopDomain } from "./verifiedShop.server";

/**
 * Authenticates an embedded admin request and records the verified shop domain.
 *
 * `authenticate.admin()` is the only real check here: it validates the session
 * token signature and derives the shop from the token's `dest` claim. The shop
 * it returns is recorded via `setVerifiedShopDomain` so that outbound internal
 * API calls identify the tenant from verified data rather than from the
 * attacker-controlled `?shop=` query parameter.
 */
export async function authenticateEmbeddedAdmin(request: Request) {
  const result = await authenticate.admin(request);

  if (result.session?.shop) {
    setVerifiedShopDomain(request, result.session.shop);
  }

  console.info("[embedded-auth]", {
    path: new URL(request.url).pathname,
    shopVerified: Boolean(result.session?.shop),
  });

  return result;
}
