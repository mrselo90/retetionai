'use client';

import posthog from 'posthog-js';
import {
  POSTHOG_PROXY_PATH,
  POSTHOG_TOKEN,
  POSTHOG_UI_HOST,
  isAnalyticsConfigured,
} from './posthogConfig';

let initialised = false;

/**
 * Initialises PostHog, at most once.
 *
 * Deliberately NOT called on page load. posthog.init() writes a cookie holding
 * a persistent $device_id/distinct_id and fetches remote config immediately —
 * even with opt_out_capturing_by_default, which only suppresses event capture.
 * Storing that identifier before the visitor agrees is exactly what UK PECR
 * reg. 6 requires prior consent for, so init is deferred until consent is
 * granted. Before that point no PostHog code runs, nothing is stored, and no
 * request is made.
 *
 * Idempotent because the consent listeners that call it fire in an order React
 * does not guarantee (child effects register before parent ones).
 */
export function ensurePostHogInitialised(): boolean {
  if (!isAnalyticsConfigured()) return false;
  if (initialised) return true;

  posthog.init(POSTHOG_TOKEN, {
    // Pulls in the current recommended behaviours, notably
    // capture_pageview: 'history_change' — the App Router navigates client
    // side, so without it only the first page of a visit is ever counted.
    defaults: '2026-05-30',
    api_host: `${window.location.origin}${POSTHOG_PROXY_PATH}`,
    ui_host: POSTHOG_UI_HOST,
    // The dashboard renders real customer names, phone numbers and message
    // bodies. Recordings would ship all of that to PostHog, so they stay off
    // until someone deliberately configures masking for those screens.
    disable_session_recording: true,
  });

  initialised = true;
  return true;
}

/** Whether init has run. Lets callers avoid poking an uninitialised client. */
export function isPostHogInitialised(): boolean {
  return initialised;
}
