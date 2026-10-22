import { AppProvider } from "@shopify/shopify-app-react-router/react";
import type { LoaderFunctionArgs } from "react-router";
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
      <s-page heading="Install Recete">
        <s-section heading="Get started with Recete">
          <s-stack gap="base">
            <s-paragraph color="subdued">
              Recete must be installed directly from the Shopify App Store. Please visit the
              listing and click <strong>Install</strong> to connect your store.
            </s-paragraph>
            <s-stack direction="inline">
              <s-button variant="primary" href="https://apps.shopify.com/recete" target="_blank">
                Go to Shopify App Store
              </s-button>
            </s-stack>
          </s-stack>
        </s-section>
      </s-page>
    </AppProvider>
  );
}
