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
        return await window.shopify!.idToken();
    } catch {
        return null;
    }
}

export function getShopifyShop(): string | null {
    if (!isShopifyEmbedded()) return null;
    return window.shopify!.config?.shop ?? null;
}
