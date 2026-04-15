import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ChartVerticalIcon, ChatIcon, SettingsIcon } from "@shopify/polaris-icons";
import { BlockStack, Card, InlineGrid, InlineStack, Text } from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { fetchMerchantOverviewFromRequest } from "../platform.server";
import { ActionCard, DetailRows, MetricCard, SectionCard, ShellPage, StatePanel, StatusBadge } from "../components/shell-ui";
import { getAnalyticsLevel, getPlanSnapshotByDomain } from "../services/planService.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateEmbeddedAdmin(request);
  const [overview, plan] = await Promise.all([
    fetchMerchantOverviewFromRequest(request),
    getPlanSnapshotByDomain(session.shop),
  ]);

  return {
    ...overview,
    plan,
    analyticsLevel: await getAnalyticsLevel(plan.shopId),
  };
};

export default function AnalyticsPage() {
  const data = useLoaderData<typeof loader>();
  const hasBilling = data.subscription?.status === "active";
  const hasProducts = data.metrics.totalProducts > 0;
  const hasMessagingConfigured = Boolean(
    data.settings?.notificationPhone ||
      data.settings?.personaSettings?.bot_name ||
      data.settings?.personaSettings?.whatsapp_welcome_template,
  );
  const hasConversations = data.analytics.totalConversations > 0;
  const hasAnalyticsSignals =
    hasConversations ||
    data.analytics.preventedReturns > 0 ||
    data.analytics.returnRate > 0 ||
    data.analytics.avgSentiment > 0;
  const onboardingIncomplete = !hasBilling || !hasProducts || !hasMessagingConfigured;
  const readyNoData = !onboardingIncomplete && !hasAnalyticsSignals;
  const isPro = data.analyticsLevel === "ADVANCED";

  const analyticsState: "onboarding_incomplete" | "ready_no_data" | "has_data_basic" | "has_data_pro" =
    onboardingIncomplete
      ? "onboarding_incomplete"
      : readyNoData
        ? "ready_no_data"
        : isPro
          ? "has_data_pro"
          : "has_data_basic";

  const resolvedRate =
    data.analytics.totalConversations > 0
      ? Math.round((data.analytics.resolvedConversations / data.analytics.totalConversations) * 100)
      : 0;

  const setupAction = !hasBilling
    ? { content: "Activate plan", url: "/app/billing", icon: ChartVerticalIcon }
    : !hasProducts
      ? { content: "Add products", url: "/app/products", icon: ChatIcon }
      : !hasMessagingConfigured
        ? { content: "Configure messaging", url: "/app/settings", icon: SettingsIcon }
        : { content: "Open conversations", url: "/app/conversations", icon: ChatIcon };

  const primaryAction =
    analyticsState === "onboarding_incomplete"
      ? setupAction
      : analyticsState === "ready_no_data"
        ? { content: "Start conversations", url: "/app/conversations", icon: ChatIcon }
        : data.metrics.responseRate < 25
          ? { content: "Adjust messaging settings", url: "/app/settings", icon: SettingsIcon }
          : { content: "Review buyer threads", url: "/app/conversations", icon: ChatIcon };

  const topInsight =
    analyticsState === "has_data_pro"
      ? {
          title: data.metrics.responseRate < 25 ? "Quality risk detected" : "Analytics looks healthy",
          description:
            data.metrics.responseRate < 25
              ? "Response quality is below target. Focus on messaging relevance and escalation handling."
              : "Core performance is stable. Keep optimizing with trend and segmentation analysis.",
          tone: data.metrics.responseRate < 25 ? "attention" as const : "success" as const,
        }
      : analyticsState === "has_data_basic"
        ? {
            title: "Core analytics is active",
            description: "You can monitor key signals now. Upgrade to Pro when you need deeper interpretation and predictive insights.",
            tone: "info" as const,
          }
        : analyticsState === "ready_no_data"
          ? {
              title: "Analytics is ready and waiting for first interactions",
              description: "Data appears after the first customer conversations and post-purchase events.",
              tone: "info" as const,
            }
          : {
              title: "Analytics will be available after setup",
              description: "This workspace unlocks after plan activation, product sync, messaging setup, and first customer conversations.",
              tone: "attention" as const,
            };

  const recommendationCard =
    data.metrics.responseRate < 25
      ? {
          title: "Raise response quality",
          description: "Low response rate suggests message relevance, tone, or timing needs adjustment.",
          action: { content: "Adjust messaging settings", url: "/app/settings", icon: SettingsIcon },
        }
      : data.analytics.avgSentiment < 3.5
        ? {
            title: "Review sentiment drivers",
            description: "Customer sentiment is soft. Review risky conversations and product guidance consistency.",
            action: { content: "Inspect conversations", url: "/app/conversations", icon: ChatIcon },
          }
        : {
            title: "Maintain healthy performance",
            description: "Current signals are stable. Continue routine thread review and incremental improvements.",
            action: { content: "Review buyer threads", url: "/app/conversations", icon: ChatIcon },
          };

  return (
    <ShellPage
      title="Analytics"
      subtitle={
        analyticsState === "onboarding_incomplete"
          ? "Finish setup to unlock customer analytics."
          : analyticsState === "ready_no_data"
            ? "Analytics workspace is ready and waiting for first live activity."
            : isPro
              ? "Advanced analytics workspace for retention, trend, and customer-level decision making."
              : "Core analytics workspace for tracking post-purchase performance."
      }
      primaryAction={primaryAction}
    >
      <StatePanel
        title={topInsight.title}
        description={topInsight.description}
        tone={topInsight.tone}
        action={primaryAction}
      />

      {analyticsState === "onboarding_incomplete" ? (
        <>
          <SectionCard
            title="Setup dependencies"
            subtitle="Analytics becomes active after setup milestones are complete."
          >
            <CardSummaryRows
              title="Required before analytics"
              rows={[
                { label: "Plan activation", value: hasBilling ? "✅ Completed" : "❌ Required" },
                { label: "Product sync", value: hasProducts ? "✅ Completed" : "🔒 Available after plan activation" },
                { label: "Messaging setup", value: hasMessagingConfigured ? "✅ Completed" : "🔒 Unlocks after products are added" },
                { label: "First conversations", value: hasConversations ? "✅ Active" : "🔒 Available after setup is complete" },
              ]}
            />
          </SectionCard>

          <SectionCard
            title="What you'll see here after setup"
            subtitle="Analytics will shift from setup guidance to actionable insights."
          >
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              <ActionCard
                title="Sentiment tracking"
                description="Monitor customer mood trends across post-purchase conversations."
                status="pending"
              />
              <ActionCard
                title="Return prevention insights"
                description="Measure prevented returns and identify high-risk interaction patterns."
                status="pending"
              />
              <ActionCard
                title="Conversation analytics"
                description="Track response and resolution quality over time."
                status="pending"
              />
            </InlineGrid>
          </SectionCard>
        </>
      ) : null}

      {analyticsState === "ready_no_data" ? (
        <>
          <SectionCard
            title="Waiting for first live interactions"
            subtitle="The analytics model is ready; insights appear after the first customer conversations."
          >
            <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
              <MetricCard label="Avg sentiment" value="—" hint="Waiting for first conversations." />
              <MetricCard label="Return rate" value="—" hint="Will appear after order outcomes are tracked." />
              <MetricCard label="Prevented returns" value="—" hint="Will appear after prevention workflows run." />
              <MetricCard label="Conversations" value="—" hint="No conversations yet." />
            </InlineGrid>
          </SectionCard>

          <SectionCard
            title="What to do now"
            subtitle="Trigger first activity to unlock real analytics."
          >
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">Start a conversation to see analytics begin populating.</Text>
              <Text as="p" variant="bodyMd">Data will appear automatically after customer interactions.</Text>
            </BlockStack>
          </SectionCard>

          <SectionCard
            title="What will be recommended once data is available"
            subtitle="Recommendations are generated only from real conversation and return signals."
          >
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <ActionCard
                title="Quality interventions"
                description="Recete will suggest message or timing changes when response quality drops."
                status="pending"
              />
              <ActionCard
                title="Retention opportunities"
                description="Recete will surface high-impact actions when churn risk signals emerge."
                status="pending"
              />
            </InlineGrid>
          </SectionCard>
        </>
      ) : null}

      {analyticsState === "has_data_basic" || analyticsState === "has_data_pro" ? (
        <>
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
            <MetricCard label="Avg sentiment" value={data.analytics.avgSentiment.toFixed(2)} hint="Conversation sentiment across tracked interactions." />
            <MetricCard label="Return rate" value={`${data.analytics.returnRate}%`} hint="Returned orders relative to tracked order pool." />
            <MetricCard label="Prevented returns" value={data.analytics.preventedReturns} hint="Recorded return prevention outcomes." />
            <MetricCard label="Conversations" value={data.analytics.totalConversations} hint={`${data.analytics.resolvedConversations} with 2+ messages.`} />
          </InlineGrid>

          <SectionCard
            title="Recommended next action"
            subtitle="Generated from current analytics signals."
          >
            <ActionCard
              title={recommendationCard.title}
              description={recommendationCard.description}
              status={data.metrics.responseRate < 25 ? "failed" : data.analytics.avgSentiment < 3.5 ? "pending" : "active"}
              action={recommendationCard.action}
            />
          </SectionCard>
        </>
      ) : null}

      {analyticsState === "has_data_basic" ? (
        <SectionCard
          title="Unlock deeper insights with Pro"
          subtitle="Expand analytics depth when you are ready to move from core monitoring to prediction and segmentation."
        >
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <ActionCard
              title="What Pro adds"
              description="Customer-level breakdowns, trend analysis, and predictive signals for retention decisions."
              status="info"
            />
            <ActionCard
              title="Upgrade path"
              description="Keep your existing analytics and add deeper interpretation layers without changing current workflows."
              status="pending"
              action={{ content: "Compare plans", url: "/app/billing", icon: ChartVerticalIcon }}
            />
          </InlineGrid>
        </SectionCard>
      ) : null}

      {analyticsState === "has_data_pro" ? (
        <SectionCard
          title="Advanced interpretation"
          subtitle="Use trend and segmentation signals to decide whether to adjust settings, products, or escalation policy."
          badge={
            <StatusBadge status={data.metrics.responseRate >= 25 ? "active" : "pending"}>
              {`${data.metrics.responseRate}% response`}
            </StatusBadge>
          }
        >
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <ActionCard
              title="Conversation quality trend"
              description={
                data.analytics.avgSentiment >= 4
                  ? "Buyer sentiment trend is healthy."
                  : data.analytics.avgSentiment >= 3
                    ? "Sentiment trend is neutral and should be monitored."
                    : "Sentiment trend is weak and likely needs message quality intervention."
              }
              status={data.analytics.avgSentiment >= 4 ? "active" : data.analytics.avgSentiment >= 3 ? "pending" : "failed"}
              action={{ content: "Adjust messaging settings", url: "/app/settings", icon: SettingsIcon }}
            />
            <CardSummaryRows
              title="Trend coverage"
              rows={[
                { label: "Total conversations", value: data.analytics.totalConversations },
                { label: "Resolved conversations", value: data.analytics.resolvedConversations },
                { label: "Resolution rate", value: `${resolvedRate}%` },
              ]}
            />
          </InlineGrid>
        </SectionCard>
      ) : null}
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
    <Card padding="500">
      <BlockStack gap="300">
        <Text as="h3" variant="headingMd">{title}</Text>
        <DetailRows rows={rows.map((row) => ({ label: row.label, value: row.value }))} />
      </BlockStack>
    </Card>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
