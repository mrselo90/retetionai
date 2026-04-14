import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Banner,
  Badge,
  BlockStack,
  Button,
  Card,
  EmptyState,
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
import { isPlanKey } from "../services/planDefinitions";
import { SectionCard, ShellPage, StatusBadge } from "../components/shell-ui";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";

const ALL_PLAN_KEYS = [
  STARTER_MONTHLY_PLAN,
  STARTER_YEARLY_PLAN,
  GROWTH_MONTHLY_PLAN,
  GROWTH_YEARLY_PLAN,
  PRO_MONTHLY_PLAN,
  PRO_YEARLY_PLAN,
] as const;

function getStoreHandle(shop: string) {
  return shop.replace(/\.myshopify\.com$/i, "");
}

function getManagedPricingUrl(shop: string) {
  const storeHandle = getStoreHandle(shop);
  const appHandle = process.env.SHOPIFY_MANAGED_PRICING_APP_HANDLE?.trim() || "blackeagle";
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}

const PLAN_TIERS: ReadonlyArray<{
  tier: string;
  monthly: string;
  yearly: string;
  recommended?: boolean;
  features: readonly string[];
}> = [
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
    const url = new URL(request.url);
    const requestedPlan = String(
      url.searchParams.get("plan") || url.searchParams.get("upgradePlan") || "",
    ).trim();
    const { billing, session } = await authenticateEmbeddedAdmin(request);
    const billingState = await billing.check({
      plans: [...ALL_PLAN_KEYS],
      isTest: process.env.NODE_ENV !== "production",
    });

    return {
      hasActivePayment: billingState.hasActivePayment,
      managedPricingUrl: getManagedPricingUrl(session.shop),
      requestedPlan: isPlanKey(requestedPlan) ? requestedPlan : null,
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
      managedPricingUrl: null as string | null,
      requestedPlan: null as (typeof ALL_PLAN_KEYS)[number] | null,
      subscriptions: [] as Array<{ id: string; name: string; status: string; lineItems: number }>,
      error: extractBillingErrorMessage(err),
    };
  }
};

export const action = async ({ request }: { request: Request }) => {
  const formData = await request.formData();
  const requestedPlan = String(formData.get("plan") || "").trim();

  if (!isPlanKey(requestedPlan)) {
    return Response.json(
      { ok: false, error: "Unknown billing plan." },
      { status: 400 },
    );
  }

  throw redirect(`/app/billing?plan=${encodeURIComponent(requestedPlan)}`);
};

export default function BillingPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  const activePlanName = data.subscriptions.find(
    (s) => s.status === "ACTIVE" || s.status === "ACCEPTED",
  )?.name;
  const launchState = data.hasActivePayment
    ? {
        title: "Billing is active",
        body: "Your Shopify plan is approved. You can continue setup and daily operations.",
        tone: "success" as const,
      }
    : {
        title: "Choose a Shopify plan",
        body: "Select a plan in Shopify when you are ready to launch.",
        tone: "warning" as const,
      };

  return (
    <ShellPage
      title="Billing"
      subtitle="Your subscription is managed by Shopify. Compare plans below and open Shopify's hosted pricing screen to change plans."
    >
      {navigation.state !== "idle" ? <Spinner accessibilityLabel="Loading" size="small" /> : null}

      <Banner title={launchState.title} tone={launchState.tone}>
        {launchState.body}
      </Banner>

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
          <Card padding="500">
            <EmptyState
              heading="No active subscription"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Select a Shopify plan to activate billing for this store.
                </Text>
                {data.managedPricingUrl ? (
                  <InlineStack>
                    <Button url={data.managedPricingUrl} target="_top" variant="primary">
                      Choose a Shopify plan
                    </Button>
                  </InlineStack>
                ) : null}
              </BlockStack>
            </EmptyState>
          </Card>
        )}
      </SectionCard>

      <SectionCard
        title="Merchant decision"
        subtitle="This page should make it obvious whether billing needs action right now."
      >
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <Card padding="500">
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">Current state</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                {data.hasActivePayment
                  ? `The active plan is ${activePlanName || "approved"}.`
                  : "No approved subscription is active yet."}
              </Text>
            </BlockStack>
          </Card>
          <Card padding="500">
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">Recommended next step</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                {data.hasActivePayment
                  ? "Use Shopify pricing only if you want to change plans."
                  : "Open Shopify pricing and choose the plan you want to use."}
              </Text>
              {data.managedPricingUrl ? (
                <Button url={data.managedPricingUrl} target="_top" variant="primary">
                  {data.hasActivePayment ? "Manage plan in Shopify" : "Approve plan in Shopify"}
                </Button>
              ) : null}
            </BlockStack>
          </Card>
        </InlineGrid>
      </SectionCard>

      <Banner title="How to change your plan" tone="info">
        Your subscription is managed through Shopify Managed Pricing. To upgrade,
        downgrade, or cancel your plan, open Shopify's hosted plan selection page and
        choose the plan there.
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
