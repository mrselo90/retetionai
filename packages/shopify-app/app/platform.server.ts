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

function jsonErrorResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function parseRequiredJson(response: Response, context: string) {
  const bodyText = await response.text();
  const parsed = parseJsonSafe(bodyText);

  if (!response.ok) {
    // Preserve upstream auth/not-found semantics for embedded data routes.
    throw jsonErrorResponse(
      response.status,
      parsed || {
        error: `${context} failed`,
      },
    );
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
      ai_vision_enabled?: boolean;
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

export interface MerchantSettingsRecord {
  merchant: {
    id: string;
    name: string;
    notification_phone?: string | null;
    subscription_status?: string | null;
    subscription_plan?: string | null;
    trial_ends_at?: string | null;
    persona_settings?: {
      bot_name?: string;
      tone?: "friendly" | "professional" | "casual" | "formal";
      emoji?: boolean;
      ai_vision_enabled?: boolean;
      response_length?: "short" | "medium" | "long";
      temperature?: number;
      whatsapp_sender_mode?: "merchant_own" | "corporate";
      whatsapp_welcome_template?: string;
    };
  };
}

export interface MultiLangRagSettings {
  shop_id: string;
  default_source_lang: string;
  enabled_langs: string[];
  multi_lang_rag_enabled: boolean;
}

export interface MultiLangSettingsUpdateResponse {
  settings: MultiLangRagSettings;
  backfillTriggered?: boolean;
  addedLangs?: string[];
  removedLangs?: string[];
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
  knowledgeHealth?: {
    score: number;
    coverage: "strong" | "moderate" | "weak";
    answerRisk: "low" | "medium" | "high";
    missingReasonCodes: string[];
    metrics: {
      chunkCount: number;
      factFieldCount: number;
      hasEnrichedText: boolean;
      hasFacts: boolean;
      hasPreventionTips: boolean;
      hasRawText: boolean;
      usageInstructionLength: number;
    };
  } | null;
  languageHealth?: {
    sourceLanguage: string | null;
    requiredLanguages: string[];
    translatedLanguages: string[];
    readyLanguages: string[];
    missingLanguages: string[];
    pendingLanguages: string[];
    translationCoverage: number;
    answerCoverage: number;
    state: "not_started" | "pending" | "ready";
  } | null;
  lifecycle?: {
    status: "needs_setup" | "needs_ai_answers" | "ready";
    label: string;
    nextActionLabel: string;
    message: string;
  } | null;
}

export interface ProductFactsSnapshot {
  product_id: string;
  detected_language?: string | null;
  facts_json?: Record<string, unknown> | null;
  source_type?: string | null;
  source_url?: string | null;
}

export interface ProductStepOutcome {
  step: "map_product" | "collect_sources" | "generate_ai_knowledge";
  status: "not_started" | "in_progress" | "ready" | "error";
  updatedAt?: string;
  delta?: Record<string, unknown>;
  error?: string | null;
}

export interface ProductActionApiResponse {
  message?: string;
  error?: string;
  details?: string;
  stepOutcome?: ProductStepOutcome;
  [key: string]: unknown;
}

export interface ShopifyCatalogProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  descriptionHtml?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  featuredImageUrl?: string;
  variants?: Array<{
    id: string;
    title: string;
    price: string;
    sku?: string | null;
  }>;
}

export interface MerchantProductInstruction {
  product_id: string;
  product_name?: string;
  external_id?: string;
  usage_instructions: string;
  recipe_summary?: string | null;
  video_url?: string | null;
  prevention_tips?: string | null;
}

export interface MerchantAddon {
  key: string;
  name: string;
  description: string;
  priceMonthly: number;
  status: string;
  planAllowed: boolean;
  activatedAt?: string | null;
}

export interface MerchantGuardrail {
  id: string;
  name: string;
  description?: string;
  apply_to: "user_message" | "ai_response" | "both";
  match_type: "keywords" | "phrase";
  value: string[] | string;
  action: "block" | "escalate";
  suggested_response?: string;
}

export interface SystemGuardrail {
  id: string;
  name: string;
  description: string;
  apply_to: "user_message" | "ai_response" | "both";
  action: "block" | "escalate";
  editable: false;
}

export interface MerchantConversation {
  id: string;
  userId?: string;
  orderId?: string | null;
  userName?: string;
  phone?: string;
  messageCount: number;
  lastMessageAt?: string | null;
  status?: string;
  conversationStatus?: "ai" | "human" | "resolved";
  sentiment?: "positive" | "neutral" | "negative";
}

export interface MerchantConversationDetail {
  conversation: {
    id: string;
    userId: string;
    orderId?: string | null;
    userName: string;
    phone: string;
    history: Array<{
      role: "user" | "assistant" | "merchant";
      content: string;
      timestamp: string;
    }>;
    status: string;
    conversationStatus: "ai" | "human" | "resolved";
    assignedTo?: string | null;
    escalatedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    order?: {
      id: string;
      externalOrderId: string;
      status: string;
      deliveryDate?: string | null;
    } | null;
    returnPreventionAttempt?: {
      id: string;
      outcome: "pending" | "prevented" | "returned" | "escalated";
      triggerMessage: string;
      createdAt: string;
    } | null;
  };
}

export interface MerchantCustomer {
  id: string;
  name: string;
  phone: string;
  consent?: string;
  segment?: string;
  churnProbability?: number;
  orderCount: number;
  conversationCount: number;
  createdAt?: string | null;
}

function extractBearerToken(request: Request): string | null {
  const headerAuth = request.headers.get("Authorization")?.trim();
  if (headerAuth) return headerAuth;

  const url = new URL(request.url);
  const idToken = url.searchParams.get("id_token")?.trim();
  if (idToken) return `Bearer ${idToken}`;

  return null;
}

function buildPlatformAuthHeaders(request: Request, initHeaders?: HeadersInit) {
  const authorization = extractBearerToken(request);
  if (!authorization) {
    throw jsonErrorResponse(401, {
      error: "Missing Shopify session token in Authorization header",
    });
  }

  if (!authorization.startsWith("Bearer ")) {
    throw jsonErrorResponse(401, {
      error: "Malformed Authorization header",
    });
  }

  const headers = new Headers(initHeaders || {});
  headers.set("Authorization", authorization);
  console.info("[platform-auth]", {
    path: new URL(request.url).pathname,
    hasAuthorization: true,
  });
  return headers;
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

async function internalMerchantRequest(
  request: Request,
  path: string,
  init?: RequestInit,
) {
  const baseUrl = getRequiredEnv("PLATFORM_API_URL").replace(/\/$/, "");
  const headers = buildPlatformAuthHeaders(request, init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
  } catch (err) {
    console.error(
      `[platform] Connection to API failed for ${path}:`,
      err instanceof Error ? err.message : err,
    );
    throw jsonErrorResponse(502, {
      error: `Platform API unreachable`,
      detail: `Could not connect to ${baseUrl}${path}`,
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  return parseRequiredJson(response, `Platform request ${path}`);
}

export async function fetchMerchantOverviewFromRequest(request: Request) {
  const baseUrl = getRequiredEnv("PLATFORM_API_URL").replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/integrations/shopify/merchant-overview`, {
      headers: buildPlatformAuthHeaders(request),
    });
  } catch (err) {
    console.error(
      `[platform] Connection to API failed for merchant-overview:`,
      err instanceof Error ? err.message : err,
    );
    throw jsonErrorResponse(502, {
      error: `Platform API unreachable`,
      detail: `Could not connect to ${baseUrl}/api/integrations/shopify/merchant-overview`,
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  return (await parseRequiredJson(response, "Platform merchant overview")) as ShopifyMerchantOverview;
}

export async function fetchMerchantProducts(request: Request) {
  const productsPayload = (await internalMerchantRequest(request, "/api/products")) as {
    products: MerchantProduct[];
  };

  const products = productsPayload.products || [];
  if (products.length === 0) return { products: [] as MerchantProduct[] };

  const chunkPayload = (await internalMerchantRequest(request, "/api/products/chunks/batch", {
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

export async function fetchMerchantSettings(request: Request) {
  return (await internalMerchantRequest(request, "/api/merchants/me")) as MerchantSettingsRecord;
}

export async function updateMerchantSettings(
  request: Request,
  payload: {
    notification_phone?: string | null;
    persona_settings?: MerchantSettingsRecord["merchant"]["persona_settings"];
  },
) {
  return internalMerchantRequest(request, "/api/merchants/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function fetchMerchantMultiLangSettings(request: Request) {
  return (await internalMerchantRequest(
    request,
    "/api/merchants/me/multi-lang-rag-settings",
  )) as { settings: MultiLangRagSettings };
}

export async function updateMerchantMultiLangSettings(
  request: Request,
  payload: Partial<MultiLangRagSettings>,
) {
  return internalMerchantRequest(request, "/api/merchants/me/multi-lang-rag-settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  }) as Promise<MultiLangSettingsUpdateResponse>;
}

export async function createMerchantProduct(
  request: Request,
  input: { name: string; url: string; external_id?: string; raw_text?: string },
) {
  return internalMerchantRequest(request, "/api/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function scrapeMerchantProduct(request: Request, productId: string) {
  return internalMerchantRequest(request, `/api/products/${productId}/scrape`, {
    method: "POST",
  }) as Promise<ProductActionApiResponse>;
}

export async function scrapeMerchantProductAsync(request: Request, productId: string) {
  return internalMerchantRequest(request, `/api/products/${productId}/scrape-async`, {
    method: "POST",
  }) as Promise<ProductActionApiResponse>;
}

export async function enrichMerchantProductFromUrl(
  request: Request,
  productId: string,
  sourceUrl: string,
) {
  return internalMerchantRequest(request, `/api/products/${productId}/enrich-from-url`, {
    method: "POST",
    body: JSON.stringify({ source_url: sourceUrl }),
  }) as Promise<ProductActionApiResponse>;
}

export async function prepareMerchantProductKnowledge(
  request: Request,
  productId: string,
  sourceUrl?: string,
) {
  return internalMerchantRequest(request, `/api/products/${productId}/prepare-knowledge`, {
    method: "POST",
    body: JSON.stringify(sourceUrl ? { source_url: sourceUrl } : {}),
  }) as Promise<{
    message?: string;
    stepOutcomes?: ProductStepOutcome[];
  }>;
}

export async function generateMerchantProductEmbeddings(request: Request, productId: string) {
  return internalMerchantRequest(request, `/api/products/${productId}/generate-embeddings`, {
    method: "POST",
  }) as Promise<ProductActionApiResponse>;
}

export async function previewMerchantProductAnswer(
  request: Request,
  productId: string,
  question: string,
) {
  return internalMerchantRequest(request, "/api/answer", {
    method: "POST",
    body: JSON.stringify({ question, product_ids: [productId] }),
  }) as Promise<{
    answer?: string;
    error?: string;
    details?: string;
  }>;
}

export async function deleteMerchantProduct(request: Request, productId: string) {
  return internalMerchantRequest(request, `/api/products/${productId}`, {
    method: "DELETE",
  });
}

export async function resetMerchantProductKnowledge(request: Request, productId: string) {
  return internalMerchantRequest(request, `/api/products/${productId}/knowledge`, {
    method: "DELETE",
  });
}

export async function fetchShopifyCatalog(
  request: Request,
  input?: { first?: number; after?: string },
) {
  const query = new URLSearchParams();
  query.set("first", String(input?.first || 24));
  if (input?.after) query.set("after", input.after);

  return (await internalMerchantRequest(
    request,
    `/api/integrations/shopify/products?${query.toString()}`,
  )) as {
    products: ShopifyCatalogProduct[];
    shopDomain: string;
    hasNextPage: boolean;
    endCursor?: string | null;
  };
}

export async function fetchMerchantProductInstructions(request: Request) {
  return (await internalMerchantRequest(request, "/api/products/instructions/list")) as {
    instructions: MerchantProductInstruction[];
  };
}

export async function fetchMerchantProductFacts(request: Request, productIds: string[]) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return { facts: [] as ProductFactsSnapshot[] };
  }
  const query = new URLSearchParams();
  query.set("product_ids", productIds.join(","));
  return (await internalMerchantRequest(
    request,
    `/api/products/facts?${query.toString()}`,
  )) as { facts: ProductFactsSnapshot[] };
}

export async function fetchMerchantMappingData(request: Request) {
  return (await internalMerchantRequest(request, "/api/products/mapping-index")) as {
    localProducts: Array<{
      id: string;
      external_id?: string | null;
    }>;
    instructions: MerchantProductInstruction[];
    localProductCount: number;
  };
}

export async function updateMerchantProductInstruction(
  request: Request,
  productId: string,
  payload: {
    usage_instructions: string;
    recipe_summary?: string;
    video_url?: string;
    prevention_tips?: string;
  },
) {
  return internalMerchantRequest(request, `/api/products/${productId}/instruction`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function fetchMerchantGuardrails(request: Request) {
  return (await internalMerchantRequest(request, "/api/merchants/me/guardrails")) as {
    system_guardrails: SystemGuardrail[];
    custom_guardrails: MerchantGuardrail[];
  };
}

export async function updateMerchantGuardrails(
  request: Request,
  customGuardrails: MerchantGuardrail[],
) {
  return internalMerchantRequest(request, "/api/merchants/me/guardrails", {
    method: "PUT",
    body: JSON.stringify({ custom_guardrails: customGuardrails }),
  });
}

export async function fetchMerchantAddons(request: Request) {
  return (await internalMerchantRequest(request, "/api/billing/addons")) as {
    addons: MerchantAddon[];
  };
}

export async function subscribeMerchantAddon(request: Request, addonKey: string) {
  return internalMerchantRequest(request, `/api/billing/addons/${addonKey}/subscribe`, {
    method: "POST",
  });
}

export async function cancelMerchantAddon(request: Request, addonKey: string) {
  return internalMerchantRequest(request, `/api/billing/addons/${addonKey}/cancel`, {
    method: "POST",
  });
}

export async function deleteMerchantDataFromAdminPanel(request: Request) {
  return internalMerchantRequest(request, "/api/merchants/me/data-reset", {
    method: "DELETE",
    body: JSON.stringify({
      confirm: true,
    }),
  }) as Promise<{
    ok?: boolean;
    message?: string;
  }>;
}

export async function fetchMerchantConversations(request: Request) {
  return (await internalMerchantRequest(request, "/api/conversations")) as {
    conversations: MerchantConversation[];
  };
}

export async function fetchMerchantConversationDetail(
  request: Request,
  conversationId: string,
) {
  return (await internalMerchantRequest(
    request,
    `/api/conversations/${conversationId}`,
  )) as MerchantConversationDetail;
}

export async function sendMerchantConversationReply(
  request: Request,
  conversationId: string,
  text: string,
) {
  return internalMerchantRequest(request, `/api/conversations/${conversationId}/reply`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function updateMerchantConversationStatus(
  request: Request,
  conversationId: string,
  status: "ai" | "human" | "resolved",
) {
  return internalMerchantRequest(request, `/api/conversations/${conversationId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function fetchMerchantCustomers(
  request: Request,
  input?: { page?: number; limit?: number; segment?: string; search?: string },
) {
  const query = new URLSearchParams();
  query.set("page", String(input?.page || 1));
  query.set("limit", String(input?.limit || 20));
  if (input?.segment && input.segment !== "all") query.set("segment", input.segment);
  if (input?.search) query.set("search", input.search);

  return (await internalMerchantRequest(
    request,
    `/api/customers?${query.toString()}`,
  )) as {
    customers: MerchantCustomer[];
    total: number;
    page: number;
    limit: number;
  };
}
