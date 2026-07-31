'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { useTranslations } from 'next-intl';

export default function AuthCallbackPage() {
  const t = useTranslations('AuthCallback');
  const router = useRouter();

  useEffect(() => {
    // The Supabase client is initialized in lib/supabase.ts
    // It automatically parses the URL for code/token and manages the session
    // We just need to wait for the session to be established and redirect
    const handleAuth = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('Auth callback error:', error);
        router.push('/login?error=' + encodeURIComponent(error.message));
        return;
      }

      if (session) {
        router.push('/dashboard');
      } else {
        // If no session yet, listen for the event (implicit flow or delayed PKCE)
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session) {
            router.push('/dashboard');
          }
        });

        return () => subscription.unsubscribe();
      }
    };

    handleAuth();
  }, [router]);

  return (
    <div
      className="r-app"
      style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          border: '2px solid var(--r-border)',
          borderTopColor: 'var(--r-brand)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p className="r-hint">{t('loggingIn')}</p>
    </div>
  );
}
