'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { Link } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function SignupPage() {
  const t = useTranslations('Signup');
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      // localePrefix: 'never' — no locale in URL, auth/callback is at root level
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`;
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

    // Validation
    if (password !== confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('errors.passwordLength'));
      return;
    }

    setLoading(true);

    try {
      // Sign up via backend API (creates both auth user and merchant record)
      const response = await apiRequest<{
        message: string;
        merchant: { id: string; name: string };
        requiresEmailConfirmation?: boolean;
      }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      });

      // Check if email confirmation is required
      if (response.requiresEmailConfirmation) {
        setError(null);
        // Show success message with email confirmation instructions
        setSuccessMessage(t('successMessage', { email }));
        return;
      }

      // Sign in to get session
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      router.push('/dashboard');
    } catch (err: any) {
      console.error('Signup error:', err);
      // Extract error message from API response
      const errorMessage = err?.message || err?.error || t('errors.default');
      const errorDetails = err?.details || '';
      const errorHint = err?.hint || '';

      // Show detailed error message
      let displayError = errorMessage;
      if (errorDetails && errorDetails !== errorMessage) {
        displayError += `: ${errorDetails}`;
      }
      if (errorHint) {
        displayError += ` (${errorHint})`;
      }

      setError(displayError);
      setSuccessMessage(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-8">
        <Card className="w-full max-w-md animate-fade-in shadow-lg border-muted/60">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">{t('title')}</CardTitle>
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

            {successMessage && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-start gap-2 text-sm text-green-800 animate-accordion-down">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">{t('successTitle')}</p>
                  <p className="mt-1">{successMessage}</p>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-green-800 underline mt-2"
                    onClick={async () => {
                      try {
                        const { error: resendError } = await supabase.auth.resend({
                          type: 'signup',
                          email: email,
                        });
                        if (resendError) {
                          setError(resendError.message);
                        } else {
                          setSuccessMessage(t('errors.resendSuccess') || 'Confirmation email resent!');
                        }
                      } catch (err) {
                        setError('Failed to resend email');
                      }
                    }}
                  >
                    resend confirmation email
                  </Button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-field">
                <label htmlFor="name" className="form-label">{t('businessName')}</label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={t('businessName')}
                  className="w-full"
                />
              </div>

              <div className="form-field">
                <label htmlFor="email" className="form-label">{t('email')}</label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full"
                />
              </div>

              <div className="form-field">
                <label htmlFor="password" className="form-label">{t('password')}</label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full"
                />
                <p className="form-helper">{t('passwordMinLength')}</p>
              </div>

              <div className="form-field">
                <label htmlFor="confirmPassword" className="form-label">{t('confirmPassword')}</label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? t('submitting') : t('submit')}
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
              className="w-full"
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
              {googleLoading ? t('googleRedirecting') : t('googleSignup')}
            </Button>
          </CardContent>
          <CardFooter className="flex justify-center flex-col gap-4">
            <p className="text-sm text-center text-muted-foreground">
              {t('alreadyHaveAccount')}{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t('login')}
              </Link>
            </p>
            <p className="text-center">
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
                {t('backToHome')}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
