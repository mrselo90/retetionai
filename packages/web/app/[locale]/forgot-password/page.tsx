'use client';

import { useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/ui/logo';

export default function ForgotPasswordPage() {
  const t = useTranslations('ForgotPassword');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      // Get current locale from pathname
      const locale = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] || 'en' : 'en';

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/${locale}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md animate-fade-in shadow-2xl border-2 relative z-10 overflow-hidden">
          {/* Card Header Gradient */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary via-primary/80 to-primary"></div>

          <CardHeader className="text-center pt-8 pb-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-extrabold tracking-tight">{t('successTitle')}</CardTitle>
            <CardDescription className="text-base font-medium">
              {t('successMessage', { email })}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full h-11">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('backToLogin')}
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md animate-fade-in shadow-2xl border-2 relative z-10 overflow-hidden">
        {/* Card Header Gradient */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary via-primary/80 to-primary"></div>

        <CardHeader className="text-center pt-8 pb-6">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo iconOnly className="w-16 h-16 drop-shadow-md" />
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight">{t('title')}</CardTitle>
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
              <label htmlFor="email" className="text-sm font-medium leading-none">
                {t('emailLabel')}
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? t('submitting') : t('submitButton')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/login" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            {t('backToLogin')}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
