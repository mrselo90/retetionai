import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchMerchantOverview } from "../platform.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return fetchMerchantOverview(session.shop);
};

export default function Index() {
  const data = useLoaderData<typeof loader>();

  return (
    <>
      <section className="shellHero">
        <p className="shellHeroEyebrow">Retention command center</p>
        <h2 className="shellHeroTitle">
          Turn fulfilled orders into compliant WhatsApp retention.
        </h2>
        <p className="shellHeroText">
          This merchant shell now owns Shopify auth, billing, and webhook ingress.
          The next goal is simple: connect catalog, verify billing, and keep
          message flows compliant.
        </p>
        <div className="shellHeroActions">
          <Link to="/app/dashboard" className="shellButton shellButtonPrimary">
            Open dashboard
          </Link>
          <Link to="/app/products" className="shellButton shellButtonSecondary">
            Review catalog
          </Link>
        </div>
      </section>

      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h3 className="shellSectionTitle">Merchant overview</h3>
            <p className="shellSectionText">
              Shopify merchant, billing, and product readiness in one place.
            </p>
          </div>
        </div>

        <div className="shellMetrics">
          <article className="shellMetricCard">
            <p className="shellMetricLabel">Orders</p>
            <p className="shellMetricValue">{data.metrics.totalOrders}</p>
            <p className="shellMetricHint">Imported orders in platform</p>
          </article>
          <article className="shellMetricCard">
            <p className="shellMetricLabel">Active users</p>
            <p className="shellMetricValue">{data.metrics.activeUsers}</p>
            <p className="shellMetricHint">Consent-active customers</p>
          </article>
          <article className="shellMetricCard">
            <p className="shellMetricLabel">Products</p>
            <p className="shellMetricValue">{data.metrics.totalProducts}</p>
            <p className="shellMetricHint">Catalog rows available</p>
          </article>
          <article className="shellMetricCard">
            <p className="shellMetricLabel">Response rate</p>
            <p className="shellMetricValue">{data.metrics.responseRate}%</p>
            <p className="shellMetricHint">Conversation reply coverage</p>
          </article>
        </div>
      </section>

      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h3 className="shellSectionTitle">Next actions</h3>
            <p className="shellSectionText">
              Use the shell as the merchant-facing control room. Legacy access
              should now be the exception.
            </p>
          </div>
        </div>

        <div className="shellCards">
          <article className="shellCard">
            <h4 className="shellCardTitle">Check analytics</h4>
            <p className="shellSectionText">
              Review sentiment, return rate, and prevented returns to confirm
              the retention engine is healthy.
            </p>
            <div style={{ marginTop: "14px" }}>
              <Link to="/app/analytics" className="shellButton shellButtonPrimary">
                Open analytics
              </Link>
            </div>
          </article>
          <article className="shellCard">
            <h4 className="shellCardTitle">Review merchant settings</h4>
            <p className="shellSectionText">
              Verify bot tone, sender mode, and notification phone without
              leaving the embedded app.
            </p>
            <div style={{ marginTop: "14px" }}>
              <Link to="/app/settings" className="shellButton shellButtonPrimary">
                Open settings
              </Link>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
