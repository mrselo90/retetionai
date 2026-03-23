import type { LoaderFunctionArgs } from "react-router";

import { requireSessionTokenAuthorization } from "../lib/sessionToken.server";
import { fetchMerchantOverviewFromRequest } from "../platform.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Data route: avoid verifying the same Shopify session token twice.
  // The platform API remains the single verifier for embedded bearer tokens.
  requireSessionTokenAuthorization(request);
  const overview = await fetchMerchantOverviewFromRequest(request);
  const requestUrl = new URL(request.url);
  const shop = requestUrl.searchParams.get("shop") || overview.shop;

  return Response.json({
    merchantName: overview.merchant.name || shop.replace(".myshopify.com", ""),
    overview,
    shop,
    subscriptionStatus: overview.merchant.subscription_status || "inactive",
  });
};

export default function AppBootstrapRoute() {
  return null;
}
