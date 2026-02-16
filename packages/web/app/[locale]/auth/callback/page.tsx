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
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Auth callback error:', error);
        router.push('/login?error=' + encodeURIComponent(error.message));
        return;
      }

      if (session) {
        router.push('/dashboard');
      } else {
        // If no session yet, listen for the event (implicit flow or delayed PKCE)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
        <p className="text-zinc-600">{t('loggingIn')}</p>
      </div>
    </div>
  );
}
