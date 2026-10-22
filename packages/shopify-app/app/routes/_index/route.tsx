import type { LoaderFunctionArgs } from 'react-router';
import { redirect, useLoaderData } from 'react-router';
import { POLARIS_URL } from '../../lib/polaris';

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
    <>
      {/* No AppProvider outside the admin (embedded-only since
          shopify-app-react-router 2): load Polaris here. */}
      <script src={POLARIS_URL} />
      <s-page heading="Recete for Shopify" inlineSize="small">
        <s-stack gap="base">
          <s-section>
            <s-stack gap="base">
              <s-paragraph>
                Recete sends your customers helpful WhatsApp messages after their order is
                delivered and answers their questions about your products.
              </s-paragraph>
              <s-stack direction="inline" gap="small-100">
                <s-button variant="primary" href={APP_STORE_URL} target="_blank">
                  Install from the Shopify App Store
                </s-button>
                <s-button href={adminAppUrl} target="_top">
                  Already installed? Open in Shopify admin
                </s-button>
              </s-stack>
            </s-stack>
          </s-section>
          <s-section heading="Not on Shopify?">
            <s-stack gap="small-200">
              <s-paragraph color="subdued">Recete also works without Shopify.</s-paragraph>
              <s-link href="https://recete.co.uk">Go to recete.co.uk</s-link>
            </s-stack>
          </s-section>
        </s-stack>
      </s-page>
    </>
  );
}
