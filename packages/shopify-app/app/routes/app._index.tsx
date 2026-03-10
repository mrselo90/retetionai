import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { syncShopInstall } from "../platform.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const sync = await syncShopInstall(session);

  return {
    shop: session.shop,
    scope: session.scope ?? "",
    merchantId: sync?.merchantId ?? null,
    created: sync?.created ?? false,
  };
};

export default function Index() {
  const data = useLoaderData<typeof loader>();

  return (
    <s-page heading="Recete Shopify Shell">
      <s-section heading="Migration status">
        <s-paragraph>
          This shell now owns official Shopify authentication, embedded app
          boot, and webhook ingress. Core business logic still runs in the
          Recete platform API.
        </s-paragraph>
      </s-section>

      <s-section heading="Current shop">
        <s-stack direction="block" gap="base">
          <s-text>Shop: {data.shop}</s-text>
          <s-text>Merchant ID: {data.merchantId ?? "not synced"}</s-text>
          <s-text>Install sync: {data.created ? "created" : "updated"}</s-text>
          <s-text>Scopes: {data.scope || "none"}</s-text>
        </s-stack>
      </s-section>

      <s-section heading="Next steps">
        <s-paragraph>
          The next migration phase is moving billing UX and dashboard routes
          into this shell, then deleting the legacy custom Shopify auth flow.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
