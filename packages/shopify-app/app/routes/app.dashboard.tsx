import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  authenticate,
  PRO_MONTHLY_PLAN,
  PRO_YEARLY_PLAN,
  STARTER_MONTHLY_PLAN,
  STARTER_YEARLY_PLAN,
} from "../shopify.server";
import { syncShopInstall } from "../platform.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const sync = await syncShopInstall(session);
  const billingState = await billing.check({
    plans: [
      STARTER_MONTHLY_PLAN,
      STARTER_YEARLY_PLAN,
      PRO_MONTHLY_PLAN,
      PRO_YEARLY_PLAN,
    ],
    isTest: process.env.NODE_ENV !== "production",
  });

  const legacyDashboardUrl =
    process.env.LEGACY_DASHBOARD_URL?.trim() || "http://localhost:3000";
  const classicPortalHref = new URL("/en/dashboard", legacyDashboardUrl);
  classicPortalHref.searchParams.set("shop", session.shop);

  return {
    shop: session.shop,
    scope: session.scope ?? "",
    merchantId: sync?.merchantId ?? null,
    installStatus: sync?.created ? "created" : "updated",
    hasActivePayment: billingState.hasActivePayment,
    subscriptions: billingState.appSubscriptions.map((subscription) => ({
      id: subscription.id,
      name: subscription.name,
      status: subscription.status,
    })),
    classicPortalHref: classicPortalHref.toString(),
  };
};

export default function DashboardPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <s-page heading="Merchant dashboard">
      <s-section heading="Shopify app status">
        <s-stack direction="block" gap="base">
          <s-text>Shop: {data.shop}</s-text>
          <s-text>Merchant ID: {data.merchantId ?? "not synced"}</s-text>
          <s-text>Install sync: {data.installStatus}</s-text>
          <s-text>Scopes: {data.scope || "none"}</s-text>
        </s-stack>
      </s-section>

      <s-section heading="Billing">
        <s-stack direction="block" gap="base">
          <s-text>
            Active payment: {data.hasActivePayment ? "yes" : "no"}
          </s-text>
          {data.subscriptions.length > 0 ? (
            data.subscriptions.map((subscription) => (
              <s-text key={subscription.id}>
                {subscription.name} ({subscription.status})
              </s-text>
            ))
          ) : (
            <s-text>No active Shopify app subscription found.</s-text>
          )}
          <s-stack direction="inline" gap="base">
            <s-link href="/app/billing">Open billing</s-link>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Access model">
        <s-stack direction="block" gap="base">
          <s-text>
            Shopify merchants should use this shell. They should not be routed
            through the legacy Recete login flow.
          </s-text>
          <s-text>
            The classic portal remains available for non-Shopify customers and
            super admin workflows.
          </s-text>
          <s-link href={data.classicPortalHref} target="_top">
            Open classic portal
          </s-link>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
