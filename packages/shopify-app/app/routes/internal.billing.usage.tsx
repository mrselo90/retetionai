import type { ActionFunctionArgs } from "react-router";
import {
  recordBillableChatUsage,
  recordPhotoAnalysisUsage,
} from "../services/billingUsage.server";

type UsageActionPayload = {
  shopDomain?: string;
  usageType?: "chat" | "photo";
  externalEventId?: string;
  description?: string;
  quantity?: number;
};

function assertInternalSecret(request: Request) {
  const expectedSecrets = [
    process.env.PLATFORM_INTERNAL_SECRET?.trim(),
    process.env.INTERNAL_SERVICE_SECRET?.trim(),
  ].filter((value): value is string => Boolean(value));
  const provided = request.headers.get("X-Internal-Secret")?.trim();

  if (expectedSecrets.length === 0) {
    throw new Response("Internal auth is not configured", { status: 500 });
  }

  if (!provided || !expectedSecrets.includes(provided)) {
    throw new Response("Forbidden", { status: 403 });
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  assertInternalSecret(request);

  const body = (await request.json()) as UsageActionPayload;
  const shopDomain = body.shopDomain?.trim();
  const externalEventId = body.externalEventId?.trim();
  const usageType = body.usageType;

  if (!shopDomain || !externalEventId || !usageType) {
    return Response.json(
      { error: "shopDomain, usageType, and externalEventId are required" },
      { status: 400 },
    );
  }

  const quantity =
    typeof body.quantity === "number" && Number.isFinite(body.quantity)
      ? body.quantity
      : 1;

  const result =
    usageType === "photo"
      ? await recordPhotoAnalysisUsage({
          shopDomain,
          externalEventId,
          description: body.description,
          quantity,
        })
      : await recordBillableChatUsage({
          shopDomain,
          externalEventId,
          description: body.description,
          quantity,
        });

  return Response.json({ ok: true, result });
};
