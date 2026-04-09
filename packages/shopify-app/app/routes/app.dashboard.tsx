import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AlertTriangleIcon, CartIcon, CatalogIcon, SettingsIcon } from "@shopify/polaris-icons";
import { BlockStack, Button, InlineGrid, InlineStack, Text } from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { fetchMerchantOverviewFromRequest } from "../platform.server";
import {
  DetailRows,
  MetricCard,
  SectionCard,
  ShellPage,
  StatePanel,
  StatusBadge,
} from "../components/shell-ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  return fetchMerchantOverviewFromRequest(request);
};

export default function DashboardPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const hasBilling = data.subscription?.status === "active";
  const hasProducts = data.metrics.totalProducts > 0;
  const hasOrders = data.metrics.totalOrders > 0;
  const hasHealthyResponseRate = data.metrics.responseRate >= 25;
  const activeUsersHint =
    data.metrics.activeUsers > 0
      ? "Eligible customers available for compliant messaging."
      : "No consent-safe customers yet — this will populate as orders come in.";
  const todayPriority = !hasBilling
    ? {
        title: "Choose a plan",
        description: "Select a Shopify plan when you are ready to launch.",
        status: "pending",
        action: { content: "Open billing", url: "/app/billing", icon: CartIcon },
      }
    : !hasProducts
      ? {
          title: "Prepare the catalog",
          description: "Products need to be present and usable before AI workflows feel trustworthy.",
          status: "pending",
          action: { content: "Open products", url: "/app/products", icon: CatalogIcon },
        }
      : data.metrics.responseRate < 25
        ? {
            title: "Improve response quality",
            description: "Response quality needs attention before scaling daily volume.",
            status: "failed",
            action: { content: "Open analytics", url: "/app/analytics", icon: AlertTriangleIcon },
          }
        : {
            title: "Review buyer operations",
            description: "Core setup is healthy. Keep conversations and customers under routine review.",
            status: "active",
            action: { content: "Open conversations", url: "/app/conversations", icon: AlertTriangleIcon },
          };
  const primaryBlocker = !hasBilling
    ? {
        title: "Choose a Shopify plan",
        body: "Select a plan in Shopify when you are ready to make the app live.",
        tone: "warning" as const,
      }
    : !hasProducts
      ? {
          title: "Catalog setup is still incomplete",
          body: "The merchant needs usable products before AI answers, scraping, and recipe workflows can feel trustworthy.",
          tone: "warning" as const,
        }
      : !hasOrders
        ? {
            title: "No order activity is visible yet",
            body: "The app is configured, but retention workflows stay quiet until orders start flowing in.",
            tone: "info" as const,
          }
        : data.metrics.responseRate < 25
          ? {
              title: "Merchant attention is needed",
              body: "Low response rate usually points to product quality, settings, timing, or message relevance issues.",
              tone: "critical" as const,
            }
          : null;
  const quickActions = [
    { content: "Open products", url: "/app/products", icon: CatalogIcon },
    { content: "Adjust settings", url: "/app/settings", icon: SettingsIcon },
    { content: "Open conversations", url: "/app/conversations", icon: AlertTriangleIcon },
  ];

  return (
    <ShellPage
      title="Dashboard"
      subtitle="Daily operating view for merchants after installation and initial setup."
      primaryAction={todayPriority.action}
    >
      {primaryBlocker ? (
        <StatePanel
          title={primaryBlocker.title}
          description={primaryBlocker.body}
          tone={primaryBlocker.tone === "warning" ? "attention" : primaryBlocker.tone}
          action={todayPriority.action}
        />
      ) : null}

      <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
        <MetricCard label="Orders" value={data.metrics.totalOrders} hint="Orders currently visible to the retention engine." />
        <MetricCard label="Consent-active users" value={data.metrics.activeUsers} hint={activeUsersHint} />
        <MetricCard label="Catalog rows" value={data.metrics.totalProducts} hint="Products available for scraping, embeddings, and recipe logic." />
        <MetricCard label="Response rate" value={`${data.metrics.responseRate}%`} hint="Replies sent vs. total buyer threads." />
      </InlineGrid>

      <SectionCard
        title="Next focus"
        subtitle="Complete one clear action at a time."
        badge={<StatusBadge status={todayPriority.status}>{todayPriority.status === "active" ? "Healthy" : "Needs action"}</StatusBadge>}
      >
        <BlockStack gap="300">
          <Text as="h3" variant="headingMd">
            {todayPriority.title}
          </Text>
          <Text as="p" variant="bodyMd">
            {todayPriority.description}
          </Text>
          <InlineStack gap="300" wrap>
            <Button
              variant="primary"
              icon={todayPriority.action.icon as never}
              onClick={() => navigate(todayPriority.action.url)}
            >
              {todayPriority.action.content}
            </Button>
            {quickActions
              .filter((action) => action.url !== todayPriority.action.url)
              .slice(0, 2)
              .map((action) => (
                <Button key={action.url} variant="tertiary" icon={action.icon as never} onClick={() => navigate(action.url)}>
                  {action.content}
                </Button>
              ))}
          </InlineStack>
        </BlockStack>
      </SectionCard>

      <SectionCard
        title="System status"
        subtitle="One-line health view for launch and daily operations."
      >
        <DetailRows
          rows={[
            { label: "Billing", value: hasBilling ? "Approved" : "Needs approval" },
            { label: "Catalog", value: hasProducts ? "Ready" : "Needs setup" },
            { label: "Orders", value: hasOrders ? "Receiving events" : "Waiting for first orders" },
            {
              label: "Conversation quality",
              value: hasHealthyResponseRate ? `${data.metrics.responseRate}% healthy` : `${data.metrics.responseRate}% needs attention`,
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        title="Recent orders"
        subtitle="Latest order events seen by Recete."
      >
        {data.recentOrders.length > 0 ? (
          <DetailRows
            rows={data.recentOrders.slice(0, 6).map((order) => ({
              label: order.external_order_id || order.id,
              value: `${order.status} • ${new Intl.DateTimeFormat("en", {
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(order.created_at))}`,
            }))}
          />
        ) : (
          <Text as="p" variant="bodyMd" tone="subdued">
            Order events will appear here after the first fulfilled orders sync.
          </Text>
        )}
      </SectionCard>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
