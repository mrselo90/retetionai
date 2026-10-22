/**
 * The one Polaris web components bundle the app loads, Polaris 2. AppProvider
 * renders it on embedded routes, shopify.server.ts preloads the same URL in its
 * Link header, and the pages outside the admin add it as a script tag. Keep the
 * places on one value: two different bundles on a page break the components.
 *
 * polaris-2.js follows stable 2.x releases, so @shopify/polaris-types is ^2.0.
 * Polaris 2 matches the admin's appearance (current or updated) at runtime.
 */
export const POLARIS_URL = 'https://cdn.shopify.com/shopifycloud/polaris-2.js';
