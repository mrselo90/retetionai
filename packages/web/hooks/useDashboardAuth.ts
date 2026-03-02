'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { isShopifyEmbedded, getShopifySessionToken, getShopifyShop } from '@/lib/shopifyEmbedded';
import { getSessionExpiryMs, isSessionExpired } from '@/lib/sessionExpiry';

export interface UseDashboardAuthResult {
  userEmail: string | null;
  loading: boolean;
  embedded: boolean;
}

/**
 * Handles dashboard auth: embedded (Shopify token exchange) or standalone (Supabase session).
 * Redirects to /login when unauthenticated. Keeps layout logic thin and testable.
 */
export function useDashboardAuth(): UseDashboardAuthResult {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [embedded, setEmbedded] = useState(false);
  const expiryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const embeddedMode = isShopifyEmbedded();
    setEmbedded(embeddedMode);

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
      if (embeddedMode) {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (user) {
          setUserEmail(user.email ?? null);
          setLoading(false);
          return;
        }
        try {
          const sessionToken = await getShopifySessionToken();
          const shop = getShopifyShop();
          if (!sessionToken || !shop) {
            router.push('/login');
            return;
          }
          const res = await fetch('/api/integrations/shopify/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: sessionToken, shop }),
          });
          const data = await res.json();
          if (cancelled) return;
          if (data.auth_url) {
            window.location.href = data.auth_url;
            return;
          }
          setLoading(false);
        } catch (err) {
          console.error('Shopify Token Exchange failed:', err);
          if (!cancelled) router.push('/login');
        }
        return;
      }

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
      if (cancelled || embeddedMode) return;

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

  return { userEmail, loading, embedded };
}
