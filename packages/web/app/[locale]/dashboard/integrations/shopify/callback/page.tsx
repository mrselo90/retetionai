'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Banner, Box, Button, Card, Layout, Page, Spinner, Text } from '@shopify/polaris';
import { useTranslations } from 'next-intl';

function ShopifyCallbackContent() {
  const t = useTranslations('ShopifyCallback');
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const handleCallback = () => {
    // Check URL parameters (backend redirects here with success/error)
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const message = searchParams.get('message');

    if (success === 'true') {
      setStatus('success');
      setMessage(message || t('successMessage'));
      
      // Redirect to integrations page after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/integrations');
      }, 2000);
    } else if (error) {
      setStatus('error');
      setMessage(decodeURIComponent(error));
    } else {
      // No parameters - might be direct access
      setStatus('error');
      setMessage(t('invalidCallback'));
    }
  };

  useEffect(() => {
    handleCallback();
  }, [searchParams, router, t]);

  return (
    <Page title={t('connecting')}>
      <Layout>
        <Layout.Section>
      <Box paddingBlockStart="400">
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="max-w-md w-full mx-4">
          <Card>
            <div className="p-8">
          {status === 'loading' && (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Spinner accessibilityLabel={t('connecting')} size="large" />
              </div>
              <Text as="h2" variant="headingLg">{t('connecting')}</Text>
              <div className="mt-2">
                <Text as="p" tone="subdued">{t('pleaseWait')}</Text>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <Banner tone="success">
                <p>{message}</p>
              </Banner>
              <div className="mt-4">
                <Text as="h2" variant="headingLg">{t('success')}</Text>
              </div>
              <div className="mt-2">
                <Text as="p" tone="subdued">{t('redirecting')}</Text>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <Banner tone="critical">
                <p>{message}</p>
              </Banner>
              <div className="mt-4">
                <Text as="h2" variant="headingLg">Hata</Text>
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
      </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default function ShopifyCallbackPage() {
  return (
    <Suspense fallback={
      <Page title="Loading...">
        <Layout>
          <Layout.Section>
        <Box paddingBlockStart="400">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="max-w-md w-full mx-4">
              <Card>
                <div className="p-8 text-center">
                  <div className="flex justify-center mb-4">
                    <Spinner accessibilityLabel="Loading" size="large" />
                  </div>
                  <Text as="h2" variant="headingLg">Loading...</Text>
                </div>
              </Card>
            </div>
          </div>
        </Box>
          </Layout.Section>
        </Layout>
      </Page>
    }>
      <ShopifyCallbackContent />
    </Suspense>
  );
}
