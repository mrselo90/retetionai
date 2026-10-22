import type { LoaderFunctionArgs } from "react-router";
import { login } from "../../shopify.server";
import { POLARIS_URL } from "../../lib/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method.toUpperCase() === "HEAD") {
    return {};
  }
  await login(request);
  return {};
};

export default function Auth() {
  return (
    <>
      {/* Outside the admin there is no AppProvider (it is embedded-only since
          shopify-app-react-router 2), so load Polaris here, as Shopify's template does. */}
      <script src={POLARIS_URL} />
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
    </>
  );
}
