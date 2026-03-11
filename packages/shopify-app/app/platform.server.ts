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

async function parseRequiredJson(response: Response, context: string) {
  const bodyText = await response.text();
  const parsed = parseJsonSafe(bodyText);

  if (!response.ok) {
    throw new Error(`${context} failed with ${response.status}: ${JSON.stringify(parsed)}`);
  }

  return parsed;
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

export interface MerchantProduct {
  id: string;
  name: string;
  url: string;
  external_id?: string | null;
  raw_text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  chunkCount?: number;
}

async function fetchMerchantOverviewOrThrow(shop: string) {
  return fetchMerchantOverview(shop);
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

  return parseRequiredJson(response, "Platform install sync");
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

  return (await parseRequiredJson(response, "Platform merchant overview")) as ShopifyMerchantOverview;
}

async function internalMerchantRequest(
  shop: string,
  path: string,
  init?: RequestInit,
) {
  const overview = await fetchMerchantOverviewOrThrow(shop);
  const baseUrl = getRequiredEnv("PLATFORM_API_URL").replace(/\/$/, "");
  const headers = new Headers(init?.headers || {});
  headers.set("X-Internal-Secret", getRequiredEnv("PLATFORM_INTERNAL_SECRET"));
  headers.set("X-Internal-Merchant-Id", overview.merchant.id);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  return parseRequiredJson(response, `Platform request ${path}`);
}

export async function fetchMerchantProducts(shop: string) {
  const productsPayload = (await internalMerchantRequest(shop, "/api/products")) as {
    products: MerchantProduct[];
  };

  const products = productsPayload.products || [];
  if (products.length === 0) return { products: [] as MerchantProduct[] };

  const chunkPayload = (await internalMerchantRequest(shop, "/api/products/chunks/batch", {
    method: "POST",
    body: JSON.stringify({ productIds: products.map((product) => product.id) }),
  })) as {
    chunkCounts: Array<{ productId: string; chunkCount: number }>;
  };

  const chunkMap = new Map(
    (chunkPayload.chunkCounts || []).map((entry) => [entry.productId, entry.chunkCount]),
  );

  return {
    products: products.map((product) => ({
      ...product,
      chunkCount: chunkMap.get(product.id) ?? 0,
    })),
  };
}

export async function createMerchantProduct(
  shop: string,
  input: { name: string; url: string },
) {
  return internalMerchantRequest(shop, "/api/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function scrapeMerchantProduct(shop: string, productId: string) {
  return internalMerchantRequest(shop, `/api/products/${productId}/scrape`, {
    method: "POST",
  });
}

export async function generateMerchantProductEmbeddings(shop: string, productId: string) {
  return internalMerchantRequest(shop, `/api/products/${productId}/generate-embeddings`, {
    method: "POST",
  });
}

export async function deleteMerchantProduct(shop: string, productId: string) {
  return internalMerchantRequest(shop, `/api/products/${productId}`, {
    method: "DELETE",
  });
}
