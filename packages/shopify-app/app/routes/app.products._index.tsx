import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useSearchParams,
  useSubmit,
} from "react-router";
import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { DeleteIcon, MagicIcon } from "@shopify/polaris-icons";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  Collapsible,
  EmptyState,
  InlineGrid,
  InlineStack,
  Layout,
  Modal,
  Page,
  ProgressBar,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import {
  createMerchantProduct,
  deleteMerchantProduct,
  enrichMerchantProductFromUrl,
  fetchMerchantMultiLangSettings,
  fetchMerchantProductInstructions,
  fetchMerchantProducts,
  fetchMerchantProductFacts,
  fetchShopifyCatalog,
  generateMerchantProductEmbeddings,
  previewMerchantProductAnswer,
  scrapeMerchantProduct,
  type MerchantProduct,
  type MerchantProductInstruction,
  type ProductStepOutcome,
  type ProductFactsSnapshot,
  type ShopifyCatalogProduct,
  updateMerchantProductInstruction,
} from "../platform.server";
import {
  canCreateRecipe,
  getPlanSnapshotByDomain,
  registerRecipeProduct,
} from "../services/planService.server";

type MappingDraft = {
  usage_instructions: string;
  recipe_summary: string;
  prevention_tips: string;
  video_url: string;
};

type StepOutcomeState = ProductStepOutcome & {
  message?: string;
  intent?: string;
};

type ActionResult = {
  ok: boolean;
  intent?: string;
  message?: string;
  error?: string;
  productId?: string;
  productName?: string;
  selectedProductId?: string;
  stepOutcomes?: StepOutcomeState[];
  savedDraft?: MappingDraft;
  previewAnswer?: string;
  previewQuestion?: string;
};

type SetupState = "needs_setup" | "in_progress" | "ready";
type JourneyStep = "guidance" | "improve" | "ready";

type WorkspaceRow = {
  shopify: ShopifyCatalogProduct;
  localProduct?: MerchantProduct;
  instruction?: MerchantProductInstruction;
  factsSnapshot?: ProductFactsSnapshot | null;
  linked: boolean;
  hasGuidance: boolean;
  hasOptionalDetails: boolean;
  hasKnowledge: boolean;
  requiredLanguageCount: number;
  readyLanguageCount: number;
  languageCoverage: number;
  languageWorkflowEnabled: boolean;
  languageState: "not_started" | "pending" | "ready";
  sourceLanguage?: string | null;
  languageSummary: string;
  languageTone: "attention" | "info" | "success";
  progress: number;
  state: SetupState;
  statusLabel: string;
  statusTone: "attention" | "info" | "success";
  nextActionLabel: string;
  detailHint: string;
};

type SaveFeedback = {
  productId: string;
  message: string;
  savedAt: string;
};

type KnowledgeSummary = {
  howToUse: string;
  keyDetails: string[];
  commonQuestions: string[];
  warnings: string[];
  sources: string[];
  missingInfo: string[];
};

type JourneyMeta = {
  activeStep: JourneyStep;
  completedSteps: number;
  totalSteps: number;
  nextActionLabel: string;
  shortStatus: string;
};

function stripHtmlForRag(html?: string) {
  if (!html) return undefined;
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || undefined;
}

function emptyDraft(): MappingDraft {
  return {
    usage_instructions: "",
    recipe_summary: "",
    prevention_tips: "",
    video_url: "",
  };
}

function draftFromInstruction(instruction?: MerchantProductInstruction): MappingDraft {
  return {
    usage_instructions: instruction?.usage_instructions || "",
    recipe_summary: instruction?.recipe_summary || "",
    prevention_tips: instruction?.prevention_tips || "",
    video_url: instruction?.video_url || "",
  };
}

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatOutcomeDelta(delta?: Record<string, unknown>) {
  if (!delta) return "";

  const parts: string[] = [];
  if (typeof delta.source === "string") {
    parts.push(delta.source === "workflow_url" ? "extra source" : "product page");
  }
  if (typeof delta.chunksCreated === "number") {
    parts.push(`${delta.chunksCreated} chunks`);
  }
  if (typeof delta.totalTokens === "number") {
    parts.push(`${delta.totalTokens} tokens`);
  }
  if (typeof delta.jobId === "string") {
    parts.push(`job ${delta.jobId}`);
  }

  return parts.join(" • ");
}

function displayProductPath(url?: string) {
  if (!url) return "/";

  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function languageLabel(code?: string | null) {
  switch ((code || "").toLowerCase()) {
    case "tr":
      return "Turkish";
    case "hu":
      return "Hungarian";
    case "de":
      return "German";
    case "el":
      return "Greek";
    case "en":
    default:
      return "English";
  }
}

function summarizeText(text: string, maxLength = 140) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trim()}…`;
}

function getFactsArray(
  facts: Record<string, unknown> | null | undefined,
  key: string,
): string[] {
  const value = facts?.[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter((item) => item.trim());
}

function buildKnowledgeSummary(row: WorkspaceRow): KnowledgeSummary {
  const facts = (row.factsSnapshot?.facts_json || {}) as Record<string, unknown>;
  const identity = (facts.product_identity || {}) as Record<string, unknown>;
  const usageSteps = getFactsArray(facts, "usage_steps");
  const benefits = getFactsArray(facts, "benefits");
  const ingredients = getFactsArray(facts, "ingredients");
  const activeIngredients = getFactsArray(facts, "active_ingredients");
  const claims = getFactsArray(facts, "claims");
  const skinTypes = getFactsArray(facts, "target_skin_types");
  const warnings = [
    ...(row.instruction?.prevention_tips ? [row.instruction.prevention_tips] : []),
    ...getFactsArray(facts, "warnings"),
  ]
    .map((item) => summarizeText(String(item), 120))
    .filter(Boolean);

  const howToUseSource =
    row.instruction?.usage_instructions ||
    (usageSteps.length ? usageSteps.join(". ") : "");
  const howToUse = summarizeText(howToUseSource || "No usage guidance yet.", 160);

  const keyDetails: string[] = [];
  if (identity.brand) keyDetails.push(`Brand: ${identity.brand}`);
  if (identity.product_type) keyDetails.push(`Type: ${identity.product_type}`);
  if (identity.variant) keyDetails.push(`Variant: ${identity.variant}`);
  if (identity.volume_value && identity.volume_unit) {
    keyDetails.push(`Size: ${identity.volume_value} ${identity.volume_unit}`);
  }
  if (benefits.length) keyDetails.push(`Benefits: ${benefits.slice(0, 3).join(", ")}`);
  if (claims.length) keyDetails.push(`Claims: ${claims.slice(0, 3).join(", ")}`);
  if (skinTypes.length) keyDetails.push(`Best for: ${skinTypes.slice(0, 3).join(", ")}`);
  if (activeIngredients.length) keyDetails.push(`Active ingredients: ${activeIngredients.slice(0, 3).join(", ")}`);
  if (ingredients.length) keyDetails.push(`Ingredients: ${ingredients.slice(0, 3).join(", ")}`);
  if (row.instruction?.recipe_summary?.trim()) keyDetails.push(`Key features & ingredients: ${summarizeText(row.instruction.recipe_summary, 120)}`);

  const commonQuestions = [
    "How do I use this product?",
    keyDetails.length ? "What does this product help with?" : "",
    (ingredients.length || activeIngredients.length) ? "What are the key ingredients?" : "",
  ].filter(Boolean);

  const sources: string[] = [];
  if (row.localProduct?.url) sources.push("Product page");
  if (row.hasGuidance) sources.push("Merchant guidance");
  if (row.hasOptionalDetails) sources.push("Optional details");
  if (row.factsSnapshot?.source_url) sources.push("Structured product facts");

  const missingInfo: string[] = [];
  if (!row.instruction?.usage_instructions?.trim()) missingInfo.push("How to use the product");
  if (!warnings.length) missingInfo.push("Warnings or important notes");
  
  const hasManualFeatures = Boolean(row.instruction?.recipe_summary?.trim());
  if (!benefits.length && !claims.length && !hasManualFeatures) missingInfo.push("Key benefits");
  if (!ingredients.length && !activeIngredients.length && !hasManualFeatures) missingInfo.push("Ingredients");

  return {
    howToUse,
    keyDetails,
    commonQuestions,
    warnings,
    sources: sources.length ? sources : ["No sources connected yet"],
    missingInfo,
  };
}

function getJourneyMeta(row: WorkspaceRow): JourneyMeta {
  const guidanceDone = row.linked && row.hasGuidance;
  const improveDone = row.hasKnowledge;
  const totalSteps = 2;
  const completedSteps = [guidanceDone, improveDone].filter(Boolean).length;

  if (!guidanceDone) {
    return {
      activeStep: "guidance",
      completedSteps,
      totalSteps,
      nextActionLabel: "Continue",
      shortStatus: "Write what customers should know",
    };
  }
  if (!improveDone) {
    return {
      activeStep: "improve",
      completedSteps,
      totalSteps,
      nextActionLabel: "Continue",
      shortStatus: "Improve AI replies",
    };
  }
  return {
    activeStep: "ready",
    completedSteps: totalSteps,
    totalSteps,
    nextActionLabel: "Review",
    shortStatus: "Setup complete",
  };
}

function buildWorkspaceRows(
  catalogProducts: ShopifyCatalogProduct[],
  merchantProducts: MerchantProduct[],
  instructions: MerchantProductInstruction[],
  productFacts: ProductFactsSnapshot[],
  serviceLanguages: string[],
  multiLangEnabled: boolean,
): WorkspaceRow[] {
  const localByExternalId = new Map(
    merchantProducts
      .filter((product) => product.external_id)
      .map((product) => [product.external_id as string, product]),
  );
  const instructionsByExternalId = new Map<string, MerchantProductInstruction>();
  const instructionsByProductId = new Map<string, MerchantProductInstruction>();

  for (const instruction of instructions) {
    if (instruction.external_id) instructionsByExternalId.set(instruction.external_id, instruction);
    instructionsByProductId.set(instruction.product_id, instruction);
  }

  const factsByProductId = new Map(
    (productFacts || []).map((fact) => [fact.product_id, fact]),
  );

  const catalogExternalIds = new Set(catalogProducts.map((p) => p.id));
  const combinedProducts = [...catalogProducts];

  for (const mp of merchantProducts) {
    if (!mp.external_id || !catalogExternalIds.has(mp.external_id)) {
      combinedProducts.push({
        id: mp.id,
        title: mp.name || "Manual Source",
        handle: `manual-${mp.id.slice(0, 8)}`,
        status: "ACTIVE",
        vendor: "Manual Entry",
        featuredImageUrl: undefined,
      });
      localByExternalId.set(mp.id, mp);
    }
  }

  return combinedProducts.map((shopify) => {
    const localProduct = localByExternalId.get(shopify.id);
    const instruction =
      instructionsByExternalId.get(shopify.id) ||
      (localProduct ? instructionsByProductId.get(localProduct.id) : undefined);
    const factsSnapshot = localProduct ? factsByProductId.get(localProduct.id) || null : null;
    const linked = Boolean(localProduct);
    const hasGuidance = Boolean(instruction?.usage_instructions?.trim());
    const hasOptionalDetails = Boolean(
      instruction?.recipe_summary?.trim() ||
        instruction?.prevention_tips?.trim() ||
        instruction?.video_url?.trim(),
    );
    const languageHealth = localProduct?.languageHealth || null;
    const languageWorkflowEnabled = multiLangEnabled && serviceLanguages.length > 1;
    const baseChunkCount = localProduct?.chunkCount || 0;
    const requiredLanguageCount = languageWorkflowEnabled
      ? languageHealth?.requiredLanguages.length || Math.max(1, serviceLanguages.length || 1)
      : 1;
    const readyLanguageCount = languageWorkflowEnabled
      ? languageHealth?.readyLanguages.length || 0
      : baseChunkCount > 0
        ? 1
        : 0;
    const languageCoverage = linked && hasGuidance
      ? languageWorkflowEnabled
        ? languageHealth?.answerCoverage ?? 0
        : baseChunkCount > 0
          ? 100
          : 0
      : 0;
    const hasKnowledge = readyLanguageCount > 0 || Boolean(baseChunkCount > 0);
    const languageState = languageWorkflowEnabled
      ? languageHealth?.state || "not_started"
      : baseChunkCount > 0
        ? "ready"
        : "not_started";
    const state: SetupState =
      !linked
        ? "needs_setup"
        : !hasGuidance
          ? "in_progress"
          : hasKnowledge
            ? "ready"
            : "in_progress";
    const progress = !linked
      ? 0
      : !hasGuidance
        ? 30
        : Math.min(100, Math.max(55, 55 + Math.round(languageCoverage * 0.45)));
    const languageSummary =
      !linked || !hasGuidance
        ? `Reply languages will be prepared after guidance is saved`
        : !languageWorkflowEnabled
          ? "Primary reply language is ready."
        : languageCoverage >= 100
          ? `Ready in ${readyLanguageCount}/${requiredLanguageCount} reply languages`
          : readyLanguageCount > 0
            ? `${readyLanguageCount}/${requiredLanguageCount} reply languages are ready. More are still syncing.`
            : languageState === "pending"
              ? `Language sync is running in the background`
              : `Reply languages will keep syncing in the background`;
    const languageTone =
      !linked || !hasGuidance
        ? "info"
        : languageCoverage >= 100
          ? "success"
          : readyLanguageCount > 0
            ? "attention"
            : "info";

    return {
      shopify,
      localProduct,
      instruction,
      factsSnapshot,
      linked,
      hasGuidance,
      hasOptionalDetails,
      hasKnowledge,
      requiredLanguageCount,
      readyLanguageCount,
      languageCoverage,
      languageWorkflowEnabled,
      languageState,
      sourceLanguage: languageHealth?.sourceLanguage || null,
      languageSummary,
      languageTone,
      progress,
      state,
      statusLabel:
        state === "ready" ? "Ready" : state === "in_progress" ? "In progress" : "Needs setup",
      statusTone:
        state === "ready" ? "success" : state === "in_progress" ? "info" : "attention",
      nextActionLabel:
        !linked
          ? "Add guidance"
          : !hasGuidance
            ? "Continue setup"
            : hasKnowledge
              ? "Review"
              : "Improve answers",
      detailHint:
        !linked
          ? "Save guidance to start setup"
          : !hasGuidance
            ? "Add guidance to finish setup"
            : hasKnowledge
              ? languageWorkflowEnabled && languageCoverage < 100
                ? "Answers are ready now. Extra language coverage will keep syncing in the background."
                : "Ready for customer replies."
              : "Use product content to prepare better customer answers.",
    };
  });
}

async function persistProductSetup({
  request,
  shopDomain,
  selectedProductId,
  title,
  handle,
  externalId,
  descriptionHtml,
  usageInstructions,
  recipeSummary,
  preventionTips,
  videoUrl,
  existingProductId,
}: {
  request: Request;
  shopDomain: string;
  selectedProductId: string;
  title: string;
  handle: string;
  externalId: string;
  descriptionHtml: string;
  usageInstructions: string;
  recipeSummary: string;
  preventionTips: string;
  videoUrl: string;
  existingProductId: string;
}) {
  if (!selectedProductId || !title || !handle || !externalId) {
    return {
      ok: false,
      selectedProductId,
      error: "Missing Shopify product context.",
    } satisfies ActionResult;
  }

  if (!usageInstructions) {
    return {
      ok: false,
      selectedProductId,
      error: "Customer guidance is required before saving.",
    } satisfies ActionResult;
  }

  let productId = existingProductId;
  if (!productId) {
    const plan = await getPlanSnapshotByDomain(shopDomain);
    const recipeCapacity = await canCreateRecipe(plan.shopId);

    if (!recipeCapacity.allowed) {
      return {
        ok: false,
        selectedProductId,
        error: "Product limit reached for the current plan. Upgrade before creating more product setups.",
      } satisfies ActionResult;
    }

    const createResponse = (await createMerchantProduct(request, {
      name: title,
      url: `https://${shopDomain}/products/${handle}`,
      external_id: externalId,
      raw_text: stripHtmlForRag(descriptionHtml),
    })) as { product?: { id?: string } };
    productId = createResponse.product?.id || "";
  }

  if (!productId) {
    return {
      ok: false,
      selectedProductId,
      error: "Failed to create the linked Recete product record.",
    } satisfies ActionResult;
  }

  const plan = await getPlanSnapshotByDomain(shopDomain);
  await registerRecipeProduct(plan.shopId, externalId, title);
  await updateMerchantProductInstruction(request, productId, {
    usage_instructions: usageInstructions,
    recipe_summary: recipeSummary || undefined,
    prevention_tips: preventionTips || undefined,
    video_url: videoUrl || undefined,
  });

  return {
    ok: true,
    productId,
    selectedProductId,
    savedDraft: {
      usage_instructions: usageInstructions,
      recipe_summary: recipeSummary,
      prevention_tips: preventionTips,
      video_url: videoUrl,
    },
  } satisfies ActionResult;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  const [catalog, merchantProducts, instructionPayload, multiLang] = await Promise.all([
    fetchShopifyCatalog(request, { first: 100 }),
    fetchMerchantProducts(request),
    fetchMerchantProductInstructions(request),
    fetchMerchantMultiLangSettings(request).catch(() => ({
      settings: {
        shop_id: "",
        default_source_lang: "en",
        enabled_langs: ["en"],
        multi_lang_rag_enabled: true,
      },
    })),
  ]);

  const productIds = (merchantProducts.products || []).map((product) => product.id);
  const factsPayload = await fetchMerchantProductFacts(request, productIds).catch(() => ({
    facts: [] as ProductFactsSnapshot[],
  }));

  return {
    shopDomain: catalog.shopDomain,
    catalogProducts: catalog.products,
    merchantProducts: merchantProducts.products || [],
    instructions: instructionPayload.instructions || [],
    productFacts: factsPayload.facts || [],
    serviceLanguages: multiLang.settings.enabled_langs || ["en"],
    multiLangEnabled: multiLang.settings.multi_lang_rag_enabled !== false,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateEmbeddedAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "").trim();

  try {
    switch (intent) {
      case "create": {
        const name = String(formData.get("name") || "").trim();
        const url = String(formData.get("url") || "").trim();
        const enrichmentUrl = String(formData.get("enrichmentUrl") || "").trim();

        if (!name || !url) {
          return { ok: false, intent, error: "Name and URL are required." } satisfies ActionResult;
        }

        const created = (await createMerchantProduct(request, { name, url })) as {
          product?: { id?: string };
        };
        const createdId = created?.product?.id;

        if (!createdId) {
          return {
            ok: true,
            intent,
            message: "Manual source created.",
          } satisfies ActionResult;
        }

        const stepOutcomes: StepOutcomeState[] = [];
        let message = "Manual source created.";

        if (enrichmentUrl) {
          const enrich = await enrichMerchantProductFromUrl(request, createdId, enrichmentUrl);
          if (enrich.stepOutcome) {
            stepOutcomes.push({
              ...enrich.stepOutcome,
              message: enrich.message,
              intent,
            });
          }
          message = "Manual source created and extra source added.";
        }

        return {
          ok: true,
          intent,
          productId: createdId,
          message,
          stepOutcomes,
        } satisfies ActionResult;
      }
      case "save-setup":
      case "mark-ready": {
        const result = await persistProductSetup({
          request,
          shopDomain: session.shop,
          selectedProductId: String(formData.get("selected_product_id") || "").trim(),
          title: String(formData.get("title") || "").trim(),
          handle: String(formData.get("handle") || "").trim(),
          externalId: String(formData.get("external_id") || "").trim(),
          descriptionHtml: String(formData.get("description_html") || ""),
          usageInstructions: String(formData.get("usage_instructions") || "").trim(),
          recipeSummary: String(formData.get("recipe_summary") || "").trim(),
          preventionTips: String(formData.get("prevention_tips") || "").trim(),
          videoUrl: String(formData.get("video_url") || "").trim(),
          existingProductId: String(formData.get("existing_product_id") || "").trim(),
        });

        if (!result.ok) {
          return { ...result, intent } satisfies ActionResult;
        }

        return {
          ...result,
          ok: true,
          intent,
          message:
            intent === "mark-ready"
              ? "Product marked ready."
              : "Customer guidance saved.",
        } satisfies ActionResult;
      }
      case "embeddings": {
        const productId = String(formData.get("productId") || "").trim();
        const productName = String(formData.get("productName") || "").trim();
        const selectedProductId = String(formData.get("shopifyProductId") || "").trim();
        const hasContent = String(formData.get("hasContent") || "").trim() === "true";
        const enrichmentUrl = String(formData.get("enrichmentUrl") || "").trim();

        console.info("[products-action:embeddings] start", {
          shop: session.shop,
          intent,
          productId,
          productName,
          selectedProductId,
          hasContent,
          hasEnrichmentUrl: Boolean(enrichmentUrl),
        });

        if (!productId) {
          console.warn("[products-action:embeddings] missing-product-id", {
            shop: session.shop,
            intent,
            selectedProductId,
            productName,
          });
          return { ok: false, intent, selectedProductId, error: "Missing product id." } satisfies ActionResult;
        }

        const stepOutcomes: StepOutcomeState[] = [];

        if (enrichmentUrl) {
          const enrich = await enrichMerchantProductFromUrl(request, productId, enrichmentUrl);
          if (enrich.stepOutcome) {
            stepOutcomes.push({
              ...enrich.stepOutcome,
              message: enrich.message,
              intent,
            });
          }
        } else if (!hasContent) {
          const scrape = await scrapeMerchantProduct(request, productId);
          if (scrape.stepOutcome) {
            stepOutcomes.push({
              ...scrape.stepOutcome,
              message: scrape.message,
              intent,
            });
          }
        }

        console.info("[products-action:embeddings] generate-request", {
          shop: session.shop,
          productId,
          selectedProductId,
          stepOutcomesBeforeGenerate: stepOutcomes.length,
        });
        const generated = await generateMerchantProductEmbeddings(request, productId);
        console.info("[products-action:embeddings] generate-response", {
          shop: session.shop,
          productId,
          selectedProductId,
          status: generated?.status,
          message: generated?.message,
          hasStepOutcome: Boolean(generated?.stepOutcome),
        });
        if (generated.stepOutcome) {
          stepOutcomes.push({
            ...generated.stepOutcome,
            message: generated.message,
            intent,
          });
        }

        return {
          ok: true,
          intent,
          productId,
          productName,
          selectedProductId,
          message: `${productName || "Product"} answers improved with product context.`,
          stepOutcomes,
        } satisfies ActionResult;
      }
      case "delete": {
        const productId = String(formData.get("productId") || "").trim();
        const productName = String(formData.get("productName") || "").trim();
        const selectedProductId = String(formData.get("shopifyProductId") || "").trim();

        if (!productId) {
          return { ok: false, intent, selectedProductId, error: "Missing product id." } satisfies ActionResult;
        }

        await deleteMerchantProduct(request, productId);
        return {
          ok: true,
          intent,
          productId,
          productName,
          selectedProductId,
          message: `${productName || "Product"} local setup removed.`,
        } satisfies ActionResult;
      }
      case "preview-answer": {
        const productId = String(formData.get("productId") || "").trim();
        const selectedProductId = String(formData.get("shopifyProductId") || "").trim();
        const question = String(formData.get("question") || "").trim();

        if (!productId) {
          return { ok: false, intent, selectedProductId, error: "Missing product id." } satisfies ActionResult;
        }
        if (!question) {
          return { ok: false, intent, selectedProductId, error: "Question is required." } satisfies ActionResult;
        }

        const result = await previewMerchantProductAnswer(request, productId, question);
        if (result.error) {
          return { ok: false, intent, selectedProductId, error: result.error } satisfies ActionResult;
        }

        return {
          ok: true,
          intent,
          selectedProductId,
          previewAnswer: result.answer || "",
          previewQuestion: question,
        } satisfies ActionResult;
      }
      default:
        return { ok: false, intent, error: "Unknown action." } satisfies ActionResult;
    }
  } catch (error) {
    console.error("[products-action] failed", {
      shop: session.shop,
      intent,
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof Response) {
      throw error;
    }

    return {
      ok: false,
      intent,
      error: error instanceof Error ? error.message : "Product action failed.",
    } satisfies ActionResult;
  }
};

export default function ProductsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [showProductBrowser, setShowProductBrowser] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [manualSourceDraft, setManualSourceDraft] = useState({
    name: "",
    url: "",
    enrichmentUrl: "",
  });
  const [drafts, setDrafts] = useState<Record<string, MappingDraft>>({});
  const [savedDrafts, setSavedDrafts] = useState<Record<string, MappingDraft>>({});
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [inlineValidationError, setInlineValidationError] = useState<string | null>(null);
  const [showOptionalByProduct, setShowOptionalByProduct] = useState<Record<string, boolean>>({});
  const [workflowUrlByProduct, setWorkflowUrlByProduct] = useState<Record<string, string>>({});
  const [previewQuestionByProduct, setPreviewQuestionByProduct] = useState<Record<string, string>>({});
  const [previewAnswerByProduct, setPreviewAnswerByProduct] = useState<Record<string, string>>({});
  const [recentActionByProduct, setRecentActionByProduct] = useState<Record<string, number>>({});
  const [outcomesByProduct, setOutcomesByProduct] = useState<
    Record<string, Partial<Record<ProductStepOutcome["step"], StepOutcomeState>>>
  >({});
  const busy = navigation.state === "submitting";
  const revalidator = useRevalidator();

  const rows = useMemo(
    () => buildWorkspaceRows(
      data.catalogProducts,
      data.merchantProducts,
      data.instructions,
      data.productFacts,
      data.serviceLanguages,
      data.multiLangEnabled,
    ),
    [
      data.catalogProducts,
      data.instructions,
      data.merchantProducts,
      data.multiLangEnabled,
      data.productFacts,
      data.serviceLanguages,
    ],
  );
  const summary = useMemo(
    () => ({
      total: rows.length,
      needsSetup: rows.filter((row) => row.state === "needs_setup").length,
      inProgress: rows.filter((row) => row.state === "in_progress").length,
      ready: rows.filter((row) => row.state === "ready").length,
      languageUpdates: rows.filter(
        (row) => row.languageWorkflowEnabled && row.linked && row.hasGuidance && row.languageCoverage < 100,
      ).length,
    }),
    [rows],
  );
  const searchedRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return rows;

    return rows.filter((row) => {
      const title = row.shopify.title.toLowerCase();
      const handle = row.shopify.handle.toLowerCase();
      const vendor = row.shopify.vendor?.toLowerCase() || "";
      return title.includes(query) || handle.includes(query) || vendor.includes(query);
    });
  }, [rows, searchQuery]);
  const nextIncompleteProduct = useMemo(
    () => rows.find((row) => getJourneyMeta(row).activeStep !== "ready") || null,
    [rows],
  );

  const requestedProductId = searchParams.get("product") || "";
  const [selectedProductId, setSelectedProductId] = useState<string>(requestedProductId || "");
  const [hasInitializedSelection, setHasInitializedSelection] = useState(Boolean(requestedProductId));

  useEffect(() => {
    if (hasInitializedSelection || selectedProductId || rows.length === 0) return;

    if (requestedProductId && rows.some((row) => row.shopify.id === requestedProductId)) {
      setSelectedProductId(requestedProductId);
      replaceProductSearchParam(requestedProductId);
    }
    setHasInitializedSelection(true);
  }, [hasInitializedSelection, nextIncompleteProduct, requestedProductId, rows, selectedProductId]);

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (!next[row.shopify.id]) {
          next[row.shopify.id] = draftFromInstruction(row.instruction);
        }
      }
      return next;
    });
  }, [rows]);

  useEffect(() => {
    if (!selectedProductId) return;
    if (searchedRows.length === 0) {
      setSelectedProductId("");
      replaceProductSearchParam(null);
      return;
    }
    if (!searchedRows.some((row) => row.shopify.id === selectedProductId)) {
      const nextId = searchedRows[0]?.shopify.id;
      if (!nextId) return;
      setSelectedProductId(nextId);
      replaceProductSearchParam(nextId);
    }
  }, [searchedRows, selectedProductId]);

  useEffect(() => {
    if (actionData?.selectedProductId) {
      setSelectedProductId(actionData.selectedProductId);
      replaceProductSearchParam(actionData.selectedProductId);
      setHasInitializedSelection(true);
    }
  }, [actionData?.selectedProductId]);

  useEffect(() => {
    if (!(actionData?.selectedProductId && actionData?.stepOutcomes?.length)) return;

    setOutcomesByProduct((current) => {
      const next = { ...(current[actionData.selectedProductId as string] || {}) };
      for (const outcome of actionData.stepOutcomes || []) {
        next[outcome.step] = outcome;
      }
      return {
        ...current,
        [actionData.selectedProductId as string]: next,
      };
    });
  }, [actionData]);

  useEffect(() => {
    if (
      actionData?.ok &&
      (actionData.intent === "save-setup" || actionData.intent === "mark-ready") &&
      actionData.selectedProductId &&
      actionData.savedDraft &&
      actionData.message
    ) {
      setSavedDrafts((current) => ({
        ...current,
        [actionData.selectedProductId as string]: actionData.savedDraft as MappingDraft,
      }));
      setDrafts((current) => ({
        ...current,
        [actionData.selectedProductId as string]: actionData.savedDraft as MappingDraft,
      }));
      setSaveFeedback({
        productId: actionData.selectedProductId,
        message: actionData.message,
        savedAt: new Date().toISOString(),
      });
    }
  }, [actionData]);

  useEffect(() => {
    if (!(actionData?.ok && actionData.intent === "delete" && actionData.selectedProductId)) return;

    setDrafts((current) => ({
      ...current,
      [actionData.selectedProductId as string]: emptyDraft(),
    }));
    setSavedDrafts((current) => {
      const next = { ...current };
      delete next[actionData.selectedProductId as string];
      return next;
    });
    setSaveFeedback(null);
  }, [actionData]);

  useEffect(() => {
    if (actionData?.ok && actionData.intent === "create") {
      setShowManualEntryModal(false);
      setManualSourceDraft({ name: "", url: "", enrichmentUrl: "" });
    }
  }, [actionData]);

  useEffect(() => {
    if (
      actionData?.ok &&
      actionData.intent === "preview-answer" &&
      actionData.selectedProductId
    ) {
      setPreviewQuestionByProduct((current) => ({
        ...current,
        [actionData.selectedProductId as string]: actionData.previewQuestion || current[actionData.selectedProductId as string] || "",
      }));
      setPreviewAnswerByProduct((current) => ({
        ...current,
        [actionData.selectedProductId as string]: actionData.previewAnswer || "",
      }));
    }
  }, [actionData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem("recete_recent_product_action");
    if (!stored) return;
    window.sessionStorage.removeItem("recete_recent_product_action");
    try {
      const parsed = JSON.parse(stored) as { productId?: string; action?: string; startedAt?: number };
      if (parsed?.productId && parsed?.action === "embeddings") {
        setRecentActionByProduct((current) => ({
          ...current,
          [parsed.productId as string]: parsed.startedAt || Date.now(),
        }));
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  useEffect(() => {
    if (!(actionData?.intent === "embeddings" && !actionData.ok && actionData.selectedProductId)) return;

    setRecentActionByProduct((current) => {
      if (!(actionData.selectedProductId as string in current)) return current;
      const next = { ...current };
      delete next[actionData.selectedProductId as string];
      return next;
    });
  }, [actionData]);

  useEffect(() => {
    if (Object.keys(recentActionByProduct).length === 0) return;

    const interval = window.setInterval(() => {
      if (revalidator.state === "idle") {
        revalidator.revalidate();
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [recentActionByProduct, revalidator]);

  useEffect(() => {
    if (Object.keys(recentActionByProduct).length === 0) return;

    setRecentActionByProduct((current) => {
      let changed = false;
      const next = { ...current };

      for (const row of rows) {
        const startedAt = next[row.shopify.id];
        if (!startedAt) continue;

        const expired = Date.now() - startedAt > 120000;
        const completed = row.languageCoverage >= 100 || row.state === "ready";
        if (completed || expired) {
          delete next[row.shopify.id];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [rows, recentActionByProduct]);

  const selectedRow = searchedRows.find((row) => row.shopify.id === selectedProductId) || null;
  const selectedJourney = selectedRow ? getJourneyMeta(selectedRow) : null;
  const isSingleTaskMode = Boolean(
    selectedRow && selectedJourney && selectedJourney.activeStep !== "ready",
  );
  const currentDraft = selectedRow ? drafts[selectedRow.shopify.id] || emptyDraft() : emptyDraft();
  const initialDraft = selectedRow
    ? savedDrafts[selectedRow.shopify.id] || draftFromInstruction(selectedRow.instruction)
    : emptyDraft();
  const dirty = JSON.stringify(currentDraft) !== JSON.stringify(initialDraft);
  const selectedSaveFeedback =
    selectedRow && saveFeedback?.productId === selectedRow.shopify.id ? saveFeedback : null;
  const optionalVisible = selectedRow ? Boolean(showOptionalByProduct[selectedRow.shopify.id]) : false;
  const workflowUrl = selectedRow ? workflowUrlByProduct[selectedRow.shopify.id] || "" : "";
  const previewQuestion = selectedRow
    ? previewQuestionByProduct[selectedRow.shopify.id] || "How do I use this product?"
    : "How do I use this product?";
  const previewAnswer = selectedRow ? previewAnswerByProduct[selectedRow.shopify.id] || "" : "";
  const recentAction = selectedRow ? Boolean(recentActionByProduct[selectedRow.shopify.id]) : false;
  const handlePreviewQuestionChange = (productId: string, value: string) => {
    setPreviewQuestionByProduct((current) => ({
      ...current,
      [productId]: value,
    }));
  };
  const markEmbeddingsStart = (productId: string) => {
    const startedAt = Date.now();
    setRecentActionByProduct((current) => ({
      ...current,
      [productId]: startedAt,
    }));
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "recete_recent_product_action",
        JSON.stringify({ productId, action: "embeddings", startedAt }),
      );
    }
  };
  const currentIntent = String(navigation.formData?.get("intent") || "");
  const currentSelectedProductId = String(
    navigation.formData?.get("selected_product_id") || navigation.formData?.get("shopifyProductId") || "",
  );
  const isSavingSetup =
    navigation.state === "submitting" &&
    currentSelectedProductId === selectedRow?.shopify.id &&
    (currentIntent === "save-setup" || currentIntent === "mark-ready");
  const isRunningAiAction =
    navigation.state === "submitting" &&
    currentSelectedProductId === selectedRow?.shopify.id &&
    currentIntent === "embeddings";
  const isDeletingLocalSetup =
    navigation.state === "submitting" &&
    currentSelectedProductId === selectedRow?.shopify.id &&
    currentIntent === "delete";
  const isPreviewingAnswer =
    navigation.state === "submitting" &&
    currentSelectedProductId === selectedRow?.shopify.id &&
    currentIntent === "preview-answer";

  function replaceProductSearchParam(productId: string | null) {
    if (typeof window === "undefined") return;

    const next = new URLSearchParams(window.location.search);
    if (productId) {
      next.set("product", productId);
    } else {
      next.delete("product");
    }

    const query = next.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }

  function handleSelectProduct(productId: string, forceOpen = false) {
    const nextProductId = forceOpen ? productId : selectedProductId === productId ? "" : productId;
    setSelectedProductId(nextProductId);
    setHasInitializedSelection(true);
    setInlineValidationError(null);
    replaceProductSearchParam(nextProductId || null);
  }

  function closeSelectedProduct() {
    setSelectedProductId("");
    setHasInitializedSelection(true);
    setInlineValidationError(null);
    replaceProductSearchParam(null);
    setShowProductBrowser(true);
  }

  function openProductBrowser() {
    closeSelectedProduct();
    if (typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      document.getElementById("all-products-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (navigation.state === "loading" && rows.length === 0) {
    return (
      <SkeletonPage title="Products" primaryAction>
        <Layout>
          <Layout.Section>
            <Box padding="400" borderWidth="025" borderColor="border" borderRadius="200">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={4} />
            </Box>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page
      fullWidth
      title="Products"
      subtitle="Set up each Shopify product so Recete can help customers after delivery."
      secondaryActions={
        selectedRow
          ? []
          : [
              {
                content: "Add manual source",
                onAction: () => setShowManualEntryModal(true),
              },
            ]
      }
    >
      <Layout>
        {busy ? (
          <Layout.Section>
            <Spinner accessibilityLabel="Updating products" size="small" />
          </Layout.Section>
        ) : null}

        {actionData?.message && actionData.intent === "create" ? (
          <Layout.Section>
            <Banner tone="success" title="Manual source added">
              <Text as="p" variant="bodyMd">
                {actionData.message}
              </Text>
            </Banner>
          </Layout.Section>
        ) : null}

        {actionData?.error && !actionData.selectedProductId ? (
          <Layout.Section>
            <Banner tone="critical" title="Product action failed">
              <Text as="p" variant="bodyMd">
                {actionData.error}
              </Text>
            </Banner>
          </Layout.Section>
        ) : null}

        {!selectedRow ? (
          <Layout.Section>
            <Box padding="300" borderWidth="025" borderColor="border" borderRadius="200">
              <BlockStack gap="300">
                <InlineGrid columns={{ xs: 2, md: 4 }} gap="200">
                  <TopStat label="Total products" value={summary.total} />
                  <TopStat label="Needs setup" value={summary.needsSetup} />
                  <TopStat label="In progress" value={summary.inProgress} />
                  <TopStat label="Ready" value={summary.ready} />
                </InlineGrid>
                <InlineStack align="space-between" blockAlign="center" gap="200" wrap>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {nextIncompleteProduct
                      ? "Open the next product and finish one step at a time."
                      : "All products are ready."}
                  </Text>
                  <Button
                    variant="primary"
                    disabled={!nextIncompleteProduct}
                    onClick={() => {
                      if (!nextIncompleteProduct) return;
                      handleSelectProduct(nextIncompleteProduct.shopify.id, true);
                    }}
                  >
                    Open next product
                  </Button>
                </InlineStack>
              </BlockStack>
            </Box>
          </Layout.Section>
        ) : null}

        {summary.total > 0 && summary.ready === summary.total ? (
          <Layout.Section>
            <Box padding="300" background="bg-fill-success-secondary" borderRadius="200">
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  You&apos;re all set
                </Text>
                <Text as="p" variant="bodyMd">
                  All products are ready. Recete can now answer customer questions after delivery.
                </Text>
                <InlineStack gap="200" wrap>
                  <Button url="/app/dashboard" variant="primary">
                    Go to dashboard
                  </Button>
                  <Button url="/app/conversations" variant="secondary">
                    View conversations
                  </Button>
                </InlineStack>
              </BlockStack>
            </Box>
          </Layout.Section>
        ) : null}

        {selectedRow ? (
          <Layout.Section>
            <SetupPanel
              row={selectedRow}
              shopDomain={data.shopDomain}
              draft={currentDraft}
              dirty={dirty}
              optionalVisible={optionalVisible}
              workflowUrl={workflowUrl}
              saveFeedback={selectedSaveFeedback}
              inlineValidationError={inlineValidationError}
              actionError={
                actionData?.error && actionData.selectedProductId === selectedRow.shopify.id
                  ? actionData.error
                  : null
              }
              actionMessage={
                actionData?.ok &&
                actionData.selectedProductId === selectedRow.shopify.id &&
                actionData.message
                  ? actionData.message
                  : null
              }
              actionIntent={
                actionData?.ok && actionData.selectedProductId === selectedRow.shopify.id
                  ? actionData.intent || null
                  : null
              }
              previewQuestion={previewQuestion}
              previewAnswer={previewAnswer}
              onPreviewQuestionChange={(value) => handlePreviewQuestionChange(selectedRow.shopify.id, value)}
              recentAction={recentAction}
              onEmbeddingsStart={() => markEmbeddingsStart(selectedRow.shopify.id)}
              stepOutcomes={outcomesByProduct[selectedRow.shopify.id]}
              isSavingSetup={isSavingSetup}
              isRunningAiAction={isRunningAiAction}
              isDeletingLocalSetup={isDeletingLocalSetup}
              isPreviewingAnswer={isPreviewingAnswer}
              onChangeDraft={(field, value) =>
                setDrafts((current) => ({
                  ...current,
                  [selectedRow.shopify.id]: {
                    ...(current[selectedRow.shopify.id] || emptyDraft()),
                    [field]: value,
                  },
                }))
              }
              onToggleOptional={() =>
                setShowOptionalByProduct((current) => ({
                  ...current,
                  [selectedRow.shopify.id]: !Boolean(current[selectedRow.shopify.id]),
                }))
              }
              onWorkflowUrlChange={(value) =>
                setWorkflowUrlByProduct((current) => ({
                  ...current,
                  [selectedRow.shopify.id]: value,
                }))
              }
              setInlineValidationError={setInlineValidationError}
              onBackToProducts={openProductBrowser}
            />
          </Layout.Section>
        ) : null}

        {!isSingleTaskMode ? (
          <Layout.Section>
            <Box id="all-products-panel" padding="300" borderWidth="025" borderColor="border" borderRadius="300">
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center" gap="200" wrap>
                  <BlockStack gap="050">
                    <Text as="h2" variant="headingMd">
                      All products
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Choose a product to continue its setup journey.
                    </Text>
                  </BlockStack>
                  <Button
                    variant="tertiary"
                    onClick={() => setShowProductBrowser((current) => !current)}
                    ariaExpanded={showProductBrowser}
                    ariaControls="all-products-list"
                  >
                    {showProductBrowser ? "Hide products" : `Show products (${searchedRows.length})`}
                  </Button>
                </InlineStack>

                <Collapsible open={showProductBrowser || !selectedRow} id="all-products-list">
                  <BlockStack gap="300">
                    <InlineGrid columns={{ xs: 1, md: "2fr auto" }} gap="200">
                      <TextField
                        label="Search products"
                        labelHidden
                        autoComplete="off"
                        placeholder="Search by product title, handle, or vendor"
                        value={searchQuery}
                        onChange={setSearchQuery}
                      />
                      <Text as="p" variant="bodySm" tone="subdued">
                        {searchedRows.length} {searchedRows.length === 1 ? "product" : "products"} shown
                      </Text>
                    </InlineGrid>

                    {searchedRows.length > 0 ? (
                      <BlockStack gap="200">
                        {searchedRows.map((row) => (
                          <ProductBrowserItem
                            key={row.shopify.id}
                            row={row}
                            shopDomain={data.shopDomain}
                            selected={row.shopify.id === selectedProductId}
                            recentAction={Boolean(recentActionByProduct[row.shopify.id])}
                            onSelect={() => {
                              handleSelectProduct(row.shopify.id, true);
                              setShowProductBrowser(false);
                            }}
                          />
                        ))}
                      </BlockStack>
                    ) : (
                      <Box padding="400" borderWidth="025" borderColor="border" borderRadius="200">
                        <EmptyState
                          heading="No products match this view"
                          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                        >
                          Try a different filter or search term.
                        </EmptyState>
                      </Box>
                    )}
                  </BlockStack>
                </Collapsible>
              </BlockStack>
            </Box>
          </Layout.Section>
        ) : null}
      </Layout>

      <Modal
        open={showManualEntryModal}
        onClose={() => setShowManualEntryModal(false)}
        title="Add manual source"
        primaryAction={{
          content: "Create manual source",
          onAction: () => {
            const form = document.getElementById("manual-source-form") as HTMLFormElement | null;
            if (form) form.requestSubmit();
          },
          loading: busy,
          disabled: busy,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowManualEntryModal(false),
            disabled: busy,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Banner tone="info">
              <Text as="p" variant="bodySm">
                Use this only when a product does not exist in Shopify and still needs response content.
              </Text>
            </Banner>
            <Form method="post" id="manual-source-form">
              <input type="hidden" name="intent" value="create" />
              <BlockStack gap="300">
                <TextField
                  label="Product name"
                  name="name"
                  value={manualSourceDraft.name}
                  onChange={(value) =>
                    setManualSourceDraft((current) => ({
                      ...current,
                      name: value,
                    }))
                  }
                  autoComplete="off"
                  placeholder="Hydrating cleanser"
                />
                <TextField
                  label="Product URL"
                  name="url"
                  value={manualSourceDraft.url}
                  onChange={(value) =>
                    setManualSourceDraft((current) => ({
                      ...current,
                      url: value,
                    }))
                  }
                  autoComplete="off"
                  placeholder="https://example.com/products/hydrating-cleanser"
                />
                <TextField
                  label="Extra source URL"
                  name="enrichmentUrl"
                  value={manualSourceDraft.enrichmentUrl}
                  onChange={(value) =>
                    setManualSourceDraft((current) => ({
                      ...current,
                      enrichmentUrl: value,
                    }))
                  }
                  autoComplete="off"
                  helpText="Optional second source to add more context right after creation."
                  placeholder="https://example.com/blog/how-to-use-product"
                />
              </BlockStack>
            </Form>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

function TopStat({ label, value }: { label: string; value: number }) {
  return (
    <Box padding="150">
      <BlockStack gap="050">
        <Text as="p" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="headingMd">
          {value}
        </Text>
      </BlockStack>
    </Box>
  );
}

function ProductGroupSection({
  title,
  hint,
  rows,
  selectedRow,
  shopDomain,
  currentDraft,
  dirty,
  optionalVisible,
  workflowUrl,
  saveFeedback,
  inlineValidationError,
  actionData,
  outcomesByProduct,
  isSavingSetup,
  isRunningAiAction,
  isDeletingLocalSetup,
  onSelect,
  previewQuestion,
  previewAnswer,
  onPreviewQuestionChange,
  recentActionByProduct,
  onEmbeddingsStart,
  setDrafts,
  setShowOptionalByProduct,
  setWorkflowUrlByProduct,
  setInlineValidationError,
  quiet = false,
}: {
  title: string;
  hint?: string;
  rows: WorkspaceRow[];
  selectedRow: WorkspaceRow | null;
  shopDomain: string;
  currentDraft: MappingDraft;
  dirty: boolean;
  optionalVisible: boolean;
  workflowUrl: string;
  saveFeedback: SaveFeedback | null;
  inlineValidationError: string | null;
  actionData: ActionResult | undefined;
  outcomesByProduct: Record<string, Partial<Record<ProductStepOutcome["step"], StepOutcomeState>>>;
  isSavingSetup: boolean;
  isRunningAiAction: boolean;
  isDeletingLocalSetup: boolean;
  onSelect: (productId: string) => void;
  previewQuestion: string;
  previewAnswer: string;
  onPreviewQuestionChange: (productId: string, value: string) => void;
  recentActionByProduct: Record<string, number>;
  onEmbeddingsStart: (productId: string) => void;
  setDrafts: Dispatch<SetStateAction<Record<string, MappingDraft>>>;
  setShowOptionalByProduct: Dispatch<SetStateAction<Record<string, boolean>>>;
  setWorkflowUrlByProduct: Dispatch<SetStateAction<Record<string, string>>>;
  setInlineValidationError: (value: string | null) => void;
  quiet?: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <BlockStack gap="150">
      {title ? (
        <InlineStack align="space-between" blockAlign="center" gap="200" wrap>
          <Text as="h2" variant="headingSm">
            {title}
          </Text>
          {hint ? (
            <Text as="p" variant="bodySm" tone="subdued">
              {hint}
            </Text>
          ) : null}
        </InlineStack>
      ) : null}
      <BlockStack gap="200">
        {rows.map((row) => {
          const isSelected = row.shopify.id === selectedRow?.shopify.id;
          const recentAction = Boolean(recentActionByProduct[row.shopify.id]);

          return (
            <ProductListItem
              key={row.shopify.id}
              row={row}
              shopDomain={shopDomain}
              selected={isSelected}
              recentAction={recentAction}
              onSelect={() => onSelect(row.shopify.id)}
              quiet={quiet}
            >
              {isSelected ? (
                <SetupPanel
                  row={row}
                  shopDomain={shopDomain}
                  draft={currentDraft}
                  dirty={dirty}
                  optionalVisible={optionalVisible}
                  workflowUrl={workflowUrl}
                  saveFeedback={saveFeedback}
                  inlineValidationError={inlineValidationError}
                  actionError={
                    actionData?.error && actionData.selectedProductId === row.shopify.id
                      ? actionData.error
                      : null
                  }
                  actionMessage={
                    actionData?.ok &&
                    actionData.selectedProductId === row.shopify.id &&
                    actionData.message
                      ? actionData.message
                      : null
                  }
                  actionIntent={
                    actionData?.ok && actionData.selectedProductId === row.shopify.id
                      ? actionData.intent || null
                      : null
                  }
                  previewQuestion={previewQuestion}
                  previewAnswer={previewAnswer}
                  onPreviewQuestionChange={(value) => onPreviewQuestionChange(row.shopify.id, value)}
                  recentAction={recentAction}
                  onEmbeddingsStart={() => onEmbeddingsStart(row.shopify.id)}
                  stepOutcomes={outcomesByProduct[row.shopify.id]}
                  isSavingSetup={isSavingSetup}
                  isRunningAiAction={isRunningAiAction}
                  isDeletingLocalSetup={isDeletingLocalSetup}
                  embedded
                  onChangeDraft={(field, value) =>
                    setDrafts((current) => ({
                      ...current,
                      [row.shopify.id]: {
                        ...(current[row.shopify.id] || emptyDraft()),
                        [field]: value,
                      },
                    }))
                  }
                  onToggleOptional={() =>
                    setShowOptionalByProduct((current) => ({
                      ...current,
                      [row.shopify.id]: !Boolean(current[row.shopify.id]),
                    }))
                  }
                  onWorkflowUrlChange={(value) =>
                    setWorkflowUrlByProduct((current) => ({
                      ...current,
                      [row.shopify.id]: value,
                    }))
                  }
                  setInlineValidationError={setInlineValidationError}
                />
              ) : null}
            </ProductListItem>
          );
        })}
      </BlockStack>
    </BlockStack>
  );
}

function ProductListItem({
  row,
  shopDomain,
  selected,
  recentAction = false,
  onSelect,
  quiet = false,
  children,
}: {
  row: WorkspaceRow;
  shopDomain: string;
  selected: boolean;
  recentAction?: boolean;
  onSelect: () => void;
  quiet?: boolean;
  children?: ReactNode;
}) {
  const productPath = displayProductPath(
    row.localProduct?.url || `https://${shopDomain}/products/${row.shopify.handle}`,
  );
  const journey = getJourneyMeta(row);

  return (
    <Box
      padding="200"
      borderWidth="025"
      borderColor="border"
      borderRadius="200"
      background={selected ? "bg-surface-secondary" : quiet ? "bg-surface-secondary" : undefined}
    >
      <BlockStack gap="200">
        <InlineGrid columns={{ xs: 1, lg: "2fr auto" }} gap="300">
          <BlockStack gap="100">
            <InlineStack gap="150" wrap blockAlign="center">
              <Text as="h3" variant="headingSm">
                {row.shopify.title}
              </Text>
              <Badge tone={recentAction ? "info" : row.statusTone}>
                {recentAction ? "Refreshing" : row.statusLabel}
              </Badge>
            </InlineStack>
            {row.shopify.vendor ? (
              <Text as="p" variant="bodySm" tone="subdued">
                {row.shopify.vendor}
              </Text>
            ) : null}
          </BlockStack>

          <InlineStack align="end" blockAlign="center" gap="200" wrap>
            <Box padding="050">
              <BlockStack gap="050">
                <Text as="p" variant="bodySm" tone="subdued">
                  Setup journey
                </Text>
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {journey.completedSteps} of {journey.totalSteps} steps completed
                </Text>
              </BlockStack>
            </Box>
            <Button
              variant={selected || row.state === "ready" ? "secondary" : "primary"}
              onClick={onSelect}
            >
              {selected ? "Close" : journey.nextActionLabel}
            </Button>
          </InlineStack>
        </InlineGrid>

        <BlockStack gap="100">
          <InlineStack align="space-between" blockAlign="center" gap="200" wrap>
            <Text as="p" variant="bodySm" tone="subdued">
              {recentAction ? "Refreshing language coverage" : journey.shortStatus}
            </Text>
            <InlineStack gap="150" wrap>
              {recentAction ? (
                <Badge tone="info">Updating answers</Badge>
              ) : row.state === "ready" ? (
                <Badge tone="success">Setup complete</Badge>
              ) : row.hasGuidance && row.hasKnowledge ? (
                <Badge tone="info">Background sync</Badge>
              ) : null}
            </InlineStack>
          </InlineStack>
          <JourneyStepper journey={journey} />
          <Text as="p" variant="bodySm" tone="subdued">
            {recentAction
              ? "We are rebuilding product answer knowledge for this product."
              : row.detailHint}
          </Text>
        </BlockStack>

        {selected && children ? (
          <Box paddingBlockStart="100">
            {children}
          </Box>
        ) : null}
      </BlockStack>
    </Box>
  );
}

function JourneyStepper({ journey }: { journey: JourneyMeta }) {
  const steps: Array<{ key: JourneyStep; label: string }> = [
    { key: "guidance", label: "Guidance" },
    { key: "improve", label: "Improve replies" },
  ];

  return (
    <InlineGrid columns={{ xs: 1, md: 2 }} gap="150">
      {steps.map((step, index) => {
        const done = journey.completedSteps > index;
        const current = journey.activeStep === step.key;
        return (
          <Box key={step.key} padding="100" background="bg-surface-secondary" borderRadius="150">
            <InlineStack gap="100" blockAlign="center">
              <Box
                minWidth="8px"
                minHeight="8px"
                borderRadius="full"
                background={done ? "bg-fill-success" : current ? "bg-fill-brand" : "bg-fill-tertiary"}
              />
              <Text as="p" variant="bodySm" tone={done ? "success" : current ? undefined : "subdued"}>
                {step.label}
              </Text>
            </InlineStack>
          </Box>
        );
      })}
    </InlineGrid>
  );
}

function SetupPanel({
  row,
  shopDomain,
  draft,
  dirty,
  optionalVisible,
  workflowUrl,
  saveFeedback,
  inlineValidationError,
  actionError,
  actionMessage,
  actionIntent,
  previewQuestion,
  previewAnswer,
  onPreviewQuestionChange,
  recentAction,
  onEmbeddingsStart,
  stepOutcomes,
  isSavingSetup,
  isRunningAiAction,
  isDeletingLocalSetup,
  isPreviewingAnswer,
  embedded = false,
  onChangeDraft,
  onToggleOptional,
  onWorkflowUrlChange,
  setInlineValidationError,
  onBackToProducts,
}: {
  row: WorkspaceRow;
  shopDomain: string;
  draft: MappingDraft;
  dirty: boolean;
  optionalVisible: boolean;
  workflowUrl: string;
  saveFeedback: SaveFeedback | null;
  inlineValidationError: string | null;
  actionError: string | null;
  actionMessage: string | null;
  actionIntent: string | null;
  previewQuestion: string;
  previewAnswer: string;
  onPreviewQuestionChange: (value: string) => void;
  recentAction: boolean;
  onEmbeddingsStart: () => void;
  stepOutcomes?: Partial<Record<ProductStepOutcome["step"], StepOutcomeState>>;
  isSavingSetup: boolean;
  isRunningAiAction: boolean;
  isDeletingLocalSetup: boolean;
  isPreviewingAnswer: boolean;
  embedded?: boolean;
  onChangeDraft: (field: keyof MappingDraft, value: string) => void;
  onToggleOptional: () => void;
  onWorkflowUrlChange: (value: string) => void;
  setInlineValidationError: (value: string | null) => void;
  onBackToProducts?: () => void;
}) {
  const submit = useSubmit();
  const [submitIntent, setSubmitIntent] = useState<"save-setup" | "mark-ready">("save-setup");
  const [showReadyEditor, setShowReadyEditor] = useState(false);
  const [showKnowledgeDetails, setShowKnowledgeDetails] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const productPath = displayProductPath(
    row.localProduct?.url || `https://${shopDomain}/products/${row.shopify.handle}`,
  );
  const journey = getJourneyMeta(row);
  const activeStep = journey.activeStep;
  const knowledge = buildKnowledgeSummary(row);
  const guidanceText = draft.usage_instructions.trim() || row.instruction?.usage_instructions || "";
  const stepDefinitions = [
    {
      key: "guidance" as const,
      label: "Customer info",
      title: "Guide customers after delivery",
      helper: "Write the core usage guidance customers should receive.",
      reason: "This helps Recete answer the first question buyers ask: how should I use this product?",
    },
    {
      key: "improve" as const,
      label: "AI answers",
      title: "Improve AI answer quality",
      helper: "Add or refresh product context before customers ask questions.",
      reason: "Recete uses product pages and optional sources to produce stronger, more specific replies.",
    },
  ];
  const activeStepIndex = activeStep === "ready"
    ? stepDefinitions.length - 1
    : Math.max(0, stepDefinitions.findIndex((step) => step.key === activeStep));
  const activeStepMeta = activeStep === "ready"
    ? {
        label: "Ready",
        title: "This product is ready",
        helper: "Customers can now receive automated answers after delivery.",
        reason: row.languageWorkflowEnabled && row.languageCoverage < 100
          ? "The main answer engine is ready. Extra reply languages will continue syncing in the background."
          : "The guidance and answer engine are in place.",
      }
    : stepDefinitions[activeStepIndex];
  const nextStepMeta = activeStep === "ready" ? null : stepDefinitions[activeStepIndex + 1] || null;
  const processRunning = isSavingSetup || isRunningAiAction;
  const statusTone = actionError
    ? "critical" as const
    : processRunning || recentAction
      ? "info" as const
      : activeStep === "ready"
        ? "success" as const
        : "attention" as const;
  const statusLabel = actionError
    ? "Action failed"
    : processRunning || recentAction
      ? "Updating"
      : activeStep === "ready"
        ? "Ready"
        : "Action needed";
  const systemMessage = actionError
    ? actionError
    : processRunning || recentAction
      ? activeStep === "improve"
          ? "We’re rebuilding the product knowledge Recete uses in answers."
          : "We’re saving this step now."
      : activeStep === "guidance"
        ? "Recete is waiting for clear customer guidance before it can move forward."
        : activeStep === "improve"
          ? "The product has guidance, but the answer engine still needs stronger product context."
          : row.languageWorkflowEnabled && row.languageCoverage < 100
            ? "Setup is complete. Reply language coverage will keep improving in the background."
            : "Setup is complete and this product can answer customer questions.";
  const statusBanner = actionError
    ? {
        tone: "critical" as const,
        title: "Product action failed",
        body: actionError,
      }
    : saveFeedback && !dirty
        ? {
            tone: "success" as const,
            title: "Saved",
            body: `${saveFeedback.message} Saved at ${formatSavedAt(saveFeedback.savedAt)}.`,
          }
        : actionMessage
          ? {
              tone: "success" as const,
              title: "Updated",
              body: actionMessage,
            }
          : null;
  const languageStatusText = recentAction
    ? "We’re updating your product languages. This usually takes a few seconds."
    : !row.languageWorkflowEnabled
      ? "Recete is using the primary product language."
    : row.readyLanguageCount > 0
      ? `${row.readyLanguageCount} of ${row.requiredLanguageCount} selected languages are ready.`
      : "No reply languages are ready yet.";
  const revealSecondaryPanels = activeStep === "ready" && !showReadyEditor;

  useEffect(() => {
    setSubmitIntent("save-setup");
    setShowReadyEditor(false);
    setShowKnowledgeDetails(false);
    setShowDangerZone(false);
    setConfirmDelete(false);
  }, [row.shopify.id]);
  function submitStepForm() {
    if (activeStep === "guidance" || (activeStep === "ready" && showReadyEditor)) {
      setSubmitIntent("save-setup");
      (document.getElementById(`product-setup-form-${row.shopify.id}`) as HTMLFormElement | null)?.requestSubmit();
      return;
    }

    if (activeStep === "ready") {
      setShowReadyEditor(true);
      return;
    }

    onEmbeddingsStart();
    const formData = new FormData();
    formData.set("intent", "embeddings");
    formData.set("productId", row.localProduct?.id || "");
    formData.set("shopifyProductId", row.shopify.id);
    formData.set("productName", row.shopify.title);
    formData.set("hasContent", row.localProduct?.raw_text ? "true" : "false");
    formData.set("enrichmentUrl", workflowUrl || "");
    submit(formData, { method: "post" });
  }

  function submitEmbeddingsFromStep() {
    if (!row.localProduct || isSavingSetup || isDeletingLocalSetup || isRunningAiAction) return;
    submitStepForm();
  }

  const content = (
    <BlockStack gap="300">
      <StickyProductContextHeader
        row={row}
        journey={journey}
        helperText={activeStepMeta.helper}
        stepLabel={activeStepMeta.label}
        onBack={onBackToProducts}
        statusTone={statusTone}
        statusLabel={statusLabel}
      />

      {statusBanner ? (
        <Banner tone={statusBanner.tone} title={statusBanner.title}>
          <Text as="p" variant="bodyMd">
            {statusBanner.body}
          </Text>
        </Banner>
      ) : null}

      {activeStep !== "ready" && (
        <ProductSetupStepCard
          journey={journey}
          stepLabel={activeStepMeta.label}
          title={activeStepMeta.title}
          reason={activeStepMeta.reason}
          row={row}
          recentAction={recentAction}
          systemMessage={systemMessage}
        />
      )}

      {activeStep === "guidance" || (activeStep === "ready" && showReadyEditor) ? (
        <Card>
          <Form
            method="post"
            id={`product-setup-form-${row.shopify.id}`}
            onSubmit={(event) => {
              if (!draft.usage_instructions.trim()) {
                event.preventDefault();
                setInlineValidationError("Customer guidance is required before saving.");
                return;
              }
              setInlineValidationError(null);
            }}
          >
            <input type="hidden" name="intent" value={submitIntent} />
            <input type="hidden" name="selected_product_id" value={row.shopify.id} />
            <input type="hidden" name="title" value={row.shopify.title} />
            <input type="hidden" name="handle" value={row.shopify.handle} />
            <input type="hidden" name="external_id" value={row.shopify.id} />
            <input type="hidden" name="description_html" value={row.shopify.descriptionHtml || ""} />
            <input type="hidden" name="existing_product_id" value={row.localProduct?.id || ""} />

            <BlockStack gap="200">
              <TextField
                label="Customer guidance"
                name="usage_instructions"
                value={draft.usage_instructions}
                onChange={(value) => onChangeDraft("usage_instructions", value)}
                multiline={8}
                autoComplete="off"
                error={inlineValidationError ? "Required" : undefined}
                placeholder="Write what customers should know after delivery."
                helpText="Keep this practical: how to use the product, what to avoid, and what matters most after delivery."
              />

              <InlineStack gap="200" wrap>
                {!isSavingSetup ? (
                  <Button
                    submit
                    variant="primary"
                    disabled={isRunningAiAction || isDeletingLocalSetup}
                    onClick={() => setSubmitIntent("save-setup")}
                  >
                    {activeStep === "ready" ? "Save changes" : "Save and continue"}
                  </Button>
                ) : (
                  <InlineStack gap="100" blockAlign="center">
                    <Badge tone="info">Saving</Badge>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Saving this step now.
                    </Text>
                  </InlineStack>
                )}
                {activeStep === "ready" ? (
                  <Button variant="secondary" onClick={() => setShowReadyEditor(false)}>
                    Cancel
                  </Button>
                ) : null}
                <Button size="slim" onClick={onToggleOptional}>
                  {optionalVisible ? "Hide supporting details" : "Add supporting details"}
                </Button>
              </InlineStack>

              {optionalVisible ? (
                <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
                      <TextField
                        label="Short summary"
                        name="recipe_summary"
                        multiline={4}
                        autoComplete="off"
                        value={draft.recipe_summary}
                        onChange={(value) => onChangeDraft("recipe_summary", value)}
                        placeholder="Short explanation of what the product does."
                      />
                      <TextField
                        label="Warnings and notes"
                        name="prevention_tips"
                        multiline={4}
                        autoComplete="off"
                        value={draft.prevention_tips}
                        onChange={(value) => onChangeDraft("prevention_tips", value)}
                        placeholder="Anything customers should avoid or watch for."
                      />
                    </InlineGrid>
                    <TextField
                      label="Tutorial video URL"
                      name="video_url"
                      autoComplete="off"
                      value={draft.video_url}
                      onChange={(value) => onChangeDraft("video_url", value)}
                      placeholder="https://example.com/video"
                    />
                    <TextField
                      label="Extra source URL"
                      autoComplete="off"
                      value={workflowUrl}
                      onChange={onWorkflowUrlChange}
                      helpText="Optional page with FAQs, tutorials, or product details."
                      placeholder="https://example.com/blog/how-to-use-product"
                    />
                  </BlockStack>
                </Box>
              ) : null}
            </BlockStack>
          </Form>
        </Card>
      ) : null}

      {activeStep === "improve" ? (
        <Box padding="300" borderWidth="025" borderColor="border" borderRadius="300">
          <BlockStack gap="200">
            <TextField
              label="Extra source URL"
              autoComplete="off"
              value={workflowUrl}
              onChange={onWorkflowUrlChange}
              helpText="Add an extra page if it improves customer answers."
              placeholder="https://example.com/blog/how-to-use-product"
            />
            {isRunningAiAction ? (
              <InlineStack gap="100" blockAlign="center">
                <Badge tone="info">Updating</Badge>
                <Text as="p" variant="bodySm" tone="subdued">
                  We&apos;re improving the product knowledge used in answers.
                </Text>
              </InlineStack>
            ) : (
              <Button
                variant="primary"
                disabled={!row.localProduct || isSavingSetup || isDeletingLocalSetup}
                onClick={submitEmbeddingsFromStep}
              >
                Improve AI replies
              </Button>
            )}
            <Text as="p" variant="bodySm" tone="subdued">
              Recete will use product content and optional sources to improve response quality.
            </Text>
          </BlockStack>
        </Box>
      ) : null}

      {activeStep === "ready" && !showReadyEditor ? (
        <Banner tone="success" title="Customers can now ask questions automatically">
          <BlockStack gap="300">
            <Text as="p" variant="bodyMd">
              Setup is complete. Recete is actively using this product's information to handle support requests. 
              Language coverage will continue improving automatically in the background.
            </Text>
            <InlineStack gap="200" wrap>
              <Button onClick={() => setShowReadyEditor(true)}>Edit setup</Button>
              <InlineActionForm
                productId={row.localProduct?.id || ""}
                shopifyProductId={row.shopify.id}
                productName={row.shopify.title}
                intent="embeddings"
                label="Refresh AI answers"
                icon={MagicIcon}
                hasContent={Boolean(row.localProduct?.raw_text)}
                enrichmentUrl={workflowUrl}
                disabled={!row.localProduct || isSavingSetup || isDeletingLocalSetup}
                loading={isRunningAiAction}
                variant="secondary"
                onActionStart={onEmbeddingsStart}
              />
            </InlineStack>
          </BlockStack>
        </Banner>
      ) : null}

      {nextStepMeta ? (
        <Box padding="200" background="bg-surface-secondary" borderRadius="300">
          <BlockStack gap="100">
            <Text as="p" variant="bodySm" tone="subdued">
              What happens next
            </Text>
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {nextStepMeta.label}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {nextStepMeta.helper}
            </Text>
          </BlockStack>
        </Box>
      ) : null}

      {!revealSecondaryPanels ? (
        <Box padding="200" background="bg-surface-secondary" borderRadius="300">
          <BlockStack gap="100">
            <Text as="p" variant="bodySm" tone="subdued">
              Stay focused on this step
            </Text>
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              Finish the current task to unlock AI knowledge, missing details, and answer preview.
            </Text>
          </BlockStack>
        </Box>
      ) : null}

      {revealSecondaryPanels ? (
        <BlockStack gap="400">
          {knowledge.missingInfo.length > 0 ? (
            <MissingInfoCallout
              missingInfo={knowledge.missingInfo}
              onAddDetails={() => {
                setShowKnowledgeDetails(true);
                if (activeStep === "ready") setShowReadyEditor(true);
                if (!optionalVisible) onToggleOptional();
              }}
            />
          ) : null}
          <Layout>
            <Layout.Section>
              <BlockStack gap="400">
                <PreviewAnswerPanel
                  row={row}
                  previewQuestion={previewQuestion}
                  previewAnswer={previewAnswer}
                  onPreviewQuestionChange={onPreviewQuestionChange}
                  loading={isPreviewingAnswer}
                />
                <LanguageCoveragePanel
                  row={row}
                  languageStatusText={languageStatusText}
                  workflowUrl={workflowUrl}
                  onWorkflowUrlChange={onWorkflowUrlChange}
                  onRefresh={submitEmbeddingsFromStep}
                  busy={isRunningAiAction || recentAction}
                  disabled={!row.localProduct || isSavingSetup || isDeletingLocalSetup}
                />
              </BlockStack>
            </Layout.Section>
            <Layout.Section variant="oneThird">
              <BlockStack gap="400">
                <AIKnowledgePanel
                  row={row}
                  knowledge={knowledge}
                  open={showKnowledgeDetails}
                  onToggle={() => setShowKnowledgeDetails((current) => !current)}
                  draft={draft}
                  activeStep={activeStep}
                  showReadyEditor={showReadyEditor}
                  inlineValidationError={inlineValidationError}
                  onChangeDraft={onChangeDraft}
                  isSavingSetup={isSavingSetup}
                  isRunningAiAction={isRunningAiAction}
                  isDeletingLocalSetup={isDeletingLocalSetup}
                  setInlineValidationError={setInlineValidationError}
                />
                <StepOutcomeLine
                  title="Latest update"
                  outcome={
                    stepOutcomes?.collect_sources ||
                    stepOutcomes?.generate_ai_knowledge ||
                    stepOutcomes?.map_product
                  }
                />
              </BlockStack>
            </Layout.Section>
          </Layout>
        </BlockStack>
      ) : null}

      {revealSecondaryPanels && row.localProduct ? (
        <BlockStack gap="150">
          <Button
            size="slim"
            variant="plain"
            tone="critical"
            onClick={() => setShowDangerZone((current) => !current)}
          >
            {showDangerZone ? "Hide danger zone" : "Show danger zone"}
          </Button>

          {showDangerZone ? (
            <Box padding="200" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Danger zone
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Remove the saved Recete setup for this product. The Shopify product will stay untouched.
                </Text>
                <Checkbox
                  label="I understand this removes the saved setup for this product."
                  checked={confirmDelete}
                  onChange={setConfirmDelete}
                />
                <InlineActionForm
                  productId={row.localProduct.id}
                  shopifyProductId={row.shopify.id}
                  productName={row.shopify.title}
                  intent="delete"
                  label="Remove local setup"
                  icon={DeleteIcon}
                  destructive
                  disabled={!confirmDelete || isSavingSetup || isRunningAiAction}
                  loading={isDeletingLocalSetup}
                  variant="secondary"
                />
              </BlockStack>
            </Box>
          ) : null}
        </BlockStack>
      ) : null}
    </BlockStack>
  );

  if (embedded) return content;

  return content;
}

function StickyProductContextHeader({
  row,
  journey,
  helperText,
  stepLabel,
  onBack,
  statusTone,
  statusLabel,
}: {
  row: WorkspaceRow;
  journey: JourneyMeta;
  helperText: string;
  stepLabel: string;
  onBack?: () => void;
  statusTone: "info" | "success" | "attention" | "critical";
  statusLabel: string;
}) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--p-color-bg-surface)", paddingBottom: "16px", paddingTop: "8px", borderBottom: "1px solid var(--p-color-border)", boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)" }}>
      <BlockStack gap="400">
        <InlineStack align="start">
          <Button variant="plain" onClick={onBack}>
            ← All products
          </Button>
        </InlineStack>

        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <InlineStack gap="400" blockAlign="center" wrap={false}>
            {row.shopify.featuredImageUrl ? (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  overflow: "hidden",
                  border: "1px solid var(--p-color-border)",
                  background: "var(--p-color-bg-surface-secondary)",
                }}
              >
                <img
                  src={row.shopify.featuredImageUrl}
                  alt={row.shopify.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            ) : (
              <Box minWidth="48px" minHeight="48px" borderRadius="100" background="bg-surface-secondary" />
            )}
            <BlockStack gap="050">
              <Text as="h1" variant="headingLg">
                {row.shopify.title}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {row.shopify.vendor ? `${row.shopify.vendor} • ` : ""}
                <span style={{ fontFamily: "monospace" }}>/{row.shopify.handle}</span>
              </Text>
            </BlockStack>
          </InlineStack>
          <Badge tone={statusTone}>
             {journey.activeStep === "ready" ? "Ready" : `Step ${Math.min(journey.completedSteps + 1, journey.totalSteps)} of ${journey.totalSteps}`}
          </Badge>
        </InlineStack>
      </BlockStack>
    </div>
  );
}

function ProductSetupStepCard({
  journey,
  stepLabel,
  title,
  reason,
  row,
  recentAction,
  systemMessage,
}: {
  journey: JourneyMeta;
  stepLabel: string;
  title: string;
  reason: string;
  row: WorkspaceRow;
  recentAction: boolean;
  systemMessage: string;
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <BlockStack gap="100">
          <Text as="p" variant="bodySm" tone="subdued">
            {journey.activeStep === "ready"
              ? "Ready"
              : `Step ${Math.min(journey.completedSteps + 1, journey.totalSteps)} of ${journey.totalSteps}`}
          </Text>
          <Text as="h2" variant="headingMd">
            {title}
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            {reason}
          </Text>
        </BlockStack>

        <InlineStack gap="150" wrap>
          {[
            { key: "guidance", label: "Customer info" },
            { key: "improve", label: "AI answers" },
          ].map((step, index) => {
            const done = journey.completedSteps > index || journey.activeStep === "ready";
            const current = journey.activeStep === step.key;
            return (
              <Box
                key={step.key}
                paddingInlineStart="150"
                paddingInlineEnd="150"
                paddingBlockStart="100"
                paddingBlockEnd="100"
                background={current ? "bg-fill-secondary" : "bg-surface-secondary"}
                borderRadius="200"
              >
                <Text as="p" variant="bodySm" tone={done ? "success" : current ? undefined : "subdued"}>
                  {step.label}
                </Text>
              </Box>
            );
          })}
        </InlineStack>

        <InlineGrid columns={{ xs: 1, md: 3 }} gap="200">
          <Box padding="200" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="050">
              <Text as="p" variant="bodySm" tone="subdued">
                Current step
              </Text>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                {stepLabel}
              </Text>
            </BlockStack>
          </Box>
          <Box padding="200" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="050">
              <Text as="p" variant="bodySm" tone="subdued">
                Setup status
              </Text>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                {row.statusLabel}
              </Text>
            </BlockStack>
          </Box>
          <Box padding="200" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="050">
              <Text as="p" variant="bodySm" tone="subdued">
                Languages
              </Text>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                {recentAction ? "Updating now" : `${row.readyLanguageCount}/${row.requiredLanguageCount} ready`}
              </Text>
            </BlockStack>
          </Box>
        </InlineGrid>

        <Box padding="200" background="bg-surface-secondary" borderRadius="200">
          <BlockStack gap="050">
            <Text as="p" variant="bodySm" tone="subdued">
              What is happening now
            </Text>
            <Text as="p" variant="bodyMd">
              {systemMessage}
            </Text>
          </BlockStack>
        </Box>
      </BlockStack>
    </Card>
  );
}

function AIKnowledgePanel({
  row,
  knowledge,
  open,
  onToggle,
  draft,
  activeStep,
  showReadyEditor,
  inlineValidationError,
  onChangeDraft,
  isSavingSetup,
  isRunningAiAction,
  isDeletingLocalSetup,
  setInlineValidationError,
}: {
  row: WorkspaceRow;
  knowledge: KnowledgeSummary;
  open: boolean;
  onToggle: () => void;
  draft: MappingDraft;
  activeStep: JourneyStep;
  showReadyEditor: boolean;
  inlineValidationError: string | null;
  onChangeDraft: (field: keyof MappingDraft, value: string) => void;
  isSavingSetup: boolean;
  isRunningAiAction: boolean;
  isDeletingLocalSetup: boolean;
  setInlineValidationError: (value: string | null) => void;
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center" gap="200" wrap>
          <BlockStack gap="050">
            <Text as="h3" variant="headingSm">
              AI knowledge
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              This is the information used to answer customer questions.
            </Text>
          </BlockStack>
          <Button
            size="slim"
            variant="tertiary"
            onClick={onToggle}
            ariaExpanded={open}
            ariaControls={`knowledge-details-${row.shopify.id}`}
          >
            {open ? "Hide details" : "Show details"}
          </Button>
        </InlineStack>

        <Collapsible open={open} id={`knowledge-details-${row.shopify.id}`}>
          <Box paddingBlockStart="100">
            <BlockStack gap="200">
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="200">
                <InfoMiniCard title="How to use" body={knowledge.howToUse} />
                <InfoListCard
                  title="Key product details"
                  items={knowledge.keyDetails}
                  empty="No product details captured yet."
                />
                <InfoListCard title="Common questions" items={knowledge.commonQuestions} empty="No common questions yet." />
                <InfoListCard
                  title="Warnings"
                  items={knowledge.warnings}
                  empty="No warnings captured yet."
                />
              </InlineGrid>

              <Form
                method="post"
                id={`knowledge-edit-form-${row.shopify.id}`}
                onSubmit={(event) => {
                  if (!draft.usage_instructions.trim()) {
                    event.preventDefault();
                    setInlineValidationError("Customer guidance is required before saving.");
                    return;
                  }
                  setInlineValidationError(null);
                }}
              >
                <input type="hidden" name="intent" value="save-setup" />
                <input type="hidden" name="selected_product_id" value={row.shopify.id} />
                <input type="hidden" name="title" value={row.shopify.title} />
                <input type="hidden" name="handle" value={row.shopify.handle} />
                <input type="hidden" name="external_id" value={row.shopify.id} />
                <input type="hidden" name="description_html" value={row.shopify.descriptionHtml || ""} />
                <input type="hidden" name="existing_product_id" value={row.localProduct?.id || ""} />

                <BlockStack gap="200">
                  {activeStep === "guidance" && !showReadyEditor ? (
                    <Text as="p" variant="bodySm" tone="subdued">
                      Customer guidance is being edited in the active step above.
                    </Text>
                  ) : (
                    <TextField
                      label="Customer guidance"
                      name="usage_instructions"
                      value={draft.usage_instructions}
                      onChange={(value) => onChangeDraft("usage_instructions", value)}
                      multiline={6}
                      autoComplete="off"
                      error={inlineValidationError ? "Required" : undefined}
                    />
                  )}
                  <TextField
                    label="Warnings or important notes"
                    name="prevention_tips"
                    value={draft.prevention_tips}
                    onChange={(value) => onChangeDraft("prevention_tips", value)}
                    multiline={4}
                    autoComplete="off"
                  />
                  <TextField
                    label="Key features & ingredients"
                    name="recipe_summary"
                    value={draft.recipe_summary}
                    onChange={(value) => onChangeDraft("recipe_summary", value)}
                    multiline={4}
                    autoComplete="off"
                  />
                  <InlineStack gap="200" wrap>
                    <Button
                      submit
                      variant="secondary"
                      loading={isSavingSetup}
                      disabled={isSavingSetup || isRunningAiAction || isDeletingLocalSetup}
                    >
                      Save updates
                    </Button>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Sources: {knowledge.sources.join(", ")}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Form>
            </BlockStack>
          </Box>
        </Collapsible>
      </BlockStack>
    </Card>
  );
}

function MissingInfoCallout({
  missingInfo,
  onAddDetails,
}: {
  missingInfo: string[];
  onAddDetails: () => void;
}) {
  return (
    <Banner tone="warning" title="Your AI is missing important information">
      <BlockStack gap="100">
        <Text as="p" variant="bodyMd">
          Some answers may be incomplete because we couldn’t find:
        </Text>
        <BlockStack gap="050">
          {missingInfo.map((item) => (
            <Text key={item} as="p" variant="bodySm" tone="subdued">
              {item}
            </Text>
          ))}
        </BlockStack>
        <InlineStack>
          <Button size="slim" onClick={onAddDetails}>
            Add details
          </Button>
        </InlineStack>
      </BlockStack>
    </Banner>
  );
}

function LanguageCoveragePanel({
  row,
  languageStatusText,
  workflowUrl,
  onWorkflowUrlChange,
  onRefresh,
  busy,
  disabled,
}: {
  row: WorkspaceRow;
  languageStatusText: string;
  workflowUrl: string;
  onWorkflowUrlChange: (value: string) => void;
  onRefresh: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <BlockStack gap="050">
          <InlineStack align="space-between" blockAlign="center" gap="200" wrap>
            <Text as="h3" variant="headingSm">
              Language coverage
            </Text>
            <Badge tone={row.languageTone}>
              {`${row.readyLanguageCount}/${row.requiredLanguageCount} ready`}
            </Badge>
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">
            Answer setup is complete. Language coverage can keep improving in the background.
          </Text>
        </BlockStack>

        <Box padding="200" background="bg-surface-secondary" borderRadius="200">
          <BlockStack gap="100">
            <ProgressBar progress={row.languageCoverage} size="small" />
            <Text as="p" variant="bodySm" tone="subdued">
              {languageStatusText}
              {row.sourceLanguage ? ` Source content looks like ${languageLabel(row.sourceLanguage)}.` : ""}
            </Text>
          </BlockStack>
        </Box>

        <TextField
          label="Extra source URL"
          autoComplete="off"
          value={workflowUrl}
          onChange={onWorkflowUrlChange}
          helpText="Optional: add another source if you want better multilingual coverage."
          placeholder="https://example.com/blog/how-to-use-product"
        />

        {busy ? (
          <InlineStack gap="100" blockAlign="center">
            <Badge tone="info">Syncing</Badge>
            <Text as="p" variant="bodySm" tone="subdued">
              Recete is refreshing language coverage in the background.
            </Text>
          </InlineStack>
        ) : (
          <InlineStack gap="200" wrap>
            <Button variant="secondary" disabled={disabled} onClick={onRefresh}>
              Refresh language coverage
            </Button>
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}

function PreviewAnswerPanel({
  row,
  previewQuestion,
  previewAnswer,
  onPreviewQuestionChange,
  loading,
}: {
  row: WorkspaceRow;
  previewQuestion: string;
  previewAnswer: string;
  onPreviewQuestionChange: (value: string) => void;
  loading: boolean;
}) {
  return (
    <Card>
      <Form method="post">
        <input type="hidden" name="intent" value="preview-answer" />
        <input type="hidden" name="productId" value={row.localProduct?.id || ""} />
        <input type="hidden" name="shopifyProductId" value={row.shopify.id} />
        <BlockStack gap="200">
          <BlockStack gap="050">
            <Text as="h3" variant="headingSm">
              Preview answer
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Check the kind of answer customers will receive.
            </Text>
          </BlockStack>
          <TextField
            label="Sample customer question"
            name="question"
            value={previewQuestion}
            onChange={onPreviewQuestionChange}
            autoComplete="off"
            placeholder="How do I use this product?"
          />
          <InlineStack gap="200" wrap>
            <Button submit variant="secondary" disabled={!row.localProduct} loading={loading}>
              Regenerate answer
            </Button>
          </InlineStack>
          <Box padding="200" background="bg-surface-secondary" borderRadius="200">
            <Text as="p" variant="bodySm" tone={previewAnswer ? undefined : "subdued"}>
              {previewAnswer || "Ask a question to preview the answer Recete will send."}
            </Text>
          </Box>
        </BlockStack>
      </Form>
    </Card>
  );
}

function ProductBrowserItem({
  row,
  shopDomain,
  selected,
  recentAction,
  onSelect,
}: {
  row: WorkspaceRow;
  shopDomain: string;
  selected: boolean;
  recentAction: boolean;
  onSelect: () => void;
}) {
  const journey = getJourneyMeta(row);
  const productPath = displayProductPath(
    row.localProduct?.url || `https://${shopDomain}/products/${row.shopify.handle}`,
  );

  return (
    <Box
      padding="200"
      borderWidth="025"
      borderColor="border"
      borderRadius="200"
      background={selected ? "bg-surface-secondary" : undefined}
    >
      <InlineGrid columns={{ xs: 1, md: "2fr auto" }} gap="200">
        <BlockStack gap="100">
          <InlineStack gap="150" wrap blockAlign="center">
            <Text as="h3" variant="headingSm">
              {row.shopify.title}
            </Text>
            <Badge tone={recentAction ? "info" : row.statusTone}>
              {recentAction ? "Updating" : row.statusLabel}
            </Badge>
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">
            {[row.shopify.vendor || "Shopify product", productPath].filter(Boolean).join(" • ")}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {journey.activeStep === "ready" ? "Ready" : `${journey.shortStatus} • ${journey.completedSteps} of ${journey.totalSteps} steps complete`}
          </Text>
        </BlockStack>
        <InlineStack align="end" blockAlign="center">
          <Button variant={selected ? "secondary" : "primary"} onClick={onSelect}>
            {selected ? "Open" : journey.nextActionLabel}
          </Button>
        </InlineStack>
      </InlineGrid>
    </Box>
  );
}

function InfoMiniCard({ title, body }: { title: string; body: string }) {
  return (
    <Box padding="200" background="bg-surface-secondary" borderRadius="200">
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" fontWeight="medium">
          {title}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {body}
        </Text>
      </BlockStack>
    </Box>
  );
}

function InfoListCard({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <Box padding="200" background="bg-surface-secondary" borderRadius="200">
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" fontWeight="medium">
          {title}
        </Text>
        {items.length > 0 ? (
          <BlockStack gap="050">
            {items.map((item, index) => (
              <Text key={`${title}-${index}-${item}`} as="p" variant="bodySm" tone="subdued">
                {item}
              </Text>
            ))}
          </BlockStack>
        ) : (
          <Text as="p" variant="bodySm" tone="subdued">
            {empty}
          </Text>
        )}
      </BlockStack>
    </Box>
  );
}

function StepOutcomeLine({
  title,
  outcome,
}: {
  title: string;
  outcome?: StepOutcomeState;
}) {
  if (!outcome) return null;

  return (
    <Text as="p" variant="bodySm" tone={outcome.status === "error" ? "critical" : "subdued"}>
      {[
        `${title}:`,
        outcome.status,
        outcome.updatedAt
          ? new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(
              new Date(outcome.updatedAt),
            )
          : "",
        formatOutcomeDelta(outcome.delta),
        outcome.error || outcome.message || "",
      ]
        .filter(Boolean)
        .join(" ")}
    </Text>
  );
}

function InlineActionForm({
  productId,
  shopifyProductId,
  productName,
  intent,
  label,
  icon,
  hasContent,
  destructive = false,
  enrichmentUrl,
  disabled = false,
  loading = false,
  variant = "secondary",
  onActionStart,
}: {
  productId: string;
  shopifyProductId: string;
  productName?: string;
  intent: string;
  label: string;
  icon: unknown;
  hasContent?: boolean;
  destructive?: boolean;
  enrichmentUrl?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "tertiary";
  onActionStart?: () => void;
}) {
  const submit = useSubmit();

  function submitAction() {
    if (disabled || loading) return;
    onActionStart?.();

    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("productId", productId);
    formData.set("shopifyProductId", shopifyProductId);
    formData.set("productName", productName || "");
    formData.set("hasContent", hasContent ? "true" : "false");
    formData.set("enrichmentUrl", enrichmentUrl || "");
    submit(formData, { method: "post" });
  }

  return (
    <Button
      icon={icon as never}
      variant={variant}
      tone={destructive ? "critical" : undefined}
      disabled={disabled || loading}
      loading={loading}
      onClick={submitAction}
    >
      {label}
    </Button>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
