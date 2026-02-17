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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-primary/5 px-4 py-12 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxNGI4YTYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bS0yIDJ2LTJoLTJ2Mmgyem0tNCAydi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bTI4IDMydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptLTIgMnYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50"></div>
      
      <Card className="w-full max-w-md animate-scale-in shadow-2xl border-2 relative z-10 overflow-hidden">
        {/* Card Header Gradient */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary via-primary/80 to-primary"></div>
        
        <CardHeader className="space-y-2 text-center pt-8 pb-6">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-lg">
            <span className="text-3xl font-extrabold">G</span>
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight">
            {t('title')}
          </CardTitle>
          <CardDescription className="text-base font-medium">
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-8 pb-8">
          {error && (
            <div className="p-4 bg-destructive/10 border-2 border-destructive/30 rounded-xl flex items-start gap-3 text-sm text-destructive animate-slide-down shadow-sm">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2.5">
              <label htmlFor="email" className="text-sm font-bold leading-none text-foreground">
                {t('emailLabel')}
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t('emailPlaceholder')}
                className="h-12"
              />
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-bold leading-none text-foreground">
                  {t('passwordLabel')}
                </label>
                <I18nLink href="/forgot-password" className="text-sm font-bold text-primary hover:text-primary/80 transition-colors">
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
                className="h-12"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-bold shadow-lg hover:shadow-xl"
              size="lg"
            >
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {loading ? t('submitting') : t('submitButton')}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t-2 border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground font-bold">
                {t('or')}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full h-12 border-2 font-bold hover:border-primary/30 hover:shadow-md"
            size="lg"
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
        <CardFooter className="flex justify-center pb-8 px-8">
          <p className="text-sm text-muted-foreground font-medium">
            {t('noAccount')}{' '}
            <I18nLink href="/signup" className="font-bold text-primary hover:text-primary/80 transition-colors">
              {t('register')}
            </I18nLink>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
