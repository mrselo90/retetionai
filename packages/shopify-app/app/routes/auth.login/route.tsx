import { AppProvider } from "@shopify/shopify-app-react-router/react";
import type { LoaderFunctionArgs } from "react-router";
import {
  AppProvider as PolarisAppProvider,
  BlockStack,
  Button,
  Card,
  Page,
  Text,
} from "@shopify/polaris";
import enPolarisTranslations from "@shopify/polaris/locales/en.json";

import { login } from "../../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method.toUpperCase() === "HEAD") {
    return {};
  }
  await login(request);
  return {};
};

export default function Auth() {
  return (
    <AppProvider embedded={false}>
      <PolarisAppProvider i18n={enPolarisTranslations}>
        <Page title="Install Recete">
          <Card padding="500">
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Get started with Recete
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Recete must be installed directly from the Shopify App Store. Please visit the
                listing and click <strong>Install</strong> to connect your store.
              </Text>
              <Button
                variant="primary"
                url="https://apps.shopify.com/recete"
                target="_blank"
              >
                Go to Shopify App Store
              </Button>
            </BlockStack>
          </Card>
        </Page>
      </PolarisAppProvider>
    </AppProvider>
  );
}
