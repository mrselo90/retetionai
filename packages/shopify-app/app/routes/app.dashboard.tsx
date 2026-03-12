import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AlertTriangleIcon, CartIcon, CatalogIcon, SettingsIcon } from "@shopify/polaris-icons";
import { EmptyState, InlineGrid } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { fetchMerchantOverviewFromRequest } from "../platform.server";
import {
  ActionCard,
  DetailRows,
  MetricCard,
  SectionCard,
  ShellPage,
  StatusBadge,
} from "../components/shell-ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return fetchMerchantOverviewFromRequest(request);
};

export default function DashboardPage() {
  const data = useLoaderData<typeof loader>();
  const hasBilling = data.subscription?.status === "active";
  const hasProducts = data.metrics.totalProducts > 0;
  const hasOrders = data.metrics.totalOrders > 0;
  const completedSteps = [hasBilling, hasProducts, hasOrders].filter(Boolean).length;

  return (
    <ShellPage
      title="Dashboard"
      subtitle="High-signal merchant operations, setup status, and daily workflow readiness."
      primaryAction={{ content: "Review products", url: "/app/products", icon: CatalogIcon }}
    >
      <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
        <MetricCard label="Orders" value={data.metrics.totalOrders} hint="Orders currently visible to the retention engine." />
        <MetricCard label="Consent-active users" value={data.metrics.activeUsers} hint="Eligible customers available for compliant messaging." />
        <MetricCard label="Catalog rows" value={data.metrics.totalProducts} hint="Products available for scraping, embeddings, and recipe logic." />
        <MetricCard label="Response rate" value={`${data.metrics.responseRate}%`} hint="Conversation reply coverage across buyer threads." />
      </InlineGrid>

      <SectionCard
        title="Launch checklist"
        subtitle="This should replace the old mental model of bouncing between multiple admin areas."
        badge={
          <StatusBadge status={completedSteps === 3 ? "active" : "pending"}>
            {`${completedSteps}/3 complete`}
          </StatusBadge>
        }
      >
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          <ActionCard
            title="Billing"
            description={hasBilling ? "Approved and ready for paid merchant usage." : "Still needs approval before core features should be considered active."}
            action={{ content: "Open billing", url: "/app/billing", icon: CartIcon }}
            status={hasBilling ? "active" : "pending"}
          />
          <ActionCard
            title="Catalog"
            description={hasProducts ? `${data.metrics.totalProducts} products are available.` : "No useful catalog rows yet. Add and scrape products first."}
            action={{ content: "Open products", url: "/app/products", icon: CatalogIcon }}
            status={hasProducts ? "active" : "pending"}
          />
          <ActionCard
            title="Messaging controls"
            description={hasOrders ? "Orders are flowing. Review tone and delivery settings now." : "No fulfilled order activity is visible yet."}
            action={{ content: "Open settings", url: "/app/settings", icon: SettingsIcon }}
            status={hasOrders ? "active" : "attention"}
          />
        </InlineGrid>
      </SectionCard>

      <SectionCard
        title="Operational focus"
        subtitle="Merchants should understand what to fix next without needing the legacy panel."
      >
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <DetailRows
            rows={[
              { label: "Billing", value: hasBilling ? "Approved" : "Needs approval" },
              { label: "Catalog", value: hasProducts ? "Ready for AI flows" : "Needs product work" },
              { label: "Orders", value: hasOrders ? "Receiving events" : "No fulfilled order signal yet" },
              { label: "Conversation quality", value: `${data.metrics.responseRate}% response rate` },
            ]}
          />
          {data.recentOrders.length > 0 ? (
            <DetailRows
              rows={data.recentOrders.slice(0, 4).map((order) => ({
                label: order.external_order_id || order.id,
                value: order.status,
              }))}
            />
          ) : (
            <EmptyState
              heading="No recent orders"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              action={{ content: "Review integrations", url: "/app/integrations" }}
            >
              No fulfilled orders have reached the retention engine yet.
            </EmptyState>
          )}
        </InlineGrid>
      </SectionCard>

      <SectionCard
        title="Merchant attention"
        subtitle="Use clear escalation language instead of vague dashboard summaries."
        badge={<StatusBadge status={data.metrics.responseRate >= 25 ? "active" : "failed"}>{data.metrics.responseRate >= 25 ? "Healthy" : "Needs work"}</StatusBadge>}
      >
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <ActionCard
            title="Response quality"
            description={
              data.metrics.responseRate >= 25
                ? "Response rate is healthy enough for normal merchant review."
                : "Low response rate usually means product quality, timing, or message relevance needs work."
            }
            action={{ content: "Open analytics", url: "/app/analytics", icon: AlertTriangleIcon }}
            status={data.metrics.responseRate >= 25 ? "active" : "failed"}
          />
          <ActionCard
            title="Buyer operations"
            description="Use conversations and customers as the daily operational surfaces after setup is complete."
            action={{ content: "Open conversations", url: "/app/conversations", icon: AlertTriangleIcon }}
            status="info"
          />
        </InlineGrid>
      </SectionCard>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
