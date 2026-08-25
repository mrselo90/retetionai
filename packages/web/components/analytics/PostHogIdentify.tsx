'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { supabase } from '@/lib/supabase';
import { CONSENT_CHANGED_EVENT, readConsent } from '@/lib/analytics/consent';
import { ensurePostHogInitialised, isPostHogInitialised } from '@/lib/analytics/posthogClient';

/**
 * Links the anonymous visitor to the signed-in merchant so funnels can run
 * from landing page through to in-product behaviour.
 *
 * The Supabase user id is the distinct_id rather than the email: it is stable
 * if the merchant changes their address, and it keeps the identifier itself
 * non-personal. Email is attached as a person property so the PostHog UI is
 * usable — that is personal data, and it is the one line to delete if you want
 * product analytics with no direct identifiers.
 *
 * Renders nothing.
 */
export default function PostHogIdentify() {
  useEffect(() => {
    let cancelled = false;

    const identifyFromSession = async () => {
      // A visitor who has not consented has no PostHog client at all, and
      // skipping the Supabase round trip keeps them free of side effects.
      if (readConsent() !== 'granted') return;
      // This listener can fire before the provider's (child effects register
      // first), so make sure the client exists rather than assuming it does.
      if (!ensurePostHogInitialised()) return;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session?.user) {
          posthog.identify(session.user.id, { email: session.user.email ?? undefined });
        }
      } catch (err) {
        // Analytics must never break the app; a failed identify just means the
        // events stay anonymous.
        console.error('PostHog identify failed:', err);
      }
    };

    void identifyFromSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || readConsent() !== 'granted' || !isPostHogInitialised()) return;

      if (event === 'SIGNED_OUT') {
        // Without reset() the next visitor on a shared machine would inherit
        // this merchant's distinct_id.
        posthog.reset();
        return;
      }

      if (session?.user) {
        posthog.identify(session.user.id, { email: session.user.email ?? undefined });
      }
    });

    window.addEventListener(CONSENT_CHANGED_EVENT, identifyFromSession);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener(CONSENT_CHANGED_EVENT, identifyFromSession);
    };
  }, []);

  return null;
}
