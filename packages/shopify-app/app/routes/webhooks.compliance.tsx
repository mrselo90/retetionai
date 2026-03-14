import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { forwardWebhookToPlatform } from "../platform.server";

function getComplianceForwardPath(topic: string) {
  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      return "/api/webhooks/shopify/gdpr/customers/data_request";
    case "CUSTOMERS_REDACT":
      return "/api/webhooks/shopify/gdpr/customers/redact";
    case "SHOP_REDACT":
      return "/api/webhooks/shopify/gdpr/shop/redact";
    default:
      throw new Error(`Unsupported compliance webhook topic: ${topic}`);
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const forwardRequest = request.clone();
  let topic: string;
  let shop: string;

  try {
    const webhookContext = await authenticate.webhook(request);
    topic = webhookContext.topic;
    shop = webhookContext.shop;
  } catch (error) {
    console.warn("Rejected compliance webhook due to invalid Shopify signature.", error);
    return new Response("Unauthorized", { status: 401 });
  }

  console.log(`Received ${topic} webhook for ${shop}`);
  await forwardWebhookToPlatform(forwardRequest, getComplianceForwardPath(topic));

  return new Response(null, { status: 200 });
};
