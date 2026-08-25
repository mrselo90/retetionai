'use client';

import { useEffect } from 'react';
import { isAnalyticsConfigured } from '@/lib/analytics/posthogConfig';
import { ensurePostHog, getPostHog } from '@/lib/analytics/posthogClient';
import { CONSENT_CHANGED_EVENT, readConsent } from '@/lib/analytics/consent';
import PostHogIdentify from './PostHogIdentify';

/**
 * Starts and stops PostHog in step with the visitor's consent choice.
 *
 * There is no posthog-js/react context provider here on purpose: nothing in the
 * app uses usePostHog(), and importing the React wrapper would pull the SDK
 * into the initial bundle, which is exactly what the dynamic load in
 * lib/analytics/posthogClient.ts avoids. Components that need the client call
 * ensurePostHog()/getPostHog() directly.
 */
export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isAnalyticsConfigured()) return;

    const applyConsent = () => {
      if (readConsent() === 'granted') {
        const existing = getPostHog();

        if (!existing) {
          // First grant of the session: this is where the SDK is fetched and
          // started. init() captures the page in view itself, so no manual
          // $pageview here — sending one would double-count the visit.
          void ensurePostHog();
          return;
        }

        // Consent was withdrawn and given again. opt_out_capturing() stores a
        // persistent preference that survives reset(), so the already-loaded
        // client stays mute unless it is explicitly opted back in.
        if (existing.has_opted_out_capturing()) {
          existing.opt_in_capturing();
        }
        return;
      }

      // Never loaded, so there is nothing to opt out of or clear.
      const posthog = getPostHog();
      if (!posthog) return;

      posthog.opt_out_capturing();
      // Drops the stored distinct_id and the analytics cookie, so withdrawing
      // consent removes what was placed on the device rather than just muting it.
      posthog.reset();
    };

    window.addEventListener(CONSENT_CHANGED_EVENT, applyConsent);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, applyConsent);
  }, []);

  return (
    <>
      {isAnalyticsConfigured() && <PostHogIdentify />}
      {children}
    </>
  );
}
