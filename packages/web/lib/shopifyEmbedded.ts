/**
 * Standalone-only web surface.
 * `packages/web` no longer supports Shopify embedded mode.
 */

export function isShopifyEmbedded(): boolean {
    return false;
}

export async function getShopifySessionToken(): Promise<string | null> {
    return null;
}

export function getShopifyShop(): string | null {
    return null;
}
