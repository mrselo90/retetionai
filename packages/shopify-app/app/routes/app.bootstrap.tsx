import type { LoaderFunctionArgs } from "react-router";

import { requireSessionTokenAuthorization } from "../lib/sessionToken.server";
import { fetchMerchantOverviewFromRequest } from "../platform.server";

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
  try {
    const overview = await fetchMerchantOverviewFromRequest(request);
    const shop = requestUrl.searchParams.get("shop") || overview.shop;

    return Response.json({
      merchantName: overview.merchant.name || shop.replace(".myshopify.com", ""),
      overview,
      shop,
      subscriptionStatus: overview.merchant.subscription_status || "inactive",
    });
  } catch (error) {
    // Fresh installs can hit a short timing window where embedded auth is valid
    // but merchant records are not fully bootstrapped in the platform API yet.
    if (error instanceof Response && (error.status === 403 || error.status === 404)) {
      const shop = requestUrl.searchParams.get("shop")?.trim() || "unknown.myshopify.com";
      const overview = buildPendingOverview(shop);
      return Response.json(
        {
          pending: true,
          reason: "merchant_bootstrap_pending",
          merchantName: overview.merchant.name,
          overview,
          shop,
          subscriptionStatus: "pending",
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
