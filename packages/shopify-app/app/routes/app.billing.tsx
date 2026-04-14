import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  List,
  Text,
} from "@shopify/polaris";
import {
  isPlanKey,
} from "../services/planDefinitions";
import { SectionCard, ShellPage } from "../components/shell-ui";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";

const STARTER_MONTHLY_PLAN = "starter-monthly";
const STARTER_YEARLY_PLAN = "starter-yearly";
const GROWTH_MONTHLY_PLAN = "growth-monthly";
const GROWTH_YEARLY_PLAN = "growth-yearly";
const PRO_MONTHLY_PLAN = "pro-monthly";
const PRO_YEARLY_PLAN = "pro-yearly";

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
  planKey: (typeof ALL_PLAN_KEYS)[number];
  recommended?: boolean;
  features: readonly string[];
}> = [
  {
    tier: "Starter",
    monthly: "$29/mo",
    yearly: "$290/yr",
    planKey: STARTER_MONTHLY_PLAN,
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
    planKey: GROWTH_MONTHLY_PLAN,
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
    planKey: PRO_MONTHLY_PLAN,
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

  const activePlanName = data.subscriptions.find(
    (s) => s.status === "ACTIVE" || s.status === "ACCEPTED",
  )?.name;

  return (
    <ShellPage
      title="Billing"
      subtitle="Choose a subscription plan to activate Recete on your store."
    >
      {data.error ? (
        <Card padding="300">
          <Text as="p" variant="bodySm" tone="critical">
            Unable to load billing status: {data.error}
          </Text>
        </Card>
      ) : null}

      <Card padding="300">
        <InlineStack align="space-between" blockAlign="center" wrap>
          <Text as="p" variant="bodySm" tone="subdued">
            Current Status
          </Text>
          <Badge tone={data.hasActivePayment ? "success" : "attention"}>
            {data.hasActivePayment ? `Active${activePlanName ? ` · ${activePlanName}` : ""}` : "Free / No Plan"}
          </Badge>
        </InlineStack>
      </Card>

      <SectionCard
        title="Compare plans"
        subtitle="Select a plan to continue setup and activate billing in Shopify."
      >
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          {PLAN_TIERS.map((plan) => {
            const isCurrentTier = activePlanName?.toLowerCase().includes(plan.tier.toLowerCase());
            const planSelectionUrl = data.managedPricingUrl
              ? `${data.managedPricingUrl}?plan=${encodeURIComponent(plan.planKey)}`
              : undefined;
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
                  <Button
                    variant="primary"
                    fullWidth
                    disabled={!planSelectionUrl}
                    url={planSelectionUrl}
                    target="_top"
                  >
                    Choose {plan.tier}
                  </Button>
                </BlockStack>
              </Card>
            );
          })}
        </InlineGrid>
      </SectionCard>

      <Card padding="300">
        <InlineStack align="space-between" blockAlign="center" wrap>
          <Text as="p" variant="bodySm" tone="subdued">
            Need help choosing the right plan?
          </Text>
          <Button variant="plain" url="/app/integrations">
            Billing support
          </Button>
        </InlineStack>
      </Card>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
