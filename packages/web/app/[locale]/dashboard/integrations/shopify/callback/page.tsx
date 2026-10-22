'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Card } from '@/components/recete';
import { Spinner } from '@/components/ui/spinner';

function ShopifyCallbackContent() {
  const t = useTranslations('ShopifyCallback');
  const searchParams = useSearchParams();
  const router = useRouter();
  // The backend redirects here with success/error in the query string, so both
  // of these are pure functions of searchParams. They used to be useState that
  // an effect wrote to synchronously, which triggers cascading renders — React
  // recommends deriving instead of storing (react.dev/learn/you-might-not-need-an-effect).
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const messageParam = searchParams.get('message');

  const status: 'success' | 'error' = success === 'true' ? 'success' : 'error';
  const message = success === 'true'
    ? (messageParam || t('successMessage'))
    : error
      ? decodeURIComponent(error)
      : t('invalidCallback');

  // The redirect is the only real side effect left. The timeout is now cleared
  // on unmount; previously it could fire after the user had navigated away.
  useEffect(() => {
    if (status !== 'success') return;

    const timer = setTimeout(() => {
      router.push('/dashboard/integrations');
    }, 2000);

    return () => clearTimeout(timer);
  }, [status, router]);

  return (
    <div className="d-page">
      <div className="d-page-header">
        <h1 className="r-page-title">{t('connecting')}</h1>
      </div>
      <div className="pt-4">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="max-w-md w-full mx-4">
            <Card padding="flush">
              <div className="p-8">
                {status === 'success' && (
                  <div className="text-center">
                    <div className="r-alert r-alert-success text-left" role="status">
                      <CheckCircle2 size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                      <p className="r-alert-body" style={{ margin: 0 }}>{message}</p>
                    </div>
                    <div className="mt-4">
                      <h2 className="r-page-title" style={{ fontSize: 'var(--r-text-2xl)' }}>{t('success')}</h2>
                    </div>
                    <div className="mt-2">
                      <p className="r-hint">{t('redirecting')}</p>
                    </div>
                  </div>
                )}

                {status === 'error' && (
                  <div className="text-center">
                    <div className="r-alert r-alert-error text-left" role="alert">
                      <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                      <p className="r-alert-body" style={{ margin: 0 }}>{message}</p>
                    </div>
                    <div className="mt-4">
                      <h2 className="r-page-title" style={{ fontSize: 'var(--r-text-2xl)' }}>{t('error')}</h2>
                    </div>
                    <div className="mt-4">
                      <Button onClick={() => router.push('/dashboard/integrations')} variant="primary">
                        {t('backToIntegrations')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShopifyCallbackPage() {
  return (
    <Suspense fallback={
      <div className="d-page">
        <div className="d-page-header">
          <h1 className="r-page-title">Connecting</h1>
        </div>
        <div className="pt-4">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="max-w-md w-full mx-4">
              <Card padding="flush">
                <div className="p-8 text-center">
                  <div className="flex justify-center mb-4" role="status">
                    <Spinner size="xl" />
                    <span className="sr-only">Connecting to Shopify</span>
                  </div>
                  <h2 className="r-page-title" style={{ fontSize: 'var(--r-text-2xl)' }}>Connecting</h2>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    }>
      <ShopifyCallbackContent />
    </Suspense>
  );
}
