/**
 * Shared Shopify utilities
 */

export interface ShopifyProductVariant {
  id: string;
  title: string;
  price: string;
  sku: string | null;
  inventoryQuantity?: number | null;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  descriptionHtml?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  featuredImageUrl?: string;
  variants?: ShopifyProductVariant[];
}

/**
 * Fetch a single product from Shopify by handle via GraphQL
 */
export async function fetchShopifyProductByHandle(
  shop: string,
  accessToken: string,
  handle: string
): Promise<ShopifyProduct | null> {
  const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${cleanShop}/admin/api/2026-01/graphql.json`;

  const query = `
    query getProductByHandle($handle: String!) {
      productByHandle(handle: $handle) {
        id
        title
        handle
        status
        descriptionHtml
        productType
        vendor
        tags
        featuredImage { url }
        variants(first: 5) {
          edges {
            node {
              id
              title
              price
              sku
            }
          }
        }
      }
    }
  `;
  const variables = { handle };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error: ${res.status} - ${text}`);
  }

  const json = (await res.json()) as any;
  const node = json?.data?.productByHandle;

  if (!node) return null;

  const variantEdges = node.variants?.edges ?? [];
  const variants: ShopifyProductVariant[] = variantEdges.map((ve: any) => {
    const v = ve.node;
    return {
      id: v.id?.replace('gid://shopify/ProductVariant/', '') || v.id,
      title: v.title || '',
      price: v.price || '',
      sku: v.sku ?? null,
    };
  });

  return {
    id: node.id?.replace('gid://shopify/Product/', '') || node.id,
    title: node.title || '',
    handle: node.handle || '',
    status: node.status || '',
    descriptionHtml: node.descriptionHtml ?? undefined,
    productType: node.productType ?? undefined,
    vendor: node.vendor ?? undefined,
    tags: Array.isArray(node.tags) ? node.tags : undefined,
    featuredImageUrl: node.featuredImage?.url ?? undefined,
    variants: variants.length > 0 ? variants : undefined,
  };
}
