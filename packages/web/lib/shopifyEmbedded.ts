/**
 * Shopify App Bridge Embedded Mode Utilities
 * Safe to use in SSR — all window checks are guarded.
 */

export function isShopifyEmbedded(): boolean {
    return typeof window !== 'undefined' && !!window.shopify;
}

export async function getShopifySessionToken(): Promise<string | null> {
    if (!isShopifyEmbedded()) return null;
    try {
        const shopify = window.shopify as (typeof window.shopify & {
            id?: { getSessionToken?: () => Promise<string> };
        }) | undefined;
        if (shopify?.idToken) {
            return await shopify.idToken();
        }
        if (shopify?.id?.getSessionToken) {
            return await shopify.id.getSessionToken();
        }
        return null;
    } catch {
        return null;
    }
}

export function getShopifyShop(): string | null {
    if (!isShopifyEmbedded()) return null;
    return window.shopify!.config?.shop ?? null;
}
