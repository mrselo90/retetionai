import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchMerchantOverview } from "../platform.server";

function statusClass(status?: string | null) {
  const value = (status || "").toLowerCase();
  if (["active", "connected", "approved"].includes(value)) {
    return "shellStatus shellStatusActive";
  }
  if (["trialing", "pending"].includes(value)) {
    return "shellStatus shellStatusPending";
  }
  return "shellStatus shellStatusInactive";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return fetchMerchantOverview(session.shop);
};

export default function DashboardPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <>
      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h2 className="shellSectionTitle">Dashboard</h2>
            <p className="shellSectionText">
              Core merchant signals for launch readiness and daily operations.
            </p>
          </div>
          <span className={statusClass(data.subscription?.status)}>
            {data.subscription?.status || "inactive"}
          </span>
        </div>

        <div className="shellMetrics">
          <article className="shellMetricCard">
            <p className="shellMetricLabel">Orders</p>
            <p className="shellMetricValue">{data.metrics.totalOrders}</p>
            <p className="shellMetricHint">Orders synced to Recete</p>
          </article>
          <article className="shellMetricCard">
            <p className="shellMetricLabel">Consent-active users</p>
            <p className="shellMetricValue">{data.metrics.activeUsers}</p>
            <p className="shellMetricHint">Eligible buyer base</p>
          </article>
          <article className="shellMetricCard">
            <p className="shellMetricLabel">Catalog rows</p>
            <p className="shellMetricValue">{data.metrics.totalProducts}</p>
            <p className="shellMetricHint">Products ready for mapping</p>
          </article>
          <article className="shellMetricCard">
            <p className="shellMetricLabel">Response rate</p>
            <p className="shellMetricValue">{data.metrics.responseRate}%</p>
            <p className="shellMetricHint">Conversation engagement</p>
          </article>
        </div>
      </section>

      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h3 className="shellSectionTitle">What needs attention</h3>
            <p className="shellSectionText">
              Fast path to getting the app from installed to usable.
            </p>
          </div>
        </div>

        <div className="shellCards">
          <article className="shellCard">
            <h4 className="shellCardTitle">Billing approval</h4>
            <p className="shellSectionText">
              {data.subscription?.status === "active"
                ? "Billing is active. Merchant can use paid features."
                : "Billing is not active yet. Approve a plan before using the core retention flow."}
            </p>
            <div style={{ marginTop: "14px" }}>
              <Link to="/app/billing" className="shellButton shellButtonPrimary">
                Open billing
              </Link>
            </div>
          </article>

          <article className="shellCard">
            <h4 className="shellCardTitle">Catalog readiness</h4>
            <p className="shellSectionText">
              {data.metrics.totalProducts > 0
                ? `${data.metrics.totalProducts} products are available for recipe mapping.`
                : "No products are visible yet. Product mapping should be the next merchant action."}
            </p>
            <div style={{ marginTop: "14px" }}>
              <Link to="/app/products" className="shellButton shellButtonPrimary">
                Review products
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h3 className="shellSectionTitle">Recent orders</h3>
            <p className="shellSectionText">
              Latest synced orders visible to the retention engine.
            </p>
          </div>
        </div>

        {data.recentOrders.length > 0 ? (
          <div className="shellList">
            {data.recentOrders.map((order) => (
              <div className="shellListItem" key={order.id}>
                <div className="shellListMain">
                  <p className="shellListTitle">
                    {order.external_order_id || order.id}
                  </p>
                  <p className="shellListMeta">
                    Created {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                <span className={statusClass(order.status)}>{order.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="shellCard">
            <p className="shellSectionText">
              No orders synced yet. Once `orders/fulfilled` events arrive, they
              will appear here.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
