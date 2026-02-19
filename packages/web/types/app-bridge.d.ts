/**
 * TypeScript declarations for Shopify App Bridge web components
 * and the window.shopify global injected by app-bridge.js
 */

declare namespace JSX {
    interface IntrinsicElements {
        's-app-nav': React.HTMLAttributes<HTMLElement>;
        's-app-nav-item': React.HTMLAttributes<HTMLElement> & {
            id?: string;
            label?: string;
            url?: string;
            selected?: boolean;
        };
        's-save-bar': React.HTMLAttributes<HTMLElement> & {
            id?: string;
        };
        's-modal': React.HTMLAttributes<HTMLElement> & {
            id?: string;
            open?: boolean;
        };
    }
}

interface ShopifyAppBridge {
    idToken: () => Promise<string>;
    config: {
        shop: string;
        locale: string;
        apiKey: string;
    };
}

interface Window {
    shopify?: ShopifyAppBridge;
}
