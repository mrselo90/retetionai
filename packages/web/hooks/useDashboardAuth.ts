'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { isShopifyEmbedded, getShopifySessionToken, getShopifyShop } from '@/lib/shopifyEmbedded';

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

  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      const shopifyEmbedded = isShopifyEmbedded();
      setEmbedded(shopifyEmbedded);

      if (shopifyEmbedded) {
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
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (user) {
          setUserEmail(user.email ?? null);
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
    return () => { cancelled = true; };
  }, [router]);

  return { userEmail, loading, embedded };
}
