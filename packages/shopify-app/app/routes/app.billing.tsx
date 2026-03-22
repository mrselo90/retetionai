import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Banner,
  Badge,
  BlockStack,
  Card,
  InlineGrid,
  InlineStack,
  List,
  Spinner,
  Text,
} from "@shopify/polaris";
import {
  GROWTH_MONTHLY_PLAN,
  GROWTH_YEARLY_PLAN,
  PRO_MONTHLY_PLAN,
  PRO_YEARLY_PLAN,
  STARTER_MONTHLY_PLAN,
  STARTER_YEARLY_PLAN,
} from "../shopify.server";
import { EmptyCard, SectionCard, ShellPage, StatusBadge } from "../components/shell-ui";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";

const ALL_PLAN_KEYS = [
  STARTER_MONTHLY_PLAN,
  STARTER_YEARLY_PLAN,
  GROWTH_MONTHLY_PLAN,
  GROWTH_YEARLY_PLAN,
  PRO_MONTHLY_PLAN,
  PRO_YEARLY_PLAN,
] as const;

const PLAN_TIERS = [
  {
    tier: "Starter",
    monthly: "$29/mo",
    yearly: "$290/yr",
    features: [
      "150 included chats per month",
      "Up to 20 recipes",
      "Shared WhatsApp number",
      "Basic analytics",
    ],
  },
  {
    tier: "Growth",
    monthly: "$69/mo",
    yearly: "$690/yr",
    recommended: true,
    features: [
      "1,000 included chats per month",
      "Up to 500 recipes",
      "AI vision for product photos",
      "Upsell links in conversations",
    ],
  },
  {
    tier: "Pro",
    monthly: "$199/mo",
    yearly: "$1,990/yr",
    features: [
      "3,000 included chats per month",
      "Unlimited recipes",
      "Advanced analytics",
      "Smart re-order engine",
      "Custom-branded WhatsApp number",
    ],
  },
] as const;

function extractBillingErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "errorData" in err) {
    const data = (err as { errorData: Array<{ message: string }> }).errorData;
    if (Array.isArray(data) && data.length > 0) {
      return data.map((e) => e.message).join("; ");
    }
  }
  return err instanceof Error ? err.message : "An unexpected billing error occurred.";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { billing } = await authenticateEmbeddedAdmin(request);
    const billingState = await billing.check({
      plans: [...ALL_PLAN_KEYS],
      isTest: process.env.NODE_ENV !== "production",
    });

    return {
      hasActivePayment: billingState.hasActivePayment,
      subscriptions: billingState.appSubscriptions.map((subscription) => ({
        id: subscription.id,
        name: subscription.name,
        status: subscription.status,
        lineItems: subscription.lineItems.length,
      })),
      error: null as string | null,
    };
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("[billing-loader]", err);
    return {
      hasActivePayment: false,
      subscriptions: [] as Array<{ id: string; name: string; status: string; lineItems: number }>,
      error: extractBillingErrorMessage(err),
    };
  }
};

export default function BillingPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  const activePlanName = data.subscriptions.find(
    (s) => s.status === "ACTIVE" || s.status === "ACCEPTED",
  )?.name;

  return (
    <ShellPage
      title="Billing"
      subtitle="Your subscription is managed by Shopify. Compare plans below and upgrade from the Shopify App Store."
    >
      {navigation.state !== "idle" ? <Spinner accessibilityLabel="Loading" size="small" /> : null}

      {data.error ? (
        <Banner title="Unable to load billing status" tone="warning">
          {data.error}
        </Banner>
      ) : null}

      <SectionCard
        title="Current subscription"
        badge={
          <Badge tone={data.hasActivePayment ? "success" : "attention"}>
            {data.hasActivePayment ? "Active" : "No active plan"}
          </Badge>
        }
      >
        {data.subscriptions.length > 0 ? (
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {data.subscriptions.map((subscription) => (
              <Card key={subscription.id} padding="500">
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">{subscription.name}</Text>
                  <StatusBadge status={subscription.status}>{subscription.status}</StatusBadge>
                </BlockStack>
              </Card>
            ))}
          </InlineGrid>
        ) : (
          <EmptyCard
            heading="No active subscription"
            description="Install a plan from the Shopify App Store to unlock retention features."
          />
        )}
      </SectionCard>

      <Banner title="How to change your plan" tone="info">
        Your subscription is managed through Shopify. To upgrade, downgrade, or cancel
        your plan, visit the app listing on the Shopify App Store and choose a new plan
        from there. Changes take effect immediately.
      </Banner>

      <SectionCard
        title="Compare plans"
        subtitle="All plans include WhatsApp-based retention messaging, RAG-powered product answers, and usage-based overage billing capped at $500."
      >
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          {PLAN_TIERS.map((plan) => {
            const isCurrentTier = activePlanName?.toLowerCase().includes(plan.tier.toLowerCase());
            return (
              <Card key={plan.tier} padding="500" background={isCurrentTier ? "bg-surface-success" : undefined}>
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <InlineStack gap="200" align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingLg">{plan.tier}</Text>
                      {plan.recommended ? <Badge tone="success">Recommended</Badge> : null}
                      {isCurrentTier ? <Badge tone="info">Current</Badge> : null}
                    </InlineStack>
                    <InlineStack gap="200">
                      <Badge tone="info">{plan.monthly}</Badge>
                      <Badge>{plan.yearly}</Badge>
                    </InlineStack>
                  </BlockStack>

                  <List>
                    {plan.features.map((feature) => (
                      <List.Item key={feature}>{feature}</List.Item>
                    ))}
                  </List>
                </BlockStack>
              </Card>
            );
          })}
        </InlineGrid>
      </SectionCard>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
