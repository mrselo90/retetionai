import { fetchShopifyCatalog, type ShopifyCatalogProduct } from '../platform.server';
import { getVerifiedShopDomain } from './verifiedShop.server';

/**
 * The shop's whole Shopify catalog, not just its first page.
 *
 * Products used to load `first: 100` and never asked for the next page, so a
 * store with more products could not see or set up the rest, and "Draft all
 * with AI" never reached them. Product status (needs setup / ready) is computed
 * by joining the catalog with Recete's own records, so tabs, counts and paging
 * need the full list; Shopify cursor paging alone would count one page only.
 *
 * Pages are 250 (the API's maximum). The result is cached briefly per shop so
 * moving between list pages, tabs and a product's detail does not refetch it.
 */

export const CATALOG_PAGE_SIZE = 250;
export const CATALOG_MAX_PRODUCTS = 2500;
const CACHE_TTL_MS = 60_000;

export interface FullCatalog {
  shopDomain: string;
  products: ShopifyCatalogProduct[];
  /** More products exist beyond CATALOG_MAX_PRODUCTS. */
  truncated: boolean;
}

const cache = new Map<string, { expiresAt: number; value: FullCatalog }>();

function cacheKeyFor(request: Request): string | null {
  // Only the shop proven by session-token verification. The `?shop=` query
  // parameter is caller-controlled, and the cache is read before any platform
  // call checks it, so keying on it would hand one shop another's catalog.
  return getVerifiedShopDomain(request) || null;
}

export async function fetchFullShopifyCatalog(
  request: Request,
  options: { fresh?: boolean; maxProducts?: number } = {}
): Promise<FullCatalog> {
  const maxProducts = options.maxProducts ?? CATALOG_MAX_PRODUCTS;
  const key = cacheKeyFor(request);
  const now = Date.now();
  if (key && !options.fresh) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) return hit.value;
  }

  const products: ShopifyCatalogProduct[] = [];
  let shopDomain = '';
  let after: string | undefined;
  let truncated = false;

  for (;;) {
    const page = await fetchShopifyCatalog(request, { first: CATALOG_PAGE_SIZE, after });
    shopDomain = page.shopDomain || shopDomain;
    products.push(...page.products);

    if (!page.hasNextPage || !page.endCursor) break;
    if (products.length >= maxProducts) {
      truncated = true;
      break;
    }
    after = page.endCursor;
  }

  const value: FullCatalog = {
    shopDomain,
    products: products.slice(0, maxProducts),
    truncated: truncated || products.length > maxProducts,
  };
  if (key) cache.set(key, { expiresAt: now + CACHE_TTL_MS, value });
  return value;
}

/** Drop a shop's cached catalog, e.g. after the merchant edits a product in Shopify. */
export function invalidateFullShopifyCatalog(request: Request) {
  const key = cacheKeyFor(request);
  if (key) cache.delete(key);
}
