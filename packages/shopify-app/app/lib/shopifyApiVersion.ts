import { ApiVersion } from "@shopify/shopify-app-react-router/server";

/**
 * The Shopify Admin API version for the whole embedded app: shopifyApp()
 * (admin GraphQL, webhooks, billing), raw GraphQL calls and codegen.
 *
 * shopify.app.toml can't import this, so its `[webhooks] api_version` repeats
 * it; shopifyApiVersion.test.ts fails if they drift. The API and workers use
 * SHOPIFY_ADMIN_API_VERSION from @recete/shared; keep both on the same version.
 * Support windows: https://shopify.dev/docs/api/usage/versioning
 */
export const SHOPIFY_API_VERSION = ApiVersion.October26;
