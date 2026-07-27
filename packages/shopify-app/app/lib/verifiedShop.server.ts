/**
 * Request-scoped store for the shop domain that Shopify's session-token
 * verification actually proved.
 *
 * Why this exists: `platform.server.ts` builds internal API headers from a bare
 * `Request` and used to read the shop from the `?shop=` query parameter, which
 * is attacker-controlled. Any merchant could append another shop's domain and
 * read or write that tenant's data. The authenticated shop is only available
 * where `authenticate.admin()` runs, so it is recorded here and read back from
 * the header builder instead of being re-derived from the URL.
 *
 * Keyed on the Request instance so entries are collected with the request and
 * never leak between concurrent requests.
 */

const verifiedShopByRequest = new WeakMap<Request, string>();

/** Appends the `.myshopify.com` suffix so both sides of a comparison match. */
export function normalizeShopDomain(value: string | null | undefined): string {
  const trimmed = value?.trim().toLowerCase() || "";
  if (!trimmed) return "";
  return trimmed.endsWith(".myshopify.com") ? trimmed : `${trimmed}.myshopify.com`;
}

/** Records the shop proven by session-token verification for this request. */
export function setVerifiedShopDomain(request: Request, shop: string) {
  const normalized = normalizeShopDomain(shop);
  if (normalized) verifiedShopByRequest.set(request, normalized);
}

/** Returns the verified shop for this request, or "" if it was never authenticated. */
export function getVerifiedShopDomain(request: Request): string {
  return verifiedShopByRequest.get(request) || "";
}
