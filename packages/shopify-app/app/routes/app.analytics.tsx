import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ChartVerticalIcon, ChatIcon, SettingsIcon } from "@shopify/polaris-icons";
import { InlineGrid } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { fetchMerchantOverviewFromRequest } from "../platform.server";
import { ActionCard, DetailRows, MetricCard, SectionCard, ShellPage, StatusBadge } from "../components/shell-ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return fetchMerchantOverviewFromRequest(request);
};

export default function AnalyticsPage() {
  const data = useLoaderData<typeof loader>();
  const resolvedRate =
    data.analytics.totalConversations > 0
      ? Math.round((data.analytics.resolvedConversations / data.analytics.totalConversations) * 100)
      : 0;

  return (
    <ShellPage
      title="Analytics"
      subtitle="Retention quality signals that should help the merchant decide what to adjust next."
      primaryAction={{ content: "Open conversations", url: "/app/conversations", icon: ChatIcon }}
    >
      <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
        <MetricCard label="Avg sentiment" value={data.analytics.avgSentiment.toFixed(2)} hint="Conversation sentiment across tracked interactions." />
        <MetricCard label="Return rate" value={`${data.analytics.returnRate}%`} hint="Returned orders relative to the visible order pool." />
        <MetricCard label="Prevented returns" value={data.analytics.preventedReturns} hint="Recorded return prevention outcomes." />
        <MetricCard label="Conversations" value={data.analytics.totalConversations} hint={`${data.analytics.resolvedConversations} with 2+ messages.`} />
      </InlineGrid>

      <SectionCard
        title="Interpretation"
        subtitle="The merchant should leave this screen knowing whether message quality, catalog, or settings need attention."
        badge={
          <StatusBadge status={data.metrics.responseRate >= 25 ? "active" : "pending"}>
            {`${data.metrics.responseRate}% response`}
          </StatusBadge>
        }
      >
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <ActionCard
            title="Conversation quality"
            description={
              data.analytics.avgSentiment >= 4
                ? "Buyer sentiment is healthy."
                : data.analytics.avgSentiment >= 3
                  ? "Sentiment is neutral and should be monitored."
                  : "Sentiment is weak and likely needs settings or product-quality review."
            }
            status={data.analytics.avgSentiment >= 4 ? "active" : data.analytics.avgSentiment >= 3 ? "pending" : "failed"}
            action={{ content: "Open settings", url: "/app/settings", icon: SettingsIcon }}
          />
          <CardSummaryRows
            title="Coverage"
            rows={[
              { label: "Total conversations", value: data.analytics.totalConversations },
              { label: "Resolved conversations", value: data.analytics.resolvedConversations },
              { label: "Resolution rate", value: `${resolvedRate}%` },
            ]}
          />
        </InlineGrid>
      </SectionCard>

      <SectionCard
        title="Recommended actions"
        subtitle="Analytics should push the merchant toward action, not just static reporting."
      >
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <ActionCard
            title="Improve settings"
            description="If sentiment or resolution rate is weak, tone, template, and multilingual setup are the first things to review."
            status="info"
            action={{ content: "Review settings", url: "/app/settings", icon: SettingsIcon }}
          />
          <ActionCard
            title="Inspect conversations"
            description="Conversation lists show whether problems are really buyer mood, escalation handling, or simple lack of activity."
            status="info"
            action={{ content: "Open conversations", url: "/app/conversations", icon: ChartVerticalIcon }}
          />
        </InlineGrid>
      </SectionCard>
    </ShellPage>
  );
}

function CardSummaryRows({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string | number }>;
}) {
  return (
    <SectionCard title={title}>
      <DetailRows rows={rows.map((row) => ({ label: row.label, value: row.value }))} />
    </SectionCard>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
