import type { ActionFunctionArgs } from "react-router";

import { fetchMerchantSettings } from "../platform.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  await fetchMerchantSettings(request);

  return Response.json({ ok: true }, { status: 200 });
};

export default function AppSessionTokenRoute() {
  return null;
}
