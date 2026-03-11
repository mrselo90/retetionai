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

export interface ShopifyMerchantOverview {
  merchant: {
    id: string;
    name: string;
    created_at?: string | null;
    subscription_plan?: string | null;
    subscription_status?: string | null;
    trial_ends_at?: string | null;
  };
  shop: string;
  integration: {
    id: string;
    provider: string;
    status: string;
    updated_at?: string | null;
  };
  subscription?: {
    plan?: string | null;
    status?: string | null;
    billingProvider?: string | null;
    trialEndsAt?: string | null;
  } | null;
  metrics: {
    totalOrders: number;
    activeUsers: number;
    totalProducts: number;
    responseRate: number;
  };
  analytics: {
    avgSentiment: number;
    returnRate: number;
    preventedReturns: number;
    totalConversations: number;
    resolvedConversations: number;
  };
  settings: {
    notificationPhone?: string | null;
    personaSettings?: {
      bot_name?: string;
      tone?: "friendly" | "professional" | "casual" | "formal";
      emoji?: boolean;
      response_length?: "short" | "medium" | "long";
      whatsapp_sender_mode?: "merchant_own" | "corporate";
      whatsapp_welcome_template?: string;
    };
  };
  integrations: Array<{
    id: string;
    provider: string;
    status: string;
    updated_at?: string | null;
  }>;
  products: Array<{
    id: string;
    name: string;
    external_id?: string | null;
    updated_at?: string | null;
    created_at?: string | null;
  }>;
  recentOrders: Array<{
    id: string;
    external_order_id?: string | null;
    status: string;
    created_at: string;
    delivery_date?: string | null;
  }>;
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

export async function fetchMerchantOverview(shop: string) {
  const baseUrl = getRequiredEnv("PLATFORM_API_URL").replace(/\/$/, "");
  const response = await fetch(
    `${baseUrl}/api/integrations/shopify/merchant-overview?shop=${encodeURIComponent(shop)}`,
    {
      headers: {
        "X-Internal-Secret": getRequiredEnv("PLATFORM_INTERNAL_SECRET"),
      },
    },
  );

  const bodyText = await response.text();
  const parsed = parseJsonSafe(bodyText);

  if (!response.ok) {
    throw new Error(
      `Platform merchant overview failed with ${response.status}: ${JSON.stringify(parsed)}`,
    );
  }

  return parsed as ShopifyMerchantOverview;
}
