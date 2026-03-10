import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  authenticate,
  PRO_MONTHLY_PLAN,
  PRO_YEARLY_PLAN,
  STARTER_MONTHLY_PLAN,
  STARTER_YEARLY_PLAN,
} from "../shopify.server";

const BILLING_PLANS = [
  {
    key: STARTER_MONTHLY_PLAN,
    label: "Starter Monthly",
    amount: "$29",
  },
  {
    key: STARTER_YEARLY_PLAN,
    label: "Starter Yearly",
    amount: "$290",
  },
  {
    key: PRO_MONTHLY_PLAN,
    label: "Pro Monthly",
    amount: "$99",
  },
  {
    key: PRO_YEARLY_PLAN,
    label: "Pro Yearly",
    amount: "$990",
  },
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

  return (
    <s-page heading="Billing">
      <s-section heading="Current status">
        <s-stack direction="block" gap="base">
          <s-text>
            Active payment: {data.hasActivePayment ? "yes" : "no"}
          </s-text>
          {data.subscriptions.length > 0 ? (
            data.subscriptions.map((subscription) => (
              <s-text key={subscription.id}>
                {subscription.name} ({subscription.status})
              </s-text>
            ))
          ) : (
            <s-text>No active Shopify app subscription found.</s-text>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Choose a plan">
        <s-stack direction="block" gap="base">
          {data.plans.map((plan) => (
            <Form method="post" key={plan.key}>
              <input type="hidden" name="plan" value={plan.key} />
              <s-box
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="subdued"
              >
                <s-stack direction="inline" gap="base" align-items="center">
                  <s-text>{plan.label}</s-text>
                  <s-text>{plan.amount}</s-text>
                  <s-button type="submit">Approve</s-button>
                </s-stack>
              </s-box>
            </Form>
          ))}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
