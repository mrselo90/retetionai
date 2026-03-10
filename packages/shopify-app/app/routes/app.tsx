import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const legacyDashboardUrl =
    process.env.LEGACY_DASHBOARD_URL?.trim() || "http://localhost:3000";
  const dashboardHref = new URL("/en/dashboard", legacyDashboardUrl);
  dashboardHref.searchParams.set("shop", session.shop);

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    dashboardHref: dashboardHref.toString(),
  };
};

export default function App() {
  const { apiKey, dashboardHref } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #e1e3e5" }}>
        <div style={{ display: "flex", gap: "16px" }}>
          <Link to="/app">Home</Link>
          <a href={dashboardHref} target="_top" rel="noreferrer">
            Dashboard
          </a>
          <Link to="/app/billing">Billing</Link>
        </div>
      </div>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
