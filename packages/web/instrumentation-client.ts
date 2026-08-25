/**
 * Client-side instrumentation (Next.js 15.3+). Runs once, before application
 * code — which is why PostHog is started here for returning visitors who have
 * already consented, rather than in a provider effect: React runs child effects
 * before parent effects, so a provider-based init would race with children that
 * call posthog.* on mount.
 *
 * Visitors who have not consented (or declined) get nothing: no init, no
 * cookie, no request. See lib/analytics/posthogClient.ts.
 */

import { ensurePostHogInitialised } from '@/lib/analytics/posthogClient';
import { readConsent } from '@/lib/analytics/consent';

if (readConsent() === 'granted') {
  ensurePostHogInitialised();
}
