// WhatsApp marketing consent changed in Shopify. The platform re-reads it and
// updates the customers Recete messages (packages/api/src/lib/whatsappConsent.ts).
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { forwardWebhookToPlatform } from "../platform.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const forwardRequest = request.clone();
  const { topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await forwardWebhookToPlatform(forwardRequest, "/webhooks/commerce/shopify");

  return new Response(null, { status: 200 });
};
