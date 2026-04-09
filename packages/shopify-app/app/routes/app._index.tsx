import type { HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { CartIcon, CatalogIcon, ConnectIcon, SettingsIcon, ViewIcon } from "@shopify/polaris-icons";
import { Badge, BlockStack, Box, Button, Card, InlineGrid, InlineStack, List, Text } from "@shopify/polaris";
import {
  ActionCard,
  MetricCard,
  SectionCard,
  ShellPage,
  StatusBadge,
} from "../components/shell-ui";
import type { ShopifyMerchantOverview } from "../platform.server";
import { useAppBootstrapData } from "./app";

export default function Index() {
  const { bootstrapData, bootstrapError, shellLoading } = useAppBootstrapData();
  const data = bootstrapData?.overview;

  if (!data) {
    return (
      <ShellPage
        title="Overview"
        subtitle="Merchant launch status and the fastest route to a usable retention workflow."
        primaryAction={{ content: "Open dashboard", url: "/app/dashboard", icon: CartIcon }}
      >
        <Card padding="500">
          <Text as="p" variant="bodyMd" tone="subdued">
            {bootstrapError
              ? `Shopify bootstrap error: ${bootstrapError}`
              : shellLoading
                ? "Waiting for Shopify session-token bootstrap."
                : "Shopify bootstrap has not completed yet."}
          </Text>
        </Card>
      </ShellPage>
    );
  }

  return (
    <ShellPage
      title="Overview"
      subtitle="Merchant launch status and the fastest route to a usable retention workflow."
      primaryAction={{ content: "Open dashboard", url: "/app/dashboard", icon: CartIcon }}
    >
      <OverviewContent data={data} />
    </ShellPage>
  );
}

function OverviewContent({ data }: { data: ShopifyMerchantOverview }) {
  const hasBilling = (data.subscription?.status || "").toLowerCase() === "active";
  const hasCatalog = data.metrics.totalProducts > 0;
  const hasOrders = data.metrics.totalOrders > 0;
  const hasBotSettings = Boolean(data.settings?.personaSettings?.bot_name);
  const completedCount = [hasBilling, hasCatalog, hasOrders, hasBotSettings].filter(Boolean).length;
  const nextAction = !hasBilling
    ? { label: "Approve billing", url: "/app/billing", icon: CartIcon }
    : !hasCatalog
      ? { label: "Prepare products", url: "/app/products", icon: CatalogIcon }
      : !hasBotSettings
        ? { label: "Review settings", url: "/app/settings", icon: SettingsIcon }
        : !hasOrders
          ? { label: "Check integrations", url: "/app/integrations", icon: ConnectIcon }
          : { label: "Open dashboard", url: "/app/dashboard", icon: ViewIcon };

  return (
    <>
      <Card padding="400">
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingMd">
              {completedCount === 4 ? "Launch is in a healthy state" : "Finish setup before treating the app as live"}
            </Text>
            <Badge tone={completedCount === 4 ? "success" : "attention"}>
              {completedCount === 4 ? "Ready" : "Action needed"}
            </Badge>
          </InlineStack>
          <Text as="p" variant="bodyMd" tone="subdued">
            {completedCount === 4
              ? "Core setup is complete. Daily operations can move to dashboard, conversations, and customers."
              : "Billing, catalog, messaging, and order flow should be clear before the merchant relies on the app day to day."}
          </Text>
          <div>
            <Button url={nextAction.url} icon={nextAction.icon as never}>
              {completedCount === 4 ? "Open dashboard" : "Continue setup"}
            </Button>
          </div>
        </BlockStack>
      </Card>

      <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
        <MetricCard
          label="Orders"
          value={data.metrics.totalOrders}
          hint="Imported orders currently visible in the platform."
        />
        <MetricCard
          label="Active users"
          value={data.metrics.activeUsers}
          hint={
            data.metrics.activeUsers === 0
              ? "No consent-safe customers yet — this will populate as orders come in."
              : "Customers currently eligible for consent-safe engagement."
          }
        />
        <MetricCard
          label="Products"
          value={data.metrics.totalProducts}
          hint="Catalog rows visible for scraping and enrichment."
        />
        <MetricCard
          label="Response rate"
          value={`${data.metrics.responseRate}%`}
          hint="Replies sent vs. total buyer threads."
        />
      </InlineGrid>

      <SectionCard
        title="Setup status"
        subtitle="A compact launch checklist reads better than a dense dashboard."
        badge={<StatusBadge status={completedCount === 4 ? "active" : "pending"}>{`${completedCount}/4 complete`}</StatusBadge>}
      >
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <Card padding="400">
            <Text as="h3" variant="headingMd">
              Checklist
            </Text>
            <div style={{ marginTop: "0.75rem" }}>
              <List>
                <List.Item>
                  Billing: {hasBilling ? "approved" : "pending"}
                </List.Item>
                <List.Item>
                  Catalog: {hasCatalog ? `${data.metrics.totalProducts} products available` : "no products prepared yet"}
                </List.Item>
                <List.Item>
                  Messaging: {hasBotSettings ? "settings saved" : "bot settings not reviewed yet"}
                </List.Item>
                <List.Item>
                  Orders: {hasOrders ? `${data.metrics.totalOrders} orders visible` : "no order activity yet"}
                </List.Item>
              </List>
            </div>
          </Card>
          <ActionCard
            title="Next step"
            description={
              completedCount === 4
                ? "Setup is complete. Move into daily review and optimization."
                : "Use the next action as the shortest route to launch readiness."
            }
            status={completedCount === 4 ? "active" : "pending"}
            action={{ content: nextAction.label, url: nextAction.url, icon: nextAction.icon }}
          />
        </InlineGrid>
      </SectionCard>

      <SectionCard
        title="Recommended actions"
        subtitle="Use concise action cards instead of an overloaded launch dashboard."
      >
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          <ActionCard
            title="Catalog"
            description={hasCatalog ? "Catalog is ready for scraping and enrichment." : "Product readiness still blocks strong AI answers."}
            status={hasCatalog ? "active" : "pending"}
            action={{ content: hasCatalog ? "Open products" : "Prepare products", url: "/app/products", icon: CatalogIcon }}
          />
          <ActionCard
            title="Billing"
            description={hasBilling ? "Plan approval is no longer blocking merchant setup." : "Billing approval is still the main conversion checkpoint."}
            status={hasBilling ? "active" : "pending"}
            action={hasBilling ? { content: "Review billing", url: "/app/billing", icon: CartIcon } : undefined}
          />
          <ActionCard
            title="Messaging"
            description={hasBotSettings ? "Bot tone and behavior are configured." : "Messaging settings still need review before live conversations feel trustworthy."}
            status={hasBotSettings ? "active" : "attention"}
            action={{ content: hasBotSettings ? "Open settings" : "Configure settings", url: "/app/settings", icon: SettingsIcon }}
          />
        </InlineGrid>
      </SectionCard>
      <Box paddingBlockStart="300">
        <Text as="p" variant="bodySm" tone="subdued">
          Want more control? Adjust bot behavior in Settings or prepare your catalog in Products.
        </Text>
      </Box>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
