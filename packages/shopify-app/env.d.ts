/// <reference types="vite/client" />
/// <reference types="@react-router/node" />

declare namespace NodeJS {
  interface ProcessEnv {
    SHOPIFY_API_KEY?: string;
    SHOPIFY_API_SECRET?: string;
    SHOPIFY_APP_URL?: string;
    SCOPES?: string;
    SHOP_CUSTOM_DOMAIN?: string;
    DATABASE_URL?: string;
    PLATFORM_API_URL?: string;
    PLATFORM_INTERNAL_SECRET?: string;
    LEGACY_DASHBOARD_URL?: string;
  }
}
