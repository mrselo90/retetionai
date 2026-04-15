import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ChartVerticalIcon, ChatIcon, SettingsIcon } from "@shopify/polaris-icons";
import { BlockStack, Card, InlineGrid, InlineStack, Text } from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { getSetupProgress } from "../lib/setupProgress";
import { fetchMerchantOverviewFromRequest } from "../platform.server";
import {
  ActionCard,
  DetailRows,
  MetricCard,
  SectionCard,
  SetupDependencyList,
  type SetupDependencyItem,
  ShellPage,
  StatePanel,
  StatusBadge,
  ValuePreview,
} from "../components/shell-ui";
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
  const progress = getSetupProgress(data);
  const hasBilling = progress.hasBilling;
  const hasProducts = progress.hasProducts;
  const hasMessagingConfigured = progress.hasMessagingConfigured;
  const hasConversations = data.analytics.totalConversations > 0;
  const hasAnalyticsSignals =
    hasConversations ||
    data.analytics.preventedReturns > 0 ||
    data.analytics.returnRate > 0 ||
    data.analytics.avgSentiment > 0;
  const onboardingIncomplete = !hasBilling || !hasProducts || !hasMessagingConfigured;
  const readyNoData = !onboardingIncomplete && !hasAnalyticsSignals;
  const isPro = data.analyticsLevel === "ADVANCED";
  const analyticsState: "onboarding_incomplete" | "ready_no_data" | "has_data" =
    onboardingIncomplete ? "onboarding_incomplete" : readyNoData ? "ready_no_data" : "has_data";

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

  const primaryAction = analyticsState === "onboarding_incomplete"
    ? setupAction
    : analyticsState === "ready_no_data"
      ? { content: "Start conversations", url: "/app/conversations", icon: ChatIcon }
      : data.metrics.responseRate < 25
        ? { content: "Adjust messaging settings", url: "/app/settings", icon: SettingsIcon }
        : { content: "Review buyer threads", url: "/app/conversations", icon: ChatIcon };

  const topInsight =
    analyticsState === "has_data"
      ? {
          title: data.metrics.responseRate < 25 ? "Quality risk detected" : "Analytics is active",
          description:
            data.metrics.responseRate < 25
              ? "Response quality is below target. Prioritize message quality and escalation handling."
              : "You now have live analytics signals for retention and conversation performance.",
          tone: data.metrics.responseRate < 25 ? "attention" as const : "success" as const,
        }
      : analyticsState === "ready_no_data"
        ? {
            title: "Setup is complete. Waiting for first interactions",
            description: "Analytics will populate after first orders and customer conversations.",
            tone: "info" as const,
          }
        : {
            title: "This section is not available yet because setup is incomplete",
            description: "Complete setup to unlock customer analytics and performance insights.",
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

  const setupDependencies: SetupDependencyItem[] = [
    {
      label: "Plan activation",
      state: hasBilling ? "completed" : "current",
      hint: hasBilling ? "Billing approved." : "Activate your plan to continue.",
    },
    {
      label: "Product sync",
      state: hasProducts ? "completed" : hasBilling ? "current" : "locked",
      hint: hasProducts ? "Products are available." : hasBilling ? "Add products to enrich analytics context." : "Available after plan activation.",
    },
    {
      label: "Messaging setup",
      state: hasMessagingConfigured ? "completed" : hasBilling && hasProducts ? "current" : "locked",
      hint: hasMessagingConfigured ? "Messaging configuration is ready." : hasBilling && hasProducts ? "Configure bot and WhatsApp settings." : "Available after product sync.",
    },
    {
      label: "First conversations",
      state: hasConversations ? "completed" : hasBilling && hasProducts && hasMessagingConfigured ? "current" : "locked",
      hint: hasConversations ? "Analytics is receiving conversation data." : hasBilling && hasProducts && hasMessagingConfigured ? "Waiting for first customer interactions." : "Available after messaging setup.",
    },
  ];

  return (
    <ShellPage
      title="Analytics"
      subtitle={
        analyticsState === "onboarding_incomplete"
          ? "This section unlocks after setup milestones are complete."
          : analyticsState === "ready_no_data"
            ? "Setup is complete. Analytics will appear after first interactions."
            : "Performance insights for post-purchase conversations and retention."
      }
      primaryAction={primaryAction}
    >
      <StatePanel
        title={topInsight.title}
        description={topInsight.description}
        tone={topInsight.tone}
        statusLabel={analyticsState === "onboarding_incomplete" ? "In progress" : analyticsState === "ready_no_data" ? "Ready" : "Live"}
      />

      {analyticsState === "onboarding_incomplete" ? (
        <>
          <SectionCard
            title="Setup dependencies"
            subtitle="Follow this order to unlock analytics."
          >
            <SetupDependencyList items={setupDependencies} />
          </SectionCard>

          <SectionCard
            title="What you'll see here after setup"
            subtitle="Preview of analytics value once live data starts flowing."
          >
            <ValuePreview
              items={[
                {
                  title: "Sentiment trends",
                  description: "Understand customer mood patterns from conversation signals.",
                },
                {
                  title: "Return prevention",
                  description: "Measure prevented returns and identify risky patterns early.",
                },
                {
                  title: "Conversation performance",
                  description: "Track reply quality and resolution outcomes over time.",
                },
              ]}
            />
          </SectionCard>
        </>
      ) : null}

      {analyticsState === "ready_no_data" ? (
        <>
          <SectionCard
            title="Waiting for first live interactions"
            subtitle="The analytics model is ready. Insights appear after first customer activity."
          >
            <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
              <MetricCard label="Avg sentiment" value="No data yet" hint="Waiting for first conversations." />
              <MetricCard label="Return rate" value="No data yet" hint="Will appear after order outcomes are tracked." />
              <MetricCard label="Prevented returns" value="No data yet" hint="Will appear after prevention workflows run." />
              <MetricCard label="Conversations" value="No data yet" hint="Waiting for first buyer conversations." />
            </InlineGrid>
          </SectionCard>

          <SectionCard
            title="What to do now"
            subtitle="Trigger first activity to unlock real analytics."
          >
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">Start a conversation to see analytics begin populating.</Text>
              <Text as="p" variant="bodyMd">Receive your first order and conversation events to unlock real recommendations.</Text>
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

      {analyticsState === "has_data" ? (
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

      {analyticsState === "has_data" ? (
        isPro ? (
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
        ) : (
          <SectionCard
            title="Unlock deeper insights with Pro"
            subtitle="Expand from core monitoring to customer-level trend and predictive analytics."
          >
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <ActionCard
                title="What Pro adds"
                description="Customer-level breakdowns, trend analysis, and predictive signals for retention decisions."
                status="info"
              />
              <ActionCard
                title="Upgrade path"
                description="Keep current workflows and add deeper interpretation layers when ready."
                status="pending"
                action={{ content: "Compare plans", url: "/app/billing", icon: ChartVerticalIcon }}
              />
            </InlineGrid>
          </SectionCard>
        )
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
