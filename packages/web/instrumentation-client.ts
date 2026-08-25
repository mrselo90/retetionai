/**
 * Client-side instrumentation (Next.js 15.3+). Runs once, before application
 * code — which is why PostHog is started here for returning visitors who have
 * already consented, rather than in a provider effect: React runs child effects
 * before parent effects, so a provider-based start would race with children
 * that reach for the client on mount.
 *
 * Visitors who have not consented (or declined) get nothing: the SDK is not
 * even downloaded. See lib/analytics/posthogClient.ts.
 */

import { ensurePostHog } from '@/lib/analytics/posthogClient';
import { readConsent } from '@/lib/analytics/consent';

if (readConsent() === 'granted') {
  // Fire and forget: the SDK loads in the background and captures the current
  // page itself once initialised.
  void ensurePostHog();
}
