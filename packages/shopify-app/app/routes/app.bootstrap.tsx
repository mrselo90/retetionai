import type { LoaderFunctionArgs } from "react-router";

import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { isBillingReady } from "../lib/billingStatus";
import { requireSessionTokenAuthorization } from "../lib/sessionToken.server";
import { fetchMerchantOverviewFromRequest } from "../platform.server";
import {
  GROWTH_MONTHLY_PLAN,
  GROWTH_YEARLY_PLAN,
  PRO_MONTHLY_PLAN,
  PRO_YEARLY_PLAN,
  STARTER_MONTHLY_PLAN,
  STARTER_YEARLY_PLAN,
} from "../services/planDefinitions";

const ALL_PLAN_KEYS = [
  STARTER_MONTHLY_PLAN,
  STARTER_YEARLY_PLAN,
  GROWTH_MONTHLY_PLAN,
  GROWTH_YEARLY_PLAN,
  PRO_MONTHLY_PLAN,
  PRO_YEARLY_PLAN,
] as const;

function buildPendingOverview(shop: string) {
  const merchantName = shop.replace(".myshopify.com", "");
  return {
    merchant: {
      id: `pending:${shop}`,
      name: merchantName,
      subscription_status: "pending",
      subscription_plan: null,
      trial_ends_at: null,
    },
    shop,
    integration: {
      id: `pending:${shop}`,
      provider: "shopify",
      status: "pending",
    },
    subscription: {
      plan: null,
      status: "pending",
      billingProvider: null,
      trialEndsAt: null,
    },
    metrics: {
      totalOrders: 0,
      activeUsers: 0,
      totalProducts: 0,
      responseRate: 0,
    },
    analytics: {
      avgSentiment: 0,
      returnRate: 0,
      preventedReturns: 0,
      totalConversations: 0,
      resolvedConversations: 0,
    },
    settings: {
      notificationPhone: null,
      personaSettings: {},
    },
    integrations: [],
    products: [],
    recentOrders: [],
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Data route: avoid verifying the same Shopify session token twice.
  // The platform API remains the single verifier for embedded bearer tokens.
  requireSessionTokenAuthorization(request);
  const requestUrl = new URL(request.url);
  const { billing } = await authenticateEmbeddedAdmin(request);
  const billingState = await billing.check({
    plans: [...ALL_PLAN_KEYS],
    isTest: process.env.NODE_ENV !== "production",
  });

  try {
    const overview = await fetchMerchantOverviewFromRequest(request);
    const shop = requestUrl.searchParams.get("shop") || overview.shop;
    const billingApproved = billingState.hasActivePayment || isBillingReady(overview.merchant.subscription_status);

    return Response.json({
      merchantName: overview.merchant.name || shop.replace(".myshopify.com", ""),
      overview,
      shop,
      subscriptionStatus: billingApproved
        ? "active"
        : overview.merchant.subscription_status || "inactive",
      billingApproved,
    });
  } catch (error) {
    // Fresh installs can hit a short timing window where embedded auth is valid
    // but merchant records are not fully bootstrapped in the platform API yet.
    if (error instanceof Response && (error.status === 403 || error.status === 404)) {
      const shop = requestUrl.searchParams.get("shop")?.trim() || "unknown.myshopify.com";
      const overview = buildPendingOverview(shop);
      const billingApproved = billingState.hasActivePayment;
      if (billingApproved) {
        overview.merchant.subscription_status = "active";
        overview.subscription.status = "active";
      }
      return Response.json(
        {
          pending: true,
          reason: "merchant_bootstrap_pending",
          merchantName: overview.merchant.name,
          overview,
          shop,
          subscriptionStatus: billingApproved ? "active" : "pending",
          billingApproved,
        },
        { status: 202 },
      );
    }
    throw error;
  }
};

export default function AppBootstrapRoute() {
  return null;
}
