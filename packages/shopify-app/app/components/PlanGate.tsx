import { Banner, BlockStack, Box, Button, Card, Text } from "@shopify/polaris";
import type { PlanType } from "@prisma/client";
import type { PlanKey } from "../services/planDefinitions";

export function PlanGate({
  blocked,
  requiredPlan,
  upgradePlan,
  upgradeUrl,
  title,
  message,
  children,
}: {
  blocked: boolean;
  requiredPlan: PlanType;
  upgradePlan: PlanKey;
  upgradeUrl?: string;
  title: string;
  message: string;
  children: React.ReactNode;
}) {
  const requestUpgrade = () => {
    const targetUrl = upgradeUrl || `/app/billing?plan=${encodeURIComponent(upgradePlan)}`;
    window.open(targetUrl, "_top");
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
            <Button
              onClick={requestUpgrade}
              url={upgradeUrl}
              target="_top"
              variant="secondary"
            >
              Upgrade to {requiredPlan}
            </Button>
          </BlockStack>
        </Box>
      </Card>
    </BlockStack>
  );
}
