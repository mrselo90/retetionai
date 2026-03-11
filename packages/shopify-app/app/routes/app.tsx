import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Link,
  NavLink,
  Outlet,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import stylesUrl from "../styles/shell.css?url";

import { authenticate } from "../shopify.server";
import { fetchMerchantOverview } from "../platform.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const overview = await fetchMerchantOverview(session.shop);
  const legacyDashboardUrl =
    process.env.LEGACY_DASHBOARD_URL?.trim() || "http://localhost:3000";
  const classicPortalHref = new URL("/en/dashboard", legacyDashboardUrl);
  classicPortalHref.searchParams.set("shop", session.shop);

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    classicPortalHref: classicPortalHref.toString(),
    shop: session.shop,
    merchantName: overview.merchant.name || session.shop.replace(".myshopify.com", ""),
    subscriptionStatus:
      overview.subscription?.status ||
      overview.merchant.subscription_status ||
      "inactive",
  };
};

export default function App() {
  const { apiKey, classicPortalHref, merchantName, shop, subscriptionStatus } =
    useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <div className="shell">
        <div className="shellFrame">
          <div className="shellTopbar">
            <div className="shellBrand">
              <div className="shellBrandMark">R</div>
              <div>
                <p className="shellEyebrow">Shopify Merchant Console</p>
                <h1 className="shellTitle">{merchantName}</h1>
              </div>
            </div>
            <div className="shellMeta">
              <span className="shellChip">{shop}</span>
              <span className="shellChip shellChipMuted">
                Subscription: {subscriptionStatus}
              </span>
            </div>
          </div>

          <div className="shellGrid">
            <aside className="shellSidebar">
              <p className="shellNavLabel">Merchant Panel</p>
              <nav className="shellNav">
                <NavLink
                  to="/app"
                  end
                  className={({ isActive }) =>
                    `shellNavLink ${isActive ? "shellNavLinkActive" : ""}`
                  }
                >
                  Overview
                </NavLink>
                <NavLink
                  to="/app/dashboard"
                  className={({ isActive }) =>
                    `shellNavLink ${isActive ? "shellNavLinkActive" : ""}`
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/app/products"
                  className={({ isActive }) =>
                    `shellNavLink ${isActive ? "shellNavLinkActive" : ""}`
                  }
                >
                  Products
                </NavLink>
                <NavLink
                  to="/app/integrations"
                  className={({ isActive }) =>
                    `shellNavLink ${isActive ? "shellNavLinkActive" : ""}`
                  }
                >
                  Integrations
                </NavLink>
                <NavLink
                  to="/app/analytics"
                  className={({ isActive }) =>
                    `shellNavLink ${isActive ? "shellNavLinkActive" : ""}`
                  }
                >
                  Analytics
                </NavLink>
                <NavLink
                  to="/app/billing"
                  className={({ isActive }) =>
                    `shellNavLink ${isActive ? "shellNavLinkActive" : ""}`
                  }
                >
                  Billing
                </NavLink>
                <NavLink
                  to="/app/settings"
                  className={({ isActive }) =>
                    `shellNavLink ${isActive ? "shellNavLinkActive" : ""}`
                  }
                >
                  Settings
                </NavLink>
              </nav>

              <div className="shellSidebarNote">
                Shopify merchants should operate from this shell. Non-Shopify
                accounts and super admin workflows stay outside the embedded app.
              </div>

              <div className="shellSidebarFooter">
                <a href={classicPortalHref} target="_top" rel="noreferrer">
                  Open classic portal
                </a>
              </div>
            </aside>

            <main className="shellContent">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
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

export const links = () => [{ rel: "stylesheet", href: stylesUrl }];
