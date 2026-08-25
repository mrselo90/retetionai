/**
 * PostHog wiring for the standalone web app (recete.co.uk).
 *
 * Requests go through our own origin (`/rc-relay/*` → EU cloud, rewritten in
 * next.config.mjs) because ad blockers block requests to *.posthog.com by
 * default, which silently loses a chunk of real traffic. The path is
 * deliberately not something like `/analytics` or `/posthog` — blocker lists
 * match those too.
 *
 * NEXT_PUBLIC_* values are inlined at build time, so the token has to be
 * present when `next build` runs, not just when the server starts.
 */

/** Path on our own origin that proxies to PostHog. Must match the rewrites in next.config.mjs. */
export const POSTHOG_PROXY_PATH = '/rc-relay';

/** The real PostHog app URL — used for toolbar/session links, never for ingestion. */
export const POSTHOG_UI_HOST = 'https://eu.posthog.com';

/** Public project token (phc_...). Safe to ship to the browser by design. */
export const POSTHOG_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? '';

/**
 * Analytics is a no-op without a token, so local dev and preview builds run
 * clean instead of throwing or spraying failed requests at the proxy.
 */
export function isAnalyticsConfigured(): boolean {
  return POSTHOG_TOKEN.length > 0;
}
