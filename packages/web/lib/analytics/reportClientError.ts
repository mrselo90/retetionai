/**
 * Single entry point for reporting a client-side error.
 *
 * Named reportClientError, not reportError, because `window.reportError` is a
 * real DOM global with different semantics — the same name would mean that
 * dropping the import silently falls through to that instead of failing to
 * compile.
 *
 * Deliberately not marked 'use client' and it imports nothing at module scope:
 * lib/api.ts calls this and also runs during SSR, so a static import of the
 * PostHog client would drag the SDK into the server bundle and undo the lazy
 * load in posthogClient.ts.
 *
 * Uses getPostHog(), never ensurePostHog(): reporting an error must not be the
 * thing that starts analytics for a visitor who declined or has not answered
 * the consent banner. Their errors go to the console only, which is the correct
 * trade — we cannot ship diagnostics from someone who said no.
 */
export function reportClientError(error: unknown, context?: Record<string, unknown>): void {
  // Always log. next.config.mjs keeps console.error in production builds, so
  // this stays useful even when nothing is being sent anywhere.
  console.error('[error]', error, context ?? {});

  if (typeof window === 'undefined') return;

  void import('./posthogClient')
    .then(({ getPostHog }) => {
      getPostHog()?.captureException(error, context);
    })
    .catch(() => {
      // Reporting must never be the reason a page breaks.
    });
}
