import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { redirect, session } = await authenticate.admin(request);
  const requestUrl = new URL(request.url);
  const host = requestUrl.searchParams.get("host");
  const legacyDashboardUrl =
    process.env.LEGACY_DASHBOARD_URL?.trim() || "http://localhost:3000";

  const target = new URL("/en/dashboard", legacyDashboardUrl);
  target.searchParams.set("shop", session.shop);
  if (host) target.searchParams.set("host", host);

  return redirect(target.toString(), { target: "_top" });
};
