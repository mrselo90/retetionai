import type { LoaderFunctionArgs } from "react-router";

/**
 * GET /app/health — diagnostic endpoint (no auth required).
 * Checks that PLATFORM_API_URL is reachable.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const platformUrl = (process.env.PLATFORM_API_URL || "").replace(/\/$/, "");
  const checks: Record<string, unknown> = {
    shopifyShell: "ok",
    platformApiUrl: platformUrl || "NOT SET",
    platformApiReachable: false,
    timestamp: new Date().toISOString(),
    env: {
      SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY ? "set" : "MISSING",
      SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET ? "set" : "MISSING",
      PLATFORM_API_URL: platformUrl ? "set" : "MISSING",
      PLATFORM_INTERNAL_SECRET: process.env.PLATFORM_INTERNAL_SECRET ? "set" : "MISSING",
      DATABASE_URL: process.env.DATABASE_URL ? "set" : "MISSING",
    },
  };

  if (platformUrl) {
    try {
      const start = Date.now();
      const resp = await fetch(`${platformUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      checks.platformApiReachable = resp.ok;
      checks.platformApiStatus = resp.status;
      checks.platformApiLatencyMs = Date.now() - start;
    } catch (err) {
      checks.platformApiReachable = false;
      checks.platformApiError = err instanceof Error ? err.message : String(err);
    }
  }

  const allOk = checks.platformApiReachable === true;

  return Response.json(checks, { status: allOk ? 200 : 503 });
};

export default function HealthRoute() {
  return null;
}
