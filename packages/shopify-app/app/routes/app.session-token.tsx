import type { ActionFunctionArgs } from "react-router";
import { Banner, Page, Layout, Text, BlockStack } from "@shopify/polaris";

import { requireSessionTokenAuthorization } from "../lib/sessionToken.server";
import { fetchMerchantSettings } from "../platform.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  // Data route: rely on the embedded bearer token and let the platform API
  // perform the single source of truth verification.
  requireSessionTokenAuthorization(request);
  try {
    const merchantSettings = await fetchMerchantSettings(request);

    return Response.json(
      {
        ok: true,
        auth: "shopify-session-token",
        merchantId: merchantSettings.merchant.id,
      },
      { status: 200 },
    );
  } catch (error) {
    // During fresh installs there can be a short race where the Shopify shell
    // has a valid embedded token but merchant bootstrap in the platform API
    // is still converging. Treat this as temporary pending, not hard failure.
    if (error instanceof Response && (error.status === 403 || error.status === 404)) {
      return Response.json(
        {
          ok: true,
          pending: true,
          auth: "shopify-session-token-pending",
          reason: "merchant_bootstrap_pending",
        },
        { status: 202 },
      );
    }
    throw error;
  }
};

export default function AppSessionTokenRoute() {
  return (
    <Page title="Session Token">
      <Layout>
        <Layout.Section>
          <Banner title="Session token endpoint" tone="info">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                This page validates your Shopify session. If you arrived here directly, return to the app dashboard.
              </Text>
            </BlockStack>
          </Banner>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
