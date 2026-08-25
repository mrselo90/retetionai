'use client';

import { clearConsent, writeConsent } from '@/lib/analytics/consent';
import { useConsent } from '@/lib/analytics/useConsent';
import { isAnalyticsConfigured } from '@/lib/analytics/posthogConfig';

/**
 * Lets a visitor see and change their analytics-cookie choice from the cookie
 * policy page. GDPR art. 7(3) requires withdrawing consent to be as easy as
 * giving it, so this has to exist somewhere permanent — the banner disappears
 * once answered.
 */
export function CookiePreferencesButton() {
  const consent = useConsent();

  // `undefined` is the pre-hydration state, where the stored choice is not
  // readable yet — rendering then would show the wrong state for a frame.
  if (consent === undefined || !isAnalyticsConfigured()) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <span className="text-sm text-zinc-700">
        {consent === 'granted'
          ? 'Analytics cookies: allowed.'
          : consent === 'denied'
            ? 'Analytics cookies: declined.'
            : 'Analytics cookies: no choice made yet.'}
      </span>
      {consent === 'granted' ? (
        <button
          type="button"
          onClick={() => writeConsent('denied')}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          Withdraw consent
        </button>
      ) : (
        <button
          type="button"
          onClick={() => writeConsent('granted')}
          className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          Allow analytics cookies
        </button>
      )}
      {consent !== null && (
        <button
          type="button"
          onClick={clearConsent}
          className="text-sm text-zinc-500 underline hover:text-zinc-700"
        >
          Ask me again
        </button>
      )}
    </div>
  );
}
