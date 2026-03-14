import { useSubmit } from "react-router";
import { Banner, BlockStack, Box, Button, Card, Text } from "@shopify/polaris";
import type { PlanType } from "@prisma/client";
import type { PlanKey } from "../services/planDefinitions";

export function PlanGate({
  blocked,
  requiredPlan,
  upgradePlan,
  title,
  message,
  children,
}: {
  blocked: boolean;
  requiredPlan: PlanType;
  upgradePlan: PlanKey;
  title: string;
  message: string;
  children: React.ReactNode;
}) {
  const submit = useSubmit();

  const requestUpgrade = () => {
    const formData = new FormData();
    formData.set("plan", upgradePlan);
    submit(formData, { method: "post", action: "/app/billing" });
  };

  if (!blocked) {
    return <>{children}</>;
  }

  return (
    <BlockStack gap="300">
      <Banner
        tone="warning"
        title={`${title} requires the ${requiredPlan} plan`}
        action={{ content: `Upgrade to ${requiredPlan}`, onAction: requestUpgrade }}
      >
        <Text as="p" variant="bodyMd">
          {message}
        </Text>
      </Banner>
      <Card padding="500">
        <Box opacity="0.55">
          <BlockStack gap="300">
            {children}
            <Button onClick={requestUpgrade} variant="secondary">
              Upgrade to {requiredPlan}
            </Button>
          </BlockStack>
        </Box>
      </Card>
    </BlockStack>
  );
}
