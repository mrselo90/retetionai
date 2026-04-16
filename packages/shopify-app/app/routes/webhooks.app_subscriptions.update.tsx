import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { forwardWebhookToPlatform } from "../platform.server";
import { syncShopSubscriptionFromAdmin } from "../services/billingUsage.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const forwardRequest = request.clone();
  const { topic, shop, session, admin } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (session && admin) {
    await syncShopSubscriptionFromAdmin(shop, admin);
  }

  // Forward to platform — non-fatal if platform doesn't have the integration yet
  // (e.g. during initial install before install-sync completes).
  try {
    await forwardWebhookToPlatform(forwardRequest, "/webhooks/commerce/shopify");
  } catch (err) {
    console.error(`[${topic}] Platform forward failed for ${shop}:`, err instanceof Error ? err.message : err);
  }

  return new Response(null, { status: 200 });
};
