'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { getSessionExpiryMs, isSessionExpired } from '@/lib/sessionExpiry';

export interface UseDashboardAuthResult {
  userEmail: string | null;
  loading: boolean;
}

/**
 * Handles standalone dashboard auth via Supabase only.
 * Redirects to /login when unauthenticated. Keeps layout logic thin and testable.
 */
export function useDashboardAuth(): UseDashboardAuthResult {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const expiryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const clearExpiryTimeout = () => {
      if (expiryTimeoutRef.current) {
        clearTimeout(expiryTimeoutRef.current);
        expiryTimeoutRef.current = null;
      }
    };

    const closeAuthForExpiredToken = async () => {
      clearExpiryTimeout();
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (err) {
        console.error('Session expiry sign out failed:', err);
      }
      if (!cancelled) {
        router.push('/login');
      }
    };

    const scheduleExpiryClose = (expiresAt?: number | null) => {
      clearExpiryTimeout();
      if (!expiresAt) return;
      const msUntilExpiry = getSessionExpiryMs({ expires_at: expiresAt });
      if (msUntilExpiry === null) return;
      if (msUntilExpiry <= 0) {
        void closeAuthForExpiredToken();
        return;
      }
      expiryTimeoutRef.current = setTimeout(() => {
        void closeAuthForExpiredToken();
      }, msUntilExpiry + 250);
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
          scheduleExpiryClose(session.expires_at);
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

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      if (event === 'SIGNED_OUT') {
        clearExpiryTimeout();
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
      scheduleExpiryClose(session.expires_at);
    });

    return () => {
      cancelled = true;
      clearExpiryTimeout();
      subscription.unsubscribe();
    };
  }, [router]);

  return { userEmail, loading };
}
