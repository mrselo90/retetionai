import type { LoaderFunctionArgs } from "react-router";

import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { fetchMerchantOverviewFromRequest } from "../platform.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateEmbeddedAdmin(request);
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
