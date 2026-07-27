import type { LoaderFunctionArgs } from "react-router";
import { timingSafeEqual } from "node:crypto";

/**
 * GET /app/health — liveness probe.
 *
 * Unauthenticated callers get only up/down booleans, which is what an uptime
 * monitor needs. The internal API URL, env-var inventory and upstream error
 * strings are gated behind the internal secret: exposing them publicly told an
 * attacker where the platform API lives and which secrets were configured.
 */
function hasInternalSecret(request: Request): boolean {
  const provided = request.headers.get("X-Internal-Secret")?.trim() || "";
  if (!provided) return false;

  const expected = [
    process.env.INTERNAL_SERVICE_SECRET?.trim(),
    process.env.PLATFORM_INTERNAL_SECRET?.trim(),
  ].filter((value): value is string => Boolean(value));

  return expected.some((candidate) => {
    const a = Buffer.from(provided);
    const b = Buffer.from(candidate);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const platformUrl = (process.env.PLATFORM_API_URL || "").replace(/\/$/, "");
  const detailed = hasInternalSecret(request);

  let platformApiReachable = false;
  let platformApiStatus: number | undefined;
  let platformApiLatencyMs: number | undefined;
  let platformApiError: string | undefined;

  if (platformUrl) {
    try {
      const start = Date.now();
      const resp = await fetch(`${platformUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      platformApiReachable = resp.ok;
      platformApiStatus = resp.status;
      platformApiLatencyMs = Date.now() - start;
    } catch (err) {
      platformApiReachable = false;
      platformApiError = err instanceof Error ? err.message : String(err);
    }
  }

  const status = platformApiReachable ? 200 : 503;

  if (!detailed) {
    return Response.json(
      {
        shopifyShell: "ok",
        platformApiReachable,
        timestamp: new Date().toISOString(),
      },
      { status },
    );
  }

  return Response.json(
    {
      shopifyShell: "ok",
      platformApiUrl: platformUrl || "NOT SET",
      platformApiReachable,
      platformApiStatus,
      platformApiLatencyMs,
      platformApiError,
      timestamp: new Date().toISOString(),
      env: {
        SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? "set" : "MISSING",
        SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ? "set" : "MISSING",
        PLATFORM_API_URL: platformUrl ? "set" : "MISSING",
        PLATFORM_INTERNAL_SECRET: process.env.PLATFORM_INTERNAL_SECRET ? "set" : "MISSING",
        INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET ? "set" : "MISSING",
        DATABASE_URL: process.env.DATABASE_URL ? "set" : "MISSING",
      },
    },
    { status },
  );
};

export default function HealthRoute() {
  return null;
}
