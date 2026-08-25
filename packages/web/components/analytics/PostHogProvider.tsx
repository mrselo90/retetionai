'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { isAnalyticsConfigured } from '@/lib/analytics/posthogConfig';
import { ensurePostHogInitialised, isPostHogInitialised } from '@/lib/analytics/posthogClient';
import { CONSENT_CHANGED_EVENT, readConsent } from '@/lib/analytics/consent';
import PostHogIdentify from './PostHogIdentify';

/**
 * Starts and stops PostHog in step with the visitor's consent choice, and makes
 * the client available to the tree.
 *
 * Nothing runs until consent is granted — see lib/analytics/posthogClient.ts
 * for why init itself is the thing being gated.
 */
export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isAnalyticsConfigured()) return;

    const applyConsent = () => {
      if (readConsent() === 'granted') {
        // First grant of the session: this is where PostHog actually starts.
        ensurePostHogInitialised();
        posthog.opt_in_capturing();
        // init() alone does not send a pageview for the page already on screen,
        // so without this the visit that produced the consent is uncounted.
        posthog.capture('$pageview');
        return;
      }

      // Never initialised, so there is nothing to opt out of or clear.
      if (!isPostHogInitialised()) return;

      posthog.opt_out_capturing();
      // Drops the stored distinct_id and the analytics cookie, so withdrawing
      // consent removes what was placed on the device rather than just muting it.
      posthog.reset();
    };

    window.addEventListener(CONSENT_CHANGED_EVENT, applyConsent);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, applyConsent);
  }, []);

  if (!isAnalyticsConfigured()) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
