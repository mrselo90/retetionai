import type { LoaderFunctionArgs } from "react-router";
import { getPlanSnapshotByDomain } from "../services/planService.server";

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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  assertInternalSecret(request);

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop")?.trim();
  if (!shop) {
    return Response.json({ error: "shop is required" }, { status: 400 });
  }

  const plan = await getPlanSnapshotByDomain(shop);
  return Response.json({ plan });
};
