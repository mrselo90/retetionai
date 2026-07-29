'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { isSessionExpired } from '@/lib/sessionExpiry';

export interface UseDashboardAuthResult {
  userEmail: string | null;
  loading: boolean;
}

/**
 * Handles standalone dashboard auth via Supabase only.
 * Redirects to /login when unauthenticated. Keeps layout logic thin and testable.
 *
 * Deliberately has no local expiry timer. There used to be a setTimeout firing at
 * token expiry + 250ms that called signOut({scope:'local'}) and pushed to /login.
 * Supabase already has autoRefreshToken enabled, but it pauses auto-refresh while
 * the tab is hidden and resumes on focus — so if the timer fired before the
 * resumed refresh landed, or a single refresh request failed on a flaky network,
 * the app destroyed a still-valid session and dumped the merchant at /login. That
 * is the classic "it logs me out whenever I come back to the tab" bug, and it was
 * self-inflicted: Supabase would have recovered on its own.
 *
 * The remaining guards are enough: an already-expired stored session is caught at
 * mount and on every auth state change, SIGNED_OUT is handled, and a genuinely
 * dead token surfaces as a 401 from the API, which the pages redirect on.
 */
export function useDashboardAuth(): UseDashboardAuthResult {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const closeAuthForExpiredToken = async () => {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (err) {
        console.error('Session expiry sign out failed:', err);
      }
      if (!cancelled) {
        router.push('/login');
      }
    };

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          if (isSessionExpired(session)) {
            await closeAuthForExpiredToken();
            return;
          }
          setUserEmail(session.user.email ?? null);
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Auth check error:', err);
        if (!cancelled) router.push('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      if (event === 'SIGNED_OUT') {
        setUserEmail(null);
        router.push('/login');
        return;
      }

      if (!session?.user) return;

      if (isSessionExpired(session)) {
        void closeAuthForExpiredToken();
        return;
      }

      setUserEmail(session.user.email ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  return { userEmail, loading };
}
