import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ChatIcon, PersonIcon } from "@shopify/polaris-icons";
import { BlockStack, InlineGrid, InlineStack, Text } from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { fetchMerchantCustomers, fetchMerchantOverviewFromRequest } from "../platform.server";
import { ActionCard, EmptyCard, MetricCard, SectionCard, ShellPage, StatePanel } from "../components/shell-ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);

  const overview = await fetchMerchantOverviewFromRequest(request);

  try {
    const customerData = await fetchMerchantCustomers(request, { page: 1, limit: 20 });
    return {
      overview,
      ...customerData,
    };
  } catch (error) {
    return {
      overview,
      customers: [],
      total: 0,
      page: 1,
      limit: 20,
      unavailableReason:
        error instanceof Error ? error.message : "Customer data is unavailable.",
    };
  }
};

export default function CustomersPage() {
  const data = useLoaderData<typeof loader>();
  const customers = data.customers || [];
  const sortedCustomers = [...customers].sort((left, right) =>
    (right.churnProbability || 0) - (left.churnProbability || 0)
      || (right.conversationCount || 0) - (left.conversationCount || 0)
  );
  const unavailableReason = "unavailableReason" in data ? (data as Record<string, unknown>).unavailableReason as string | undefined : undefined;
  const highRiskCustomers = sortedCustomers.filter((item) => (item.churnProbability || 0) >= 0.6);
  const highRiskCount = highRiskCustomers.length;
  const engagedCustomers = sortedCustomers.filter((item) => (item.conversationCount || 0) > 0);
  const engagedCount = engagedCustomers.length;

  const hasBilling = data.overview.subscription?.status === "active";
  const hasProducts = data.overview.metrics.totalProducts > 0;
  const hasMessagingConfigured = Boolean(
    data.overview.settings?.notificationPhone ||
      data.overview.settings?.personaSettings?.bot_name ||
      data.overview.settings?.personaSettings?.whatsapp_welcome_template,
  );
  const hasOrders = data.overview.metrics.totalOrders > 0;
  const setupReady = hasBilling && hasProducts && hasMessagingConfigured;

  const uiState: "onboarding_incomplete" | "ready_no_data" | "has_data" =
    customers.length > 0
      ? "has_data"
      : setupReady
        ? "ready_no_data"
        : "onboarding_incomplete";

  const primaryCta =
    uiState === "has_data"
      ? { content: highRiskCount > 0 ? "Review at-risk customers" : "Open conversations", url: "/app/conversations", icon: ChatIcon }
      : !hasBilling
        ? { content: "Activate plan", url: "/app/billing", icon: ChatIcon }
        : !hasProducts
          ? { content: "Add products", url: "/app/products", icon: PersonIcon }
          : !hasMessagingConfigured
            ? { content: "Configure messaging", url: "/app/settings", icon: ChatIcon }
            : { content: "Check order flow", url: "/app/integrations#orders-flow", icon: ChatIcon };

  const setupDependencies = [
    { label: "Plan activation", value: hasBilling ? "✅ Completed" : "❌ Required" },
    { label: "Product sync", value: hasProducts ? "✅ Completed" : "🔒 Available after plan activation" },
    { label: "Messaging setup", value: hasMessagingConfigured ? "✅ Completed" : "🔒 Unlocks after products are added" },
    { label: "First order", value: hasOrders ? "✅ Received" : "🔒 Available after setup is complete" },
    { label: "Conversations", value: hasOrders ? "⏳ Waiting for first customer thread" : "🔒 Available after first order" },
  ];

  return (
    <ShellPage
      title="Customers"
      subtitle={
        uiState === "onboarding_incomplete"
          ? "Setup overview for customer insights."
          : uiState === "ready_no_data"
            ? "Customer workspace is ready and waiting for first live data."
            : "Customer health, segment visibility, and churn risk inside Shopify Admin."
      }
      primaryAction={primaryCta}
    >
      {uiState === "onboarding_incomplete" ? (
        <>
          <StatePanel
            title="No customer data yet because Recete is not fully set up"
            description="Customer insights depend on completing setup in sequence. Finish setup to unlock segments, churn risk, and engagement signals."
            tone="attention"
            action={primaryCta}
          />

          <SectionCard
            title="Setup dependencies"
            subtitle="Customer intelligence unlocks only after these steps are complete."
          >
            <BlockStack gap="200">
              {setupDependencies.map((dependency) => (
                <InlineStack key={dependency.label} align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">{dependency.label}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">{dependency.value}</Text>
                </InlineStack>
              ))}
            </BlockStack>
          </SectionCard>

          <SectionCard
            title="What will appear here after setup"
            subtitle="This page becomes your customer action workspace once data starts flowing."
          >
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              <ActionCard
                title="Customer segments"
                description="Identify at-risk and engaged customer groups automatically."
                status="pending"
              />
              <ActionCard
                title="Conversation insights"
                description="Track customer engagement signals from real conversation history."
                status="pending"
              />
              <ActionCard
                title="Retention opportunities"
                description="Prioritize buyers who need action before churn risk increases."
                status="pending"
              />
            </InlineGrid>
          </SectionCard>
        </>
      ) : null}

      {uiState === "ready_no_data" ? (
        <>
          <StatePanel
            title={unavailableReason ? "Customer data is temporarily unavailable" : "Setup complete. Waiting for first customer data"}
            description={
              unavailableReason
                ? "Customer analytics will load automatically once connectivity is restored."
                : "No customers yet. This workspace will update after your first order and conversation."
            }
            tone={unavailableReason ? "attention" : "info"}
            action={primaryCta}
          />

          <SectionCard
            title="What to do now"
            subtitle="The system is ready. Trigger first live data to activate customer insights."
          >
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">Create a test order in Shopify to generate the first customer record.</Text>
              <Text as="p" variant="bodyMd">Start a conversation to unlock churn risk and engagement segments.</Text>
            </BlockStack>
          </SectionCard>

          <SectionCard
            title="Preview after first data"
            subtitle="These sections will fill automatically."
          >
            <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
              <MetricCard label="Visible customers" value="—" hint="Will appear after first order sync." />
              <MetricCard label="At risk" value="—" hint="Will appear after conversation signals exist." />
              <MetricCard label="Engaged" value="—" hint="Will appear after active conversation history." />
              <MetricCard label="Segments" value="—" hint="Will appear when customer profiles are scored." />
            </InlineGrid>
          </SectionCard>
        </>
      ) : null}

      {uiState === "has_data" ? (
        <>
          <StatePanel
            title={
              unavailableReason
                ? "Customer health is temporarily unavailable"
                : highRiskCount > 0
                  ? "High-risk buyers need review"
                  : "Customer board looks healthy"
            }
            description={
              unavailableReason
                ? "Risk and segment decisions should wait until the latest customer data loads."
                : highRiskCount > 0
                  ? `${highRiskCount} customer${highRiskCount === 1 ? "" : "s"} currently show elevated churn risk.`
                  : "Use this screen to prioritize retention actions and monitor customer health."
            }
            tone={unavailableReason || highRiskCount > 0 ? "attention" : "success"}
            action={primaryCta}
          />

          <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
            <MetricCard label="Visible customers" value={data.total || customers.length} hint="Buyer records visible in the current shell batch." />
            <MetricCard label="At risk" value={highRiskCount} hint="Customers with high churn probability." />
            <MetricCard label="Engaged" value={engagedCount} hint="Customers with active conversation history." />
            <MetricCard label="Page size" value={data.limit || 20} hint="Customer records loaded for the current shell view." />
          </InlineGrid>

          <SectionCard
            title="Recommended customer actions"
            subtitle="Prioritize action queues with the strongest expected impact."
          >
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              <ActionCard
                title="At-risk buyers"
                description={
                  highRiskCustomers.length > 0
                    ? `${highRiskCustomers.length} customer${highRiskCustomers.length === 1 ? "" : "s"} currently need retention review.`
                    : "No customer currently crosses the high-risk threshold."
                }
                status={highRiskCustomers.length > 0 ? "failed" : "active"}
                action={{
                  content: highRiskCustomers.length > 0 ? "Review risky conversations" : "Open conversations",
                  url: "/app/conversations",
                  icon: ChatIcon,
                }}
              />
              <ActionCard
                title="Engaged buyers"
                description={
                  engagedCustomers.length > 0
                    ? `${engagedCustomers.length} customer${engagedCustomers.length === 1 ? "" : "s"} already have conversation history.`
                    : "No conversation-linked customers are visible yet."
                }
                status={engagedCustomers.length > 0 ? "active" : "pending"}
                action={{ content: "Inspect conversation health", url: "/app/conversations", icon: ChatIcon }}
              />
              <ActionCard
                title="Customer board"
                description="Review all customer segments and prioritize actions based on churn signals."
                status="info"
                action={{ content: "Open customer board", url: "/app/customers", icon: PersonIcon }}
              />
            </InlineGrid>
          </SectionCard>

          <SectionCard
            title="High-risk customers"
            subtitle="Prioritize buyers with the strongest churn signals first."
          >
            {highRiskCustomers.length > 0 ? (
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                {highRiskCustomers.map((customer) => (
                  <ActionCard
                    key={customer.id}
                    title={customer.name}
                    description={`${customer.phone} · ${customer.orderCount} orders · ${(customer.churnProbability || 0).toFixed(2)} churn risk`}
                    status="failed"
                    action={{ content: "Review buyer thread", url: "/app/conversations", icon: ChatIcon }}
                  />
                ))}
              </InlineGrid>
            ) : (
              <EmptyCard
                heading="No high-risk customers"
                description="No urgent retention queue right now. Continue monitoring conversation health."
                action={{ content: "Open conversations", url: "/app/conversations" }}
              />
            )}
          </SectionCard>

          <SectionCard
            title="Customer board"
            subtitle="Segments and risk should be legible enough for daily decisions."
          >
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              {sortedCustomers.map((customer) => (
                <ActionCard
                  key={customer.id}
                  title={customer.name}
                  description={`${customer.phone} · ${customer.orderCount} orders · ${customer.conversationCount} conversations · Segment ${customer.segment || "new"}`}
                  status={(customer.churnProbability || 0) >= 0.6 ? "failed" : customer.segment || "info"}
                  action={{ content: (customer.churnProbability || 0) >= 0.6 ? "Review buyer thread" : "View conversation context", url: "/app/conversations", icon: PersonIcon }}
                />
              ))}
            </InlineGrid>
          </SectionCard>
        </>
      ) : null}
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
