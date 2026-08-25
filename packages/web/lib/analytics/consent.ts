/**
 * Cookie consent state for analytics.
 *
 * recete.co.uk serves UK/EU visitors, so analytics cookies need prior consent
 * (UK PECR reg. 6 / GDPR art. 6). PostHog is therefore initialised with
 * `opt_out_capturing_by_default: true` and only starts capturing once the
 * visitor accepts here — see components/analytics/PostHogProvider.tsx.
 *
 * The choice lives in localStorage rather than a cookie so that declining
 * analytics does not itself write a cookie.
 */

export type AnalyticsConsent = 'granted' | 'denied';

const STORAGE_KEY = 'recete.analytics-consent';

/** Fired on `window` whenever the stored choice changes, so mounted components can react. */
export const CONSENT_CHANGED_EVENT = 'recete:analytics-consent-changed';

/**
 * Returns the stored choice, or null when the visitor has not decided yet
 * (which is when the banner should be shown).
 */
export function readConsent(): AnalyticsConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : null;
  } catch {
    // Safari private mode and hardened browsers throw on localStorage access.
    // Treat that as "no decision" — the banner reappears, nothing is captured.
    return null;
  }
}

export function writeConsent(consent: AnalyticsConsent): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, consent);
  } catch {
    // Non-fatal: the event below still applies the choice for this page view.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: consent }));
}

/**
 * Subscribes to consent changes. Shaped for useSyncExternalStore — see
 * useConsent.ts.
 */
export function subscribeConsent(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CONSENT_CHANGED_EVENT, listener);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, listener);
}

/**
 * Clears the stored choice so the banner is shown again. Exported for the
 * "change your cookie choice" link on the cookie policy page.
 */
export function clearConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: null }));
}
