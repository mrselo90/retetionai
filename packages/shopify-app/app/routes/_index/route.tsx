import type { LoaderFunctionArgs } from 'react-router';
import { redirect, useLoaderData } from 'react-router';
import { AppProvider } from '@shopify/shopify-app-react-router/react';
import {
  AppProvider as PolarisAppProvider,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Page,
  Text,
} from '@shopify/polaris';
import enPolarisTranslations from '@shopify/polaris/locales/en.json';

const APP_STORE_URL = 'https://apps.shopify.com/recete';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Opened by Shopify (install, admin link): hand over to the embedded app.
  if (url.searchParams.get('shop')) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  const appHandle = process.env.SHOPIFY_MANAGED_PRICING_APP_HANDLE?.trim() || 'blackeagle';
  return { adminAppUrl: `https://admin.shopify.com/apps/${appHandle}` };
};

/**
 * What someone sees at shop.recete.co.uk outside the Shopify admin. There is
 * deliberately no "enter your shop domain" field: App Store rules require the
 * install to start from Shopify, never from a typed myshopify.com address.
 */
export default function Index() {
  const { adminAppUrl } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded={false}>
      <PolarisAppProvider i18n={enPolarisTranslations}>
        <Page narrowWidth title="Recete for Shopify">
          <BlockStack gap="400">
            <Card padding="500">
              <BlockStack gap="400">
                <Text as="p" variant="bodyMd">
                  Recete sends your customers helpful WhatsApp messages after their order is
                  delivered and answers their questions about your products.
                </Text>
                <InlineStack gap="300" wrap>
                  <Button variant="primary" url={APP_STORE_URL} target="_blank">
                    Install from the Shopify App Store
                  </Button>
                  <Button url={adminAppUrl} target="_top">
                    Already installed? Open in Shopify admin
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
            <Card padding="500">
              <BlockStack gap="200">
                <Text as="h2" variant="headingSm">
                  Not on Shopify?
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Recete also works without Shopify.
                </Text>
                <InlineStack>
                  <Button variant="plain" url="https://recete.co.uk">
                    Go to recete.co.uk
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Page>
      </PolarisAppProvider>
    </AppProvider>
  );
}
