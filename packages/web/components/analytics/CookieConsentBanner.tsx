'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { writeConsent } from '@/lib/analytics/consent';
import { useConsent } from '@/lib/analytics/useConsent';
import { isAnalyticsConfigured } from '@/lib/analytics/posthogConfig';

/**
 * Asks for analytics-cookie consent before anything is captured.
 *
 * Accept and decline are given equal visual weight — under GDPR art. 7(3) /
 * EDPB guidance, consent is not freely given if refusing takes more effort
 * than accepting, so there is no styling that nudges toward accept and no
 * close button that leaves the question unanswered.
 */
export default function CookieConsentBanner() {
  const t = useTranslations('CookieConsent');
  const consent = useConsent();

  // Only `null` means "asked, not answered". `undefined` is the pre-hydration
  // state, where showing the banner would flash it at people who already chose.
  // And there is nothing to consent to when analytics is not configured.
  if (!isAnalyticsConfigured() || consent !== null) return null;

  const decide = (choice: 'granted' | 'denied') => writeConsent(choice);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t('ariaLabel')}
      className="fixed bottom-0 left-0 right-0 z-[60] border-t border-zinc-200 bg-white/95 px-4 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-zinc-700">
          {t('message')}{' '}
          <Link
            href="/cookie-policy"
            className="font-medium text-blue-600 underline hover:text-blue-700"
          >
            {t('policyLink')}
          </Link>
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => decide('denied')}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 sm:flex-none"
          >
            {t('decline')}
          </button>
          <button
            type="button"
            onClick={() => decide('granted')}
            className="flex-1 rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400 sm:flex-none"
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
