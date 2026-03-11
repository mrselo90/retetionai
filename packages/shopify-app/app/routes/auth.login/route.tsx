import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import {
  AppProvider as PolarisAppProvider,
  BlockStack,
  Button,
  Card,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import enPolarisTranslations from "@shopify/polaris/locales/en.json";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method.toUpperCase() === "HEAD") {
    return { errors: {} };
  }
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

  return (
    <AppProvider embedded={false}>
      <PolarisAppProvider i18n={enPolarisTranslations}>
        <Page
          title="Connect your Shopify store"
          subtitle="Enter your myshopify domain to start the official embedded install flow."
        >
          <Form method="post">
            <Card padding="500">
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">
                    Log in
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Use the merchant shop domain, for example `example.myshopify.com`.
                  </Text>
                </BlockStack>
                <TextField
                  name="shop"
                  label="Shop domain"
                  helpText="example.myshopify.com"
                  value={shop}
                  onChange={setShop}
                  autoComplete="on"
                  error={errors.shop}
                />
                <Button submit variant="primary">
                  Log in
                </Button>
              </BlockStack>
            </Card>
          </Form>
        </Page>
      </PolarisAppProvider>
    </AppProvider>
  );
}
