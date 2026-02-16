'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing'; // Updated import
import Link from 'next/link'; // Wait, should be from '@/i18n/routing' but let's check validation
import { Link as I18nLink } from '@/i18n/routing';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
  const t = useTranslations('Login');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | React.ReactNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      // Get current locale from pathname
      const locale = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] || 'en' : 'en';
      
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/${locale}/auth/callback`
          : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/en/auth/callback`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (oauthError) {
        const msg = oauthError.message ?? '';
        if (msg.includes('provider is not enabled') || msg.includes('Unsupported provider')) {
          setError(t('errors.googleDisabled'));
        } else {
          setError(oauthError.message);
        }
      }
      // Redirect happens via OAuth flow; no need to push here
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('provider is not enabled') || msg.includes('Unsupported provider')) {
        setError(t('errors.googleDisabled'));
      } else {
        setError(msg || t('errors.default'));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('Login error:', authError);

        // Handle email confirmation error (message can be "Email not confirmed" or similar)
        const msg = (authError.message ?? '').toLowerCase();
        const isEmailNotConfirmed =
          msg.includes('email not confirmed') ||
          msg.includes('email_not_confirmed') ||
          msg.includes('not confirmed');

        if (isEmailNotConfirmed) {
          setError(
            <span>
              {t('errors.emailNotConfirmed')}{' '}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { error: resendError } = await supabase.auth.resend({
                      type: 'signup',
                      email: email,
                    });
                    if (resendError) {
                      setError(resendError.message);
                    } else {
                      setError(t('errors.resendSuccess'));
                    }
                  } catch (err) {
                    setError(t('errors.resendError'));
                  }
                }}
                className="underline hover:no-underline font-medium"
              >
                {t('errors.resendVerification')}
              </button>
            </span>
          );
          return;
        }

        setError(authError.message || t('errors.invalidCredentials'));
        return;
      }

      if (data.session) {
        router.push('/dashboard');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Handle email not confirmed when error is thrown instead of returned
      if (message.toLowerCase().includes('email not confirmed') || message.toLowerCase().includes('not confirmed')) {
        setError(
          <span>
            {t('errors.emailNotConfirmed')}{' '}
            <button
              type="button"
              onClick={async () => {
                try {
                  const { error: resendError } = await supabase.auth.resend({
                    type: 'signup',
                    email: email,
                  });
                  if (resendError) {
                    setError(resendError.message);
                  } else {
                    setError(t('errors.resendSuccess'));
                  }
                } catch (e) {
                  setError(t('errors.resendError'));
                }
              }}
              className="underline hover:no-underline font-medium"
            >
              {t('errors.resendVerification')}
            </button>
          </span>
        );
      } else {
        setError(message || t('errors.default'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md animate-fade-in shadow-lg border-muted/60">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            {t('title')}
          </CardTitle>
          <CardDescription>
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2 text-sm text-destructive animate-accordion-down">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t('emailLabel')}
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t('emailPlaceholder')}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {t('passwordLabel')}
                </label>
                <I18nLink href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                  {t('forgotPassword')}
                </I18nLink>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-base"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? t('submitting') : t('submitButton')}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t('or')}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full h-11"
          >
            {googleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {googleLoading ? t('googleRedirecting') : t('googleLogin')}
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            {t('noAccount')}{' '}
            <I18nLink href="/signup" className="font-medium text-primary hover:underline">
              {t('register')}
            </I18nLink>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
