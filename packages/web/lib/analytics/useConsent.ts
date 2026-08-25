'use client';

import { useSyncExternalStore } from 'react';
import { readConsent, subscribeConsent, type AnalyticsConsent } from './consent';

/**
 * Reads the stored analytics-consent choice and re-renders when it changes.
 *
 * `undefined` means "not known yet" — it is what the server render and the
 * hydration pass see, since localStorage is not readable there. Callers must
 * treat it as distinct from `null` ("visitor has made no choice"), otherwise
 * the consent banner flashes on every page load for people who already
 * answered it.
 *
 * useSyncExternalStore rather than useState + useEffect so the value is read
 * during render instead of being written back in an effect, which would
 * trigger a second render pass on every mount.
 */
export function useConsent(): AnalyticsConsent | null | undefined {
  return useSyncExternalStore(
    subscribeConsent,
    readConsent,
    () => undefined // server / hydration snapshot
  );
}
