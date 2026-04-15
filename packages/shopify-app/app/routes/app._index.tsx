import type { HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { CartIcon, CatalogIcon, ConnectIcon, SettingsIcon, ViewIcon } from "@shopify/polaris-icons";
import { Badge, BlockStack, Box, Button, Card, InlineGrid, InlineStack, List, Text } from "@shopify/polaris";
import { ShellPage } from "../components/shell-ui";
import { getSetupProgress } from "../lib/setupProgress";
import type { ShopifyMerchantOverview } from "../platform.server";
import { useAppBootstrapData } from "./app";

type SetupStepStatus = "done" | "in_progress" | "not_started";

type SetupStep = {
  id: string;
  title: string;
  description: string;
  to: string;
  icon: typeof CartIcon;
  status: SetupStepStatus;
};

export default function Index() {
  const { bootstrapData, bootstrapError, shellLoading } = useAppBootstrapData();
  const data = bootstrapData?.overview;

  if (!data) {
    return (
      <ShellPage
        title="Welcome to Recete"
        subtitle="Complete setup to start using Recete."
      >
        <Card padding="500">
          <Text as="p" variant="bodyMd" tone="subdued">
            {bootstrapError
              ? `Shopify bootstrap error: ${bootstrapError}`
              : shellLoading
                ? "Preparing your setup workspace."
                : "Setup data is not ready yet."}
          </Text>
        </Card>
      </ShellPage>
    );
  }

  return <SetupOverview data={data} billingApproved={bootstrapData?.billingApproved} />;
}

function SetupOverview({
  data,
  billingApproved,
}: {
  data: ShopifyMerchantOverview;
  billingApproved?: boolean;
}) {
  const progress = getSetupProgress(data, billingApproved);

  const steps: SetupStep[] = [
    {
      id: "billing",
      title: "Step 1: Approve billing",
      description: "Activate your plan to unlock the rest of setup.",
      to: "/app/billing",
      icon: CartIcon,
      status: progress.hasBilling ? "done" : "in_progress",
    },
    {
      id: "products",
      title: "Step 2: Add products",
      description: "Sync products so Recete can generate product-aware guidance.",
      to: "/app/products",
      icon: CatalogIcon,
      status: progress.hasProducts ? "done" : progress.hasBilling ? "in_progress" : "not_started",
    },
    {
      id: "messaging",
      title: "Step 3: Enable messaging",
      description: "Configure bot behavior and WhatsApp messaging.",
      to: "/app/settings",
      icon: SettingsIcon,
      status: progress.hasMessagingConfigured ? "done" : progress.hasBilling && progress.hasProducts ? "in_progress" : "not_started",
    },
    {
      id: "orders",
      title: "Step 4: Activate order flow",
      description: "Create and fulfill a Shopify test order to start live events.",
      to: "/app/integrations#orders-flow",
      icon: ConnectIcon,
      status: progress.hasOrders ? "done" : progress.hasBilling && progress.hasProducts && progress.hasMessagingConfigured ? "in_progress" : "not_started",
    },
  ];

  const completedCount = steps.filter((step) => step.status === "done").length;
  const setupComplete = completedCount === steps.length;
  const readinessPercent = Math.round((completedCount / steps.length) * 100);
  const nextStep = steps.find((step) => step.status !== "done") || null;

  return (
    <ShellPage
      title={setupComplete ? "Recete is ready" : "Welcome to Recete"}
      subtitle={
        setupComplete
          ? "Setup is complete. You can now run daily operations."
          : "Complete setup to start using Recete."
      }
      primaryAction={
        setupComplete
          ? { content: "Open dashboard", url: "/app/dashboard", icon: ViewIcon }
          : { content: "Continue setup", url: nextStep?.to || "/app/billing", icon: nextStep?.icon || CartIcon }
      }
    >
      <Card padding="500" roundedAbove="sm">
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center" wrap>
            <Text as="h2" variant="headingLg">Welcome to Recete</Text>
            <Badge tone={setupComplete ? "success" : "attention"}>
              {setupComplete ? "Ready to go live" : "In progress"}
            </Badge>
          </InlineStack>
          <Box maxWidth="42rem">
            <Text as="p" variant="bodyMd" tone="subdued">
              {`You are ${readinessPercent}% ready to go live.`}
            </Text>
          </Box>
          <List>
            <List.Item>Guide customers after purchase with clear product instructions.</List.Item>
            <List.Item>Automate WhatsApp conversations with your bot settings.</List.Item>
            <List.Item>Increase repeat orders with better post-purchase support.</List.Item>
          </List>
        </BlockStack>
      </Card>

      <Card padding="500" roundedAbove="sm">
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center" wrap>
            <Text as="h2" variant="headingMd">Setup checklist</Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {`${completedCount}/${steps.length} completed`}
            </Text>
          </InlineStack>

          <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
            {steps.map((step) => (
              <Card key={step.id} padding="300" roundedAbove="sm" background={step.status === "done" ? "bg-surface-success" : undefined}>
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h3" variant="headingSm">{step.title}</Text>
                    <Badge tone={statusTone(step.status)}>
                      {step.status === "done" ? "Done" : step.status === "in_progress" ? "In progress" : "Not started"}
                    </Badge>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">{step.description}</Text>
                  <InlineStack>
                    <Button url={step.to} variant="tertiary" icon={step.icon}>
                      Open step
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            ))}
          </InlineGrid>
        </BlockStack>
      </Card>
    </ShellPage>
  );
}

function statusTone(status: SetupStepStatus): "success" | "attention" | "info" {
  if (status === "done") return "success";
  if (status === "in_progress") return "attention";
  return "info";
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
