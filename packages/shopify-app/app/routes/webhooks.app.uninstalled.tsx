import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { forwardWebhookToPlatform } from "../platform.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const forwardRequest = request.clone();
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  await forwardWebhookToPlatform(forwardRequest, "/webhooks/commerce/shopify");

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response(null, { status: 200 });
};
