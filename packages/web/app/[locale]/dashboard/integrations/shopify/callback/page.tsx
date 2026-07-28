'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Banner, Box, Button, Card, Layout, Page, Spinner, Text } from '@shopify/polaris';
import { useTranslations } from 'next-intl';

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
    <Page title={t('connecting')}>
      <Layout>
        <Layout.Section>
      <Box paddingBlockStart="400">
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="max-w-md w-full mx-4">
          <Card>
            <div className="p-8">
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
                <Text as="h2" variant="headingLg">{t('error')}</Text>
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
      <Page title="Connecting">
        <Layout>
          <Layout.Section>
        <Box paddingBlockStart="400">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="max-w-md w-full mx-4">
              <Card>
                <div className="p-8 text-center">
                  <div className="flex justify-center mb-4">
                    <Spinner accessibilityLabel="Connecting to Shopify" size="large" />
                  </div>
                  <Text as="h2" variant="headingLg">Connecting</Text>
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
