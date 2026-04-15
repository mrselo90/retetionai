import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { CartIcon } from "@shopify/polaris-icons";
import { BlockStack, Button, InlineGrid, InlineStack, Text } from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { getSetupProgress } from "../lib/setupProgress";
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
  const progress = getSetupProgress(data);
  const hasBilling = progress.hasBilling;
  const hasProducts = progress.hasProducts;
  const hasOrders = progress.hasOrders;
  const hasMessagingConfigured = progress.hasMessagingConfigured;

  const setupSteps = [
    {
      label: "Activate plan",
      complete: hasBilling,
      value: hasBilling ? "✅ Completed" : "❌ Required",
      blockedHint: "Required before setup can continue",
    },
    {
      label: "Add or sync products",
      complete: hasProducts,
      value: hasProducts
        ? "✅ Completed"
        : hasBilling
          ? "❌ Required"
          : "🔒 Available after plan activation",
      blockedHint: "Unlocks after plan activation",
    },
    {
      label: "Configure messaging",
      complete: hasMessagingConfigured,
      value: hasMessagingConfigured
        ? "✅ Completed"
        : hasBilling && hasProducts
          ? "❌ Required"
          : "🔒 Unlocks after products are added",
      blockedHint: "Unlocks after products are added",
    },
    {
      label: "Receive first order",
      complete: hasOrders,
      value: hasOrders
        ? "✅ Completed"
        : hasBilling && hasProducts && hasMessagingConfigured
          ? "⏳ Pending"
          : "🔒 Available after setup is complete",
      blockedHint: "Available after setup is complete",
    },
  ];
  const completedStepCount = setupSteps.filter((step) => step.complete).length;
  const setupComplete = completedStepCount === setupSteps.length;

  const currentStep = !hasBilling
    ? {
        title: "Activate plan",
        description: "Plan activation is required before Recete can process orders or send messages.",
        ctaLabel: "Activate plan",
        ctaUrl: "/app/billing",
        unlocks: "After activation, product setup will unlock.",
      }
    : !hasProducts
      ? {
          title: "Add or sync products",
          description: "Recete needs product data to generate accurate post-purchase guidance.",
          ctaLabel: "Add products",
          ctaUrl: "/app/products",
          unlocks: "After products are ready, messaging configuration will unlock.",
        }
      : !hasMessagingConfigured
        ? {
            title: "Configure messaging",
            description: "Set bot behavior and messaging so Recete can start customer communication.",
            ctaLabel: "Configure messaging",
            ctaUrl: "/app/settings",
            unlocks: "After messaging setup, Recete waits for your first order.",
          }
        : !hasOrders
          ? {
              title: "Receive first order",
              description: "Setup is complete. Recete will start conversations automatically after the first order event.",
              ctaLabel: "Review order flow",
              ctaUrl: "/app/integrations#orders-flow",
              unlocks: "After first order, the live dashboard and conversations become active.",
            }
          : null;

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
      title={setupComplete ? "Dashboard" : "Getting started"}
      subtitle={
        setupComplete
          ? "Daily operating view for live Recete activity."
          : `Setup overview · ${completedStepCount} of ${setupSteps.length} steps completed`
      }
    >
      {!setupComplete && currentStep ? (
        <>
          <SectionCard
            title={`Current step: ${currentStep.title}`}
            subtitle={currentStep.description}
          >
            <BlockStack gap="300">
              <InlineStack>
                <Button
                  variant="primary"
                  icon={CartIcon}
                  onClick={() => navigate(currentStep.ctaUrl)}
                >
                  {currentStep.ctaLabel}
                </Button>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                {currentStep.unlocks}
              </Text>
            </BlockStack>
          </SectionCard>

          <SectionCard
            title="Setup steps"
            subtitle="Complete steps in order. Later steps unlock automatically."
          >
            <BlockStack gap="200">
              {setupSteps.map((step, index) => (
                <InlineStack key={step.label} align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">{`${index + 1}. ${step.label}`}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">{step.value}</Text>
                </InlineStack>
              ))}
            </BlockStack>
          </SectionCard>

          <SectionCard
            title="Live dashboard preview"
            subtitle="These insights appear automatically after setup is complete."
          >
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" tone="subdued">
                Orders, customers, and reply performance are hidden until onboarding is completed and first order data arrives.
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {`Current status: ${completedStepCount} of ${setupSteps.length} setup steps completed.`}
              </Text>
            </BlockStack>
          </SectionCard>
        </>
      ) : (
        <>
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
        </>
      )}
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
