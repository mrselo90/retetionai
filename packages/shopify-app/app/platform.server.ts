function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseJsonSafe(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function syncShopInstall(session: {
  shop: string;
  accessToken?: string;
  scope?: string | null;
}) {
  if (!session.accessToken) {
    throw new Error(`Missing offline access token for shop ${session.shop}`);
  }

  const response = await fetch(
    `${getRequiredEnv("PLATFORM_API_URL").replace(/\/$/, "")}/api/integrations/shopify/install-sync`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": getRequiredEnv("PLATFORM_INTERNAL_SECRET"),
      },
      body: JSON.stringify({
        shop: session.shop,
        accessToken: session.accessToken,
        scope: session.scope ?? null,
      }),
    },
  );

  const bodyText = await response.text();
  const parsed = parseJsonSafe(bodyText);

  if (!response.ok) {
    throw new Error(
      `Platform install sync failed with ${response.status}: ${JSON.stringify(parsed)}`,
    );
  }

  return parsed;
}

export async function forwardWebhookToPlatform(request: Request, path: string) {
  const rawBody = await request.clone().text();
  const headers = new Headers({
    "Content-Type": request.headers.get("content-type") || "application/json",
  });

  for (const name of [
    "x-shopify-hmac-sha256",
    "x-shopify-shop-domain",
    "x-shopify-topic",
    "x-shopify-api-version",
    "x-shopify-webhook-id",
    "x-shopify-triggered-at",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const response = await fetch(
    `${getRequiredEnv("PLATFORM_API_URL").replace(/\/$/, "")}${path}`,
    {
      method: "POST",
      headers,
      body: rawBody,
    },
  );

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `Platform webhook forward failed with ${response.status}: ${bodyText || "empty body"}`,
    );
  }

  return response;
}
