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
    <>
      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h2 className="shellSectionTitle">Billing</h2>
            <p className="shellSectionText">
              Shopify App Store billing approval controls paid feature access.
            </p>
          </div>
        </div>

        <div className="shellCards">
          <article className="shellCard">
            <h3 className="shellCardTitle">Current status</h3>
            <p className="shellSectionText">
              Active payment: {data.hasActivePayment ? "yes" : "no"}
            </p>
            {data.subscriptions.length > 0 ? (
              <div className="shellList" style={{ marginTop: "14px" }}>
                {data.subscriptions.map((subscription) => (
                  <div className="shellListItem" key={subscription.id}>
                    <div className="shellListMain">
                      <p className="shellListTitle">{subscription.name}</p>
                      <p className="shellListMeta">
                        Shopify subscription {subscription.id}
                      </p>
                    </div>
                    <span className="shellStatus shellStatusActive">
                      {subscription.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        </div>
      </section>

      <section className="shellSection">
        <div className="shellSectionHeader">
          <div>
            <h3 className="shellSectionTitle">Choose a plan</h3>
            <p className="shellSectionText">
              Approving a plan should be the merchant’s first step before using
              the retention workflow in production.
            </p>
          </div>
        </div>

        <div className="shellCards">
          {data.plans.map((plan) => (
            <Form method="post" key={plan.key}>
              <input type="hidden" name="plan" value={plan.key} />
              <article className="shellCard">
                <h4 className="shellCardTitle">{plan.label}</h4>
                <p className="shellMetricValue" style={{ marginTop: "8px" }}>
                  {plan.amount}
                </p>
                <p className="shellSectionText">
                  Shopify-managed recurring billing approval.
                </p>
                <button
                  type="submit"
                  className="shellButton shellButtonPrimary"
                  style={{ marginTop: "16px", border: "none", cursor: "pointer" }}
                >
                  Approve plan
                </button>
              </article>
            </Form>
          ))}
        </div>
      </section>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
