/**
 * Collapses record ids in a pathname so path reports stay readable.
 *
 * `/dashboard/customers/8f3c…` becomes `/dashboard/customers/:id`. Without this
 * the three dynamic routes (customers, products, conversations) produce one row
 * per record, and the Paths report is unusable by the time a merchant has a few
 * hundred customers.
 *
 * PostHog has a feature for exactly this — path cleaning rules — but it is
 * behind a paid plan on this account, so it happens client side instead. Only
 * `$pathname` is rewritten; `$current_url` keeps the real id, so which record
 * was viewed is still recoverable from the raw event.
 *
 * Segments are replaced only when they LOOK like an id. A blanket "segment after
 * /products/" rule would rewrite /dashboard/products/shopify-map — a real static
 * page — into the id bucket, and would silently swallow any static child route
 * added later.
 */

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const DIGITS = /^\d+$/;
/** Shopify ids and the like: long and unbroken, unlike slugs such as `shopify-map`. */
const OPAQUE = /^[0-9a-zA-Z]{20,}$/;

function looksLikeId(segment: string): boolean {
  return UUID.test(segment) || DIGITS.test(segment) || OPAQUE.test(segment);
}

export function cleanPathname(pathname: string): string {
  if (!pathname) return pathname;

  return pathname
    .split('/')
    .map((segment) => (looksLikeId(segment) ? ':id' : segment))
    .join('/');
}
