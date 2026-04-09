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

function normalizeShopifyProduct(node: any): ShopifyProduct {
  const variantEdges = node?.variants?.edges ?? [];
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
    id: node?.id?.replace('gid://shopify/Product/', '') || node?.id || '',
    title: node?.title || '',
    handle: node?.handle || '',
    status: node?.status || '',
    descriptionHtml: node?.descriptionHtml ?? undefined,
    productType: node?.productType ?? undefined,
    vendor: node?.vendor ?? undefined,
    tags: Array.isArray(node?.tags) ? node.tags : undefined,
    featuredImageUrl: node?.featuredImage?.url ?? undefined,
    variants: variants.length > 0 ? variants : undefined,
  };
}

export function buildShopifyProductFallbackContent(product: ShopifyProduct): string {
  const lines = [
    product.title ? `Product: ${product.title}` : '',
    product.productType ? `Product type: ${product.productType}` : '',
    product.vendor ? `Vendor: ${product.vendor}` : '',
    product.tags?.length ? `Tags: ${product.tags.join(', ')}` : '',
    product.descriptionHtml ? `Description:\n${product.descriptionHtml}` : '',
    product.variants?.length
      ? `Variants:\n${product.variants
          .map((variant) => {
            const detail = [variant.title, variant.price ? `price ${variant.price}` : '', variant.sku ? `sku ${variant.sku}` : '']
              .filter(Boolean)
              .join(' | ');
            return `- ${detail}`;
          })
          .join('\n')}`
      : '',
  ].filter(Boolean);

  return lines.join('\n\n').trim();
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
    query getProductByHandle($search: String!) {
      products(first: 1, query: $search) {
        edges {
          node {
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
      }
    }
  `;
  const variables = { search: `handle:${handle}` };

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
  const node = json?.data?.products?.edges?.[0]?.node;

  if (!node) return null;

  return normalizeShopifyProduct(node);
}
