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

  await forwardWebhookToPlatform(forwardRequest, "/webhooks/commerce/shopify");

  return new Response(null, { status: 200 });
};
