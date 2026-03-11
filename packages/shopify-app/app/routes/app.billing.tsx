import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { CreditCardIcon } from "@shopify/polaris-icons";
import {
  Badge,
  Button,
  Card,
  InlineGrid,
  ProgressBar,
} from "@shopify/polaris";
import {
  authenticate,
  PRO_MONTHLY_PLAN,
  PRO_YEARLY_PLAN,
  STARTER_MONTHLY_PLAN,
  STARTER_YEARLY_PLAN,
} from "../shopify.server";
import { EmptyCard, SectionCard, ShellPage, StatusBadge } from "../components/shell-ui";

const BILLING_PLANS = [
  { key: STARTER_MONTHLY_PLAN, label: "Starter Monthly", amount: "$29", note: "Monthly starter plan for embedded merchants." },
  { key: STARTER_YEARLY_PLAN, label: "Starter Yearly", amount: "$290", note: "Annual starter plan with lower yearly cost." },
  { key: PRO_MONTHLY_PLAN, label: "Pro Monthly", amount: "$99", note: "Higher-capacity plan for active stores." },
  { key: PRO_YEARLY_PLAN, label: "Pro Yearly", amount: "$990", note: "Annual pro plan for committed merchants." },
] as const;

type BillingPlanKey = (typeof BILLING_PLANS)[number]["key"];

function isBillingPlanKey(value: string): value is BillingPlanKey {
  return BILLING_PLANS.some((candidate) => candidate.key === value);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const billingState = await billing.check({
    plans: [
      STARTER_MONTHLY_PLAN,
      STARTER_YEARLY_PLAN,
      PRO_MONTHLY_PLAN,
      PRO_YEARLY_PLAN,
    ],
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
    plans: BILLING_PLANS,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = String(formData.get("plan") || "");

  if (!isBillingPlanKey(plan)) {
    return new Response("Invalid plan", { status: 400 });
  }

  return billing.request({
    plan,
    isTest: process.env.NODE_ENV !== "production",
    returnUrl: `${process.env.SHOPIFY_APP_URL || ""}/app/billing`,
  });
};

export default function BillingPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  return (
    <ShellPage
      title="Billing"
      subtitle="Shopify-managed billing approval that gates paid retention features."
      primaryAction={{ content: "Review plans", icon: CreditCardIcon }}
    >
      {navigation.state !== "idle" ? <ProgressBar progress={80} size="small" /> : null}

      <SectionCard
        title="Current status"
        subtitle="Merchants should understand immediately whether billing is approved before using core functionality."
        badge={
          <Badge tone={data.hasActivePayment ? "success" : "attention"}>
            {data.hasActivePayment ? "Approved" : "Approval needed"}
          </Badge>
        }
      >
        {data.subscriptions.length > 0 ? (
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            {data.subscriptions.map((subscription) => (
              <Card key={subscription.id} padding="500">
                <StatusBadge status={subscription.status}>{subscription.status}</StatusBadge>
              </Card>
            ))}
          </InlineGrid>
        ) : (
          <EmptyCard
            heading="No active Shopify subscription"
            description="Approve a plan before enabling the production retention workflow for this merchant."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Choose a plan"
        subtitle="Use Shopify approval flow instead of custom billing UX so merchants stay in a standard review-safe path."
      >
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          {data.plans.map((plan) => (
            <Card key={plan.key} padding="500">
              <Form method="post">
                <input type="hidden" name="plan" value={plan.key} />
                <InlineGrid columns={{ xs: 1 }} gap="400">
                  <StatusBadge status={data.hasActivePayment ? "active" : "pending"}>
                    {plan.label}
                  </StatusBadge>
                  <Badge tone="info">{plan.amount}</Badge>
                  <Button submit variant="primary" icon={CreditCardIcon} fullWidth>
                    Approve plan
                  </Button>
                </InlineGrid>
              </Form>
            </Card>
          ))}
        </InlineGrid>
      </SectionCard>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
