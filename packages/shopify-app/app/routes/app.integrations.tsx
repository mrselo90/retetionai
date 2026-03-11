import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchMerchantOverview } from "../platform.server";
import { useLoaderData } from "react-router";

function statusClass(status?: string | null) {
  const value = (status || "").toLowerCase();
  if (["active", "connected", "approved"].includes(value)) {
    return "shellStatus shellStatusConnected";
  }
  if (["pending", "trialing"].includes(value)) {
    return "shellStatus shellStatusPending";
  }
  return "shellStatus shellStatusFailed";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return fetchMerchantOverview(session.shop);
};

export default function IntegrationsPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <section className="shellSection">
      <div className="shellSectionHeader">
        <div>
          <h2 className="shellSectionTitle">Integrations</h2>
          <p className="shellSectionText">
            Core connection health across Shopify and adjacent services.
          </p>
        </div>
      </div>

      <div className="shellCards">
        {data.integrations.map((integration) => (
          <article className="shellCard" key={integration.id}>
            <div className="shellSectionHeader" style={{ marginBottom: "10px" }}>
              <div>
                <h3 className="shellCardTitle" style={{ marginBottom: 0 }}>
                  {integration.provider}
                </h3>
                <p className="shellSectionText">
                  Updated{" "}
                  {integration.updated_at
                    ? new Date(integration.updated_at).toLocaleString()
                    : "unknown"}
                </p>
              </div>
              <span className={statusClass(integration.status)}>
                {integration.status}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
