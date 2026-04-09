import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ChatIcon, PersonIcon } from "@shopify/polaris-icons";
import { InlineGrid } from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { fetchMerchantCustomers } from "../platform.server";
import { ActionCard, EmptyCard, MetricCard, SectionCard, ShellPage, StatePanel } from "../components/shell-ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);

  try {
    return await fetchMerchantCustomers(request, { page: 1, limit: 20 });
  } catch (error) {
    return {
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
  const engagedCount = customers.filter((item) => (item.conversationCount || 0) > 0).length;
  const customerState = unavailableReason
    ? {
        title: "Customer health is temporarily unavailable",
        body: "Risk and segment decisions should wait until the latest customer data loads.",
        tone: "warning" as const,
      }
    : highRiskCount > 0
      ? {
          title: "High-risk buyers need review",
          body: `${highRiskCount} customer${highRiskCount === 1 ? "" : "s"} currently show elevated churn risk.`,
          tone: "warning" as const,
        }
      : customers.length === 0
        ? {
            title: "No customer records yet",
            body: "Customer health will become useful after orders and conversations have synced.",
            tone: "info" as const,
          }
        : {
            title: "Customer board looks healthy",
            body: "Use this screen to spot edge cases, not to chase generic activity.",
            tone: "success" as const,
          };

  return (
    <ShellPage
      title="Customers"
      subtitle="Customer health, segment visibility, and churn risk inside Shopify Admin."
      primaryAction={{ content: highRiskCount > 0 ? "Review conversations" : "Open conversations", url: "/app/conversations", icon: ChatIcon }}
    >
      <StatePanel
        title={customerState.title}
        description={customerState.body}
        tone={customerState.tone === "warning" ? "attention" : customerState.tone}
        action={{ content: highRiskCount > 0 ? "Review risky conversations" : "Open conversations", url: "/app/conversations", icon: ChatIcon }}
      />
      <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
        <MetricCard label="Visible customers" value={data.total || customers.length} hint="Buyer records visible in the current shell batch." />
        <MetricCard label="At risk" value={highRiskCount} hint="Customers with high churn probability." />
        <MetricCard label="Engaged" value={engagedCount} hint="Customers with active conversation history." />
        <MetricCard label="Page size" value={data.limit || 20} hint="Customer records loaded for the current shell view." />
      </InlineGrid>

      <SectionCard
        title="Recommended customer actions"
        subtitle="Customer health only matters if the merchant can act on it quickly."
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
            title="General customer board"
            description="Use the full list below for broader review after the risk queue is under control."
            status="info"
            action={{ content: "Open full board", url: "/app/customers", icon: PersonIcon }}
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
            description="That means the merchant can spend less time on rescue work and more on routine review."
            action={{ content: "Open conversations", url: "/app/conversations" }}
          />
        )}
      </SectionCard>

      <SectionCard
        title="Customer board"
        subtitle="Segments and risk should be legible enough that the merchant does not need the old panel for basic buyer health review."
      >
        {sortedCustomers.length > 0 ? (
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
        ) : (
          <EmptyCard
            heading="No customer records yet"
            description="Customer health becomes useful after orders and conversations have been synced into the platform."
            action={{ content: "Check setup progress", url: "/app/dashboard" }}
          />
        )}
      </SectionCard>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
