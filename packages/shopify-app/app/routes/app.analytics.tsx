import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchMerchantOverview } from "../platform.server";

function percentageTone(value: number) {
  if (value >= 70) return "shellStatus shellStatusActive";
  if (value >= 35) return "shellStatus shellStatusPending";
  return "shellStatus shellStatusInactive";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return fetchMerchantOverview(session.shop);
};

export default function AnalyticsPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <>
      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h2 className="shellSectionTitle">Analytics</h2>
            <p className="shellSectionText">
              High-signal retention health for this Shopify merchant.
            </p>
          </div>
          <span className={percentageTone(data.metrics.responseRate)}>
            Response {data.metrics.responseRate}%
          </span>
        </div>

        <div className="shellMetrics shellMetricsWide">
          <article className="shellMetricCard">
            <p className="shellMetricLabel">Avg sentiment</p>
            <p className="shellMetricValue">
              {data.analytics.avgSentiment.toFixed(2)}
            </p>
            <p className="shellMetricHint">From analytics events</p>
          </article>
          <article className="shellMetricCard">
            <p className="shellMetricLabel">Return rate</p>
            <p className="shellMetricValue">{data.analytics.returnRate}%</p>
            <p className="shellMetricHint">Returned orders / total orders</p>
          </article>
          <article className="shellMetricCard">
            <p className="shellMetricLabel">Prevented returns</p>
            <p className="shellMetricValue">{data.analytics.preventedReturns}</p>
            <p className="shellMetricHint">Successful save attempts</p>
          </article>
          <article className="shellMetricCard">
            <p className="shellMetricLabel">Conversations</p>
            <p className="shellMetricValue">{data.analytics.totalConversations}</p>
            <p className="shellMetricHint">
              {data.analytics.resolvedConversations} with 2+ messages
            </p>
          </article>
        </div>
      </section>

      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h3 className="shellSectionTitle">Interpretation</h3>
            <p className="shellSectionText">
              A simple operator view for fast merchant decisions.
            </p>
          </div>
        </div>

        <div className="shellCards">
          <article className="shellCard">
            <h4 className="shellCardTitle">Conversation quality</h4>
            <p className="shellSectionText">
              {data.analytics.avgSentiment >= 4
                ? "Buyer sentiment is healthy. Messaging tone is landing well."
                : data.analytics.avgSentiment >= 3
                  ? "Sentiment is neutral. Improve message relevance and timing."
                  : "Sentiment is weak. Review templates, targeting, and support handoff."}
            </p>
          </article>
          <article className="shellCard">
            <h4 className="shellCardTitle">Retention posture</h4>
            <p className="shellSectionText">
              {data.analytics.preventedReturns > 0
                ? `${data.analytics.preventedReturns} return-prevention outcomes have been recorded so far.`
                : "No prevented return outcomes are recorded yet. The next step is shipping more qualified buyer conversations."}
            </p>
          </article>
        </div>
      </section>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
