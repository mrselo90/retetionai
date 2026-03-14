import type { LoaderFunctionArgs } from "react-router";
import { getPlanSnapshotByDomain } from "../services/planService.server";

function assertInternalSecret(request: Request) {
  const expected =
    process.env.PLATFORM_INTERNAL_SECRET?.trim() ||
    process.env.INTERNAL_SERVICE_SECRET?.trim();
  const provided = request.headers.get("X-Internal-Secret")?.trim();

  if (!expected) {
    throw new Response("Internal auth is not configured", { status: 500 });
  }

  if (!provided || provided !== expected) {
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
