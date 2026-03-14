import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { forwardWebhookToPlatform } from "../platform.server";
import { processOrderFulfillmentUsage } from "../services/billingUsage.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const forwardRequest = request.clone();
  const webhookId = request.headers.get("x-shopify-webhook-id")?.trim();
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (session && admin && webhookId) {
    const externalOrderId =
      String(payload?.name || payload?.order_number || payload?.id || webhookId).trim();
    await processOrderFulfillmentUsage({
      shopDomain: shop,
      webhookId,
      topic,
      externalOrderId,
      admin,
    });
  }

  await forwardWebhookToPlatform(forwardRequest, "/webhooks/commerce/shopify");

  return new Response(null, { status: 200 });
};
