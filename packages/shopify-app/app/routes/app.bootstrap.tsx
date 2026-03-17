import type { LoaderFunctionArgs } from "react-router";

import { fetchMerchantOverviewFromRequest } from "../platform.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const overview = await fetchMerchantOverviewFromRequest(request);

  return Response.json({
    merchantName: overview.merchant.name || session.shop.replace(".myshopify.com", ""),
    overview,
    shop: session.shop,
    subscriptionStatus: overview.merchant.subscription_status || "inactive",
  });
};

export default function AppBootstrapRoute() {
  return null;
}
