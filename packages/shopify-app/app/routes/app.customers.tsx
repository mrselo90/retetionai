import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ChatIcon, PersonIcon } from "@shopify/polaris-icons";
import { InlineGrid } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { fetchMerchantCustomers } from "../platform.server";
import { ActionCard, EmptyCard, MetricCard, SectionCard, ShellPage } from "../components/shell-ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

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
  const highRiskCount = customers.filter((item) => (item.churnProbability || 0) >= 0.6).length;
  const engagedCount = customers.filter((item) => (item.conversationCount || 0) > 0).length;

  return (
    <ShellPage
      title="Customers"
      subtitle="Customer health, segment visibility, and churn risk inside Shopify Admin."
      primaryAction={{ content: "Open conversations", url: "/app/conversations", icon: ChatIcon }}
    >
      <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
        <MetricCard label="Visible customers" value={data.total || customers.length} hint="Buyer records visible in the current shell batch." />
        <MetricCard label="At risk" value={highRiskCount} hint="Customers with high churn probability." />
        <MetricCard label="Engaged" value={engagedCount} hint="Customers with active conversation history." />
        <MetricCard label="Page size" value={data.limit || 20} hint="Customer records loaded for the current shell view." />
      </InlineGrid>

      <SectionCard
        title="Customer board"
        subtitle="Segments and risk should be legible enough that the merchant does not need the old panel for basic buyer health review."
      >
        {customers.length > 0 ? (
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {customers.map((customer) => (
              <ActionCard
                key={customer.id}
                title={customer.name}
                description={`${customer.phone} · ${customer.orderCount} orders · ${customer.conversationCount} conversations · Segment ${customer.segment || "new"}`}
                status={(customer.churnProbability || 0) >= 0.6 ? "failed" : customer.segment || "info"}
                action={{ content: "Open conversations", url: "/app/conversations", icon: PersonIcon }}
              />
            ))}
          </InlineGrid>
        ) : (
          <EmptyCard
            heading="No customer records yet"
            description="Customer health becomes useful after orders and conversations have been synced into the platform."
            action={{ content: "Review dashboard", url: "/app/dashboard" }}
          />
        )}
      </SectionCard>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
