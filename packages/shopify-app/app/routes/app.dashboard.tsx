import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { CartIcon } from "@shopify/polaris-icons";
import { BlockStack, Button, InlineGrid, InlineStack, Text } from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { fetchMerchantOverviewFromRequest } from "../platform.server";
import {
  MetricCard,
  SectionCard,
  ShellPage,
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
  const setupChecklist = [
    {
      label: "Activate plan",
      value: hasBilling ? "✅ Done" : "❌ Required",
    },
    {
      label: "Add products",
      value: hasProducts ? "✅ Done" : hasBilling ? "❌ Required" : "🔒 Locked until plan activation",
    },
    {
      label: "Receive first order",
      value: hasOrders ? "✅ Done" : hasBilling && hasProducts ? "⏳ Pending" : "🔒 Locked until setup is ready",
    },
    {
      label: "Start conversations",
      value: hasBilling && hasProducts && hasOrders ? "✅ Active" : "🔒 Locked",
    },
  ];

  const ordersHint =
    data.metrics.totalOrders > 0
      ? "Orders currently visible to the retention engine."
      : "No orders yet — this will appear after your first sale";
  const activeUsersHint =
    data.metrics.activeUsers > 0
      ? "Customers ready for compliant messaging."
      : "No customers with consent yet";
  const productsHint =
    data.metrics.totalProducts > 0
      ? "Products available for automation workflows."
      : "No products ready — import products to enable automation";
  const responseHint =
    data.metrics.responseRate > 0
      ? "Replies sent vs. total buyer threads."
      : "Not available yet";
  const responseValue = data.metrics.responseRate > 0 ? `${data.metrics.responseRate}%` : "—";

  return (
    <ShellPage
      title="Dashboard"
      subtitle="Daily operating view for merchants after installation and initial setup."
    >
      <SectionCard
        title="Start using Recete"
        subtitle="Activate your plan to start automating customer conversations."
      >
        <BlockStack gap="300">
          <InlineStack>
            <Button
              variant="primary"
              icon={CartIcon}
              onClick={() => navigate("/app/billing")}
            >
              Activate Recete
            </Button>
          </InlineStack>
        </BlockStack>
      </SectionCard>

      <SectionCard
        title="Next step"
        subtitle="Complete this to unlock live workflow automation."
      >
        <BlockStack gap="300">
          <Text as="p" variant="bodyMd">
            {!hasBilling
              ? "Without activating your plan, Recete cannot process orders or send messages."
              : !hasProducts
                ? "Activation is complete. Next, add products so Recete can generate useful customer guidance."
                : !hasOrders
                  ? "Setup is ready. Recete will start working as soon as your first order arrives."
                  : "Recete is active. Continue monitoring conversations and buyer outcomes."}
          </Text>
          <InlineStack>
            <Button
              variant="secondary"
              onClick={() => navigate(!hasBilling ? "/app/billing" : !hasProducts ? "/app/products" : "/app/conversations")}
            >
              {!hasBilling ? "Review activation" : !hasProducts ? "Add products" : "View conversations"}
            </Button>
          </InlineStack>
        </BlockStack>
      </SectionCard>

      <SectionCard
        title="Setup progress"
        subtitle="Follow this checklist to complete onboarding."
      >
        <BlockStack gap="200">
          {setupChecklist.map((item) => (
            <InlineStack key={item.label} align="space-between" blockAlign="center">
              <Text as="p" variant="bodyMd">{item.label}</Text>
              <Text as="p" variant="bodyMd" tone="subdued">{item.value}</Text>
            </InlineStack>
          ))}
        </BlockStack>
      </SectionCard>

      <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
        <MetricCard label="Orders" value={data.metrics.totalOrders} hint={ordersHint} />
        <MetricCard label="Customers who allowed messages" value={data.metrics.activeUsers} hint={activeUsersHint} />
        <MetricCard label="Products ready" value={data.metrics.totalProducts} hint={productsHint} />
        <MetricCard label="Reply performance" value={responseValue} hint={responseHint} />
      </InlineGrid>

      <SectionCard
        title="Recent orders"
        subtitle="Latest order events seen by Recete."
      >
        {data.recentOrders.length > 0 ? (
          <BlockStack gap="200">
            {data.recentOrders.slice(0, 6).map((order) => (
              <InlineStack key={order.id} align="space-between" blockAlign="center">
                <Text as="p" variant="bodyMd">{order.external_order_id || order.id}</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {`${order.status} • ${new Intl.DateTimeFormat("en", {
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(order.created_at))}`}
                </Text>
              </InlineStack>
            ))}
          </BlockStack>
        ) : (
          <Text as="p" variant="bodyMd" tone="subdued">
            No orders yet — this will appear after your first sale.
          </Text>
        )}
      </SectionCard>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
