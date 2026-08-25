'use client';

import type { PostHog } from 'posthog-js';
import {
  POSTHOG_PROXY_PATH,
  POSTHOG_TOKEN,
  POSTHOG_UI_HOST,
  isAnalyticsConfigured,
} from './posthogConfig';

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

/**
 * Loads and initialises PostHog, at most once, returning the client.
 *
 * Deliberately NOT called on page load. posthog.init() writes a cookie holding
 * a persistent $device_id/distinct_id and fetches remote config immediately —
 * even with opt_out_capturing_by_default, which only suppresses event capture.
 * Storing that identifier before the visitor agrees is exactly what UK PECR
 * reg. 6 requires prior consent for, so init is deferred until consent is
 * granted. Before that point no PostHog code runs, nothing is stored, and no
 * request is made.
 *
 * The SDK is loaded with a dynamic import so it is not in the initial bundle
 * either: a visitor who declines, or has not answered yet, never downloads it.
 * The `import type` above is erased at compile time and pulls in nothing.
 *
 * Concurrent callers share one load — the consent listeners that call this fire
 * in an order React does not guarantee (child effects register before parent
 * ones), so several can race on the same tick.
 */
export function ensurePostHog(): Promise<PostHog | null> {
  if (!isAnalyticsConfigured()) return Promise.resolve(null);
  if (client) return Promise.resolve(client);
  if (loading) return loading;

  loading = import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_TOKEN, {
        // Pulls in the current recommended behaviours, notably
        // capture_pageview: 'history_change' — the App Router navigates client
        // side, so without it only the first page of a visit is ever counted.
        // It also captures the page in view when init runs, so callers must not
        // send their own $pageview on top of this or the visit counts twice.
        defaults: '2026-05-30',
        api_host: `${window.location.origin}${POSTHOG_PROXY_PATH}`,
        ui_host: POSTHOG_UI_HOST,
        // The dashboard renders real customer names, phone numbers and message
        // bodies. Recordings would ship all of that to PostHog, so they stay off
        // until someone deliberately configures masking for those screens.
        disable_session_recording: true,
      });

      // Unhandled errors and promise rejections, from the moment consent is
      // given. React error boundaries swallow render errors before they ever
      // reach window.onerror, so ErrorBoundary reports those explicitly via
      // reportClientError() — autocapture alone would miss exactly the failures that
      // blank out a page.
      //
      // Console errors stay off: they would pull in React's warnings and our
      // own console.error calls, including the one reportClientError makes, which
      // would double-report every error it handles.
      posthog.startExceptionAutocapture({
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      });

      client = posthog;
      return posthog;
    })
    .catch((err) => {
      // A blocked or failed chunk must not take the page down with it.
      console.error('PostHog failed to load:', err);
      loading = null;
      return null;
    });

  return loading;
}

/**
 * The client if it is already loaded, else null. For callers that must not
 * trigger a load — e.g. reacting to a declined consent, where there may be
 * nothing to switch off.
 */
export function getPostHog(): PostHog | null {
  return client;
}
