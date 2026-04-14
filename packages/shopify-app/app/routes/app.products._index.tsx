import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
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
  prepareMerchantProductKnowledge,
  resetMerchantProductKnowledge,
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

type SetupState = "needs_setup" | "needs_ai_answers" | "ready";
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

type LifecyclePresentation = {
  key: "needs_setup" | "needs_ai_answers" | "processing" | "ready" | "error";
  label: string;
  tone: "attention" | "info" | "success" | "critical";
  message: string;
};

type KnowledgeSummary = {
  howToUse: string;
  keyDetails: string[];
  commonQuestions: string[];
  warnings: string[];
  sources: string[];
  missingInfo: string[];
  qualityScore: number;
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

function normalizeOptionalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

async function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Response) {
    try {
      const payload = await error.clone().json();
      if (payload && typeof payload === "object") {
        if ("details" in payload && typeof payload.details === "string" && payload.details.trim()) {
          return payload.details;
        }
        if ("error" in payload && typeof payload.error === "string" && payload.error.trim()) {
          return payload.error;
        }
      }
    } catch {
      // Ignore parse failures and fall through to generic handling.
    }
    return fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
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

function getLifecyclePresentation(
  row: WorkspaceRow,
  options?: {
    actionError?: string | null;
    processRunning?: boolean;
    recentAction?: boolean;
  },
): LifecyclePresentation {
  const persistedLifecycle = row.localProduct?.lifecycle;

  if (options?.actionError) {
    return {
      key: "error",
      label: "Needs attention",
      tone: "critical",
      message: options.actionError,
    };
  }

  if (options?.processRunning || options?.recentAction) {
    return {
      key: "processing",
      label: "Preparing answers",
      tone: "info",
      message: "Recete is processing this product right now. There is nothing to click until this finishes.",
    };
  }

  if (persistedLifecycle) {
    return {
      key: persistedLifecycle.status,
      label: persistedLifecycle.label,
      tone:
        persistedLifecycle.status === "ready"
          ? "success"
          : persistedLifecycle.status === "needs_ai_answers"
            ? "info"
            : "attention",
      message: persistedLifecycle.message,
    };
  }

  if (!row.linked || !row.hasGuidance) {
    return {
      key: "needs_setup",
      label: "Needs setup",
      tone: "attention",
      message: "Add customer guidance so Recete knows what customers should do after delivery.",
    };
  }

  if (!row.hasKnowledge) {
    return {
      key: "needs_ai_answers",
      label: "Needs AI answers",
      tone: "info",
      message: "The guidance is saved. Recete still needs product knowledge before it can answer customers well.",
    };
  }

  return {
    key: "ready",
    label: "Ready",
    tone: "success",
    message: row.languageWorkflowEnabled && row.languageCoverage < 100
      ? "Setup is complete. Extra language coverage will keep improving in the background."
      : "Setup is complete and this product is ready to answer customer questions.",
  };
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

  let qualityScore = 100;
  if (!row.instruction?.usage_instructions?.trim()) qualityScore -= 20;
  if (!warnings.length) qualityScore -= 10;
  if (!benefits.length && !claims.length && !hasManualFeatures) qualityScore -= 10;
  if (!ingredients.length && !activeIngredients.length && !hasManualFeatures) qualityScore -= 20;

  return {
    howToUse,
    keyDetails,
    commonQuestions,
    warnings,
    sources: sources.length ? sources : ["No sources connected yet"],
    missingInfo,
    qualityScore,
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
      !linked || !hasGuidance
        ? "needs_setup"
        : hasKnowledge
          ? "ready"
          : "needs_ai_answers";
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
        localProduct?.lifecycle?.label ||
        (!linked || !hasGuidance
          ? "Needs setup"
          : hasKnowledge
            ? "Ready"
            : "Needs AI answers"),
      statusTone:
        localProduct?.lifecycle?.status === "ready"
          ? "success"
          : localProduct?.lifecycle?.status === "needs_ai_answers"
            ? "info"
            : (!linked || !hasGuidance
              ? "attention"
              : hasKnowledge
                ? "success"
                : "info"),
      nextActionLabel:
        localProduct?.lifecycle?.nextActionLabel ||
        (!linked
          ? "Set up"
          : !hasGuidance
            ? "Continue setup"
            : hasKnowledge
              ? "Review"
              : "Prepare answers"),
      detailHint:
        localProduct?.lifecycle?.message ||
        (!linked
          ? "Create the Recete setup and add guidance."
          : !hasGuidance
            ? "Add customer guidance so Recete knows what customers should do next."
            : hasKnowledge
              ? languageWorkflowEnabled && languageCoverage < 100
                ? "Answers are ready now. Extra language coverage will keep syncing in the background."
                : "Ready for customer replies."
              : "Prepare the answer knowledge Recete will use in customer replies."),
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
        const enrichmentUrl = normalizeOptionalUrl(String(formData.get("enrichmentUrl") || ""));

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
      case "save-setup": {
        const workflowUrl = normalizeOptionalUrl(String(formData.get("workflow_url") || ""));
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

        // Auto-trigger enrichment pipeline after save
        const stepOutcomes: StepOutcomeState[] = [];
        if (result.productId) {
          try {
            const prepared = await prepareMerchantProductKnowledge(request, result.productId, workflowUrl || undefined);
            for (const outcome of prepared.stepOutcomes || []) {
              stepOutcomes.push({
                ...outcome,
                message: prepared.message,
                intent,
              });
            }
          } catch (error) {
            console.warn("[auto-prepare-knowledge-failed]", error);
            const errorMessage = await getActionErrorMessage(
              error,
              "Your guidance was saved, but Recete could not prepare product answers automatically.",
            );
            stepOutcomes.push({
              step: 'collect_sources',
              status: 'error',
              updatedAt: new Date().toISOString(),
              error: errorMessage,
              intent
            });
          }
        }

        return {
          ...result,
          ok: true,
          intent,
          stepOutcomes,
          message: "Customer guidance saved and AI updated.",
        } satisfies ActionResult;
      }
      case "embeddings": {
        const productId = String(formData.get("productId") || "").trim();
        const productName = String(formData.get("productName") || "").trim();
        const selectedProductId = String(formData.get("shopifyProductId") || "").trim();
        const hasContent = String(formData.get("hasContent") || "").trim() === "true";
        const enrichmentUrl = normalizeOptionalUrl(String(formData.get("enrichmentUrl") || ""));

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
        let pipelineMessage = `${productName || "Product"} answers improved with product context.`;

        if (enrichmentUrl) {
          try {
            const enrich = await enrichMerchantProductFromUrl(request, productId, enrichmentUrl);
            if (enrich.stepOutcome) {
              stepOutcomes.push({
                ...enrich.stepOutcome,
                message: enrich.message,
                intent,
              });
            }
            pipelineMessage = enrich.message || `${productName || "Product"} answers improved with extra source context.`;
          } catch (error) {
            const errorMessage = await getActionErrorMessage(
              error,
              "Extra source URL could not be processed.",
            );
            return {
              ok: false,
              intent,
              productId,
              productName,
              selectedProductId,
              error: errorMessage,
              stepOutcomes: [
                {
                  step: "collect_sources",
                  status: "error",
                  updatedAt: new Date().toISOString(),
                  error: errorMessage,
                  intent,
                },
              ],
            } satisfies ActionResult;
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
          pipelineMessage = scrape.message || `${productName || "Product"} content was collected and prepared for answers.`;
        } else {
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
          pipelineMessage = generated.message || pipelineMessage;
        }

        return {
          ok: true,
          intent,
          productId,
          productName,
          selectedProductId,
          message: pipelineMessage,
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
      case "reset-knowledge": {
        const productId = String(formData.get("productId") || "").trim();
        const productName = String(formData.get("productName") || "").trim();
        const selectedProductId = String(formData.get("shopifyProductId") || "").trim();

        if (!productId) {
          return { ok: false, intent, selectedProductId, error: "Missing product id." } satisfies ActionResult;
        }

        await resetMerchantProductKnowledge(request, productId);
        return {
          ok: true,
          intent,
          productId,
          productName,
          selectedProductId,
          message: `AI knowledge for ${productName || "this product"} has been cleared.`,
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
  const [showReadyProducts, setShowReadyProducts] = useState(false);
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
  const [workflowUrlByProduct, setWorkflowUrlByProduct] = useState<Record<string, string>>({});
  const [previewQuestionByProduct, setPreviewQuestionByProduct] = useState<Record<string, string>>({});
  const [previewAnswerByProduct, setPreviewAnswerByProduct] = useState<Record<string, string>>({});
  const [outcomesByProduct, setOutcomesByProduct] = useState<
    Record<string, Partial<Record<ProductStepOutcome["step"], StepOutcomeState>>>
  >({});
  const busy = navigation.state === "submitting";

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
      needsAiAnswers: rows.filter((row) => row.state === "needs_ai_answers").length,
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
  const needsActionRows = useMemo(
    () => searchedRows.filter((row) => row.state !== "ready"),
    [searchedRows],
  );
  const readyRows = useMemo(
    () => searchedRows.filter((row) => row.state === "ready"),
    [searchedRows],
  );
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
      actionData.intent === "save-setup" &&
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
  const workflowUrl = selectedRow ? workflowUrlByProduct[selectedRow.shopify.id] || "" : "";
  const previewQuestion = selectedRow
    ? previewQuestionByProduct[selectedRow.shopify.id] || "How do I use this product?"
    : "How do I use this product?";
  const previewAnswer = selectedRow ? previewAnswerByProduct[selectedRow.shopify.id] || "" : "";
  const handlePreviewQuestionChange = (productId: string, value: string) => {
    setPreviewQuestionByProduct((current) => ({
      ...current,
      [productId]: value,
    }));
  };
  const currentIntent = String(navigation.formData?.get("intent") || "");
  const currentSelectedProductId = String(
    navigation.formData?.get("selected_product_id") || navigation.formData?.get("shopifyProductId") || "",
  );
  const isSavingSetup =
    navigation.state === "submitting" &&
    currentSelectedProductId === selectedRow?.shopify.id &&
    currentIntent === "save-setup";
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

    if (nextProductId && typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  function closeSelectedProduct() {
    setSelectedProductId("");
    setHasInitializedSelection(true);
    setInlineValidationError(null);
    replaceProductSearchParam(null);
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

  const pageTitle = selectedRow ? undefined : "Products";
  const pageSubtitle = selectedRow
    ? undefined
    : "Set up each Shopify product so Recete can help customers after delivery.";

  return (
    <Page
      fullWidth
      title={pageTitle}
      subtitle={pageSubtitle}
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
                <InlineStack align="space-between" blockAlign="center" gap="200" wrap>
                  <BlockStack gap="050">
                    <Text as="h2" variant="headingMd">
                      Product setup queue
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {summary.needsSetup + summary.needsAiAnswers > 0
                        ? `${summary.needsSetup + summary.needsAiAnswers} products need action.`
                        : "All products are ready."}
                    </Text>
                  </BlockStack>
                  {nextIncompleteProduct ? (
                    <Button
                      variant="primary"
                      onClick={() => {
                        handleSelectProduct(nextIncompleteProduct.shopify.id, true);
                      }}
                    >
                      Continue setup
                    </Button>
                  ) : (
                    <Badge tone="success">All ready</Badge>
                  )}
                </InlineStack>
                {nextIncompleteProduct ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    Next product: {nextIncompleteProduct.shopify.title}
                  </Text>
                ) : null}
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
                <BlockStack gap="050">
                  <Text as="h2" variant="headingMd">
                    All products
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Start with products that need action.
                  </Text>
                </BlockStack>

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

                {needsActionRows.length > 0 ? (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Needs action ({needsActionRows.length})
                    </Text>
                    {needsActionRows.map((row) => (
                      <ProductBrowserItem
                        key={row.shopify.id}
                        row={row}
                        shopDomain={data.shopDomain}
                        selected={row.shopify.id === selectedProductId}
                        onSelect={() => {
                          handleSelectProduct(row.shopify.id, true);
                        }}
                      />
                    ))}
                  </BlockStack>
                ) : (
                  <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      No products need action right now.
                    </Text>
                  </Box>
                )}

                {readyRows.length > 0 ? (
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="p" variant="bodySm" fontWeight="semibold">
                        Ready products ({readyRows.length})
                      </Text>
                      <Button
                        variant="tertiary"
                        onClick={() => setShowReadyProducts((current) => !current)}
                        ariaExpanded={showReadyProducts}
                        ariaControls="ready-products-list"
                      >
                        {showReadyProducts ? "Hide ready products" : "Show ready products"}
                      </Button>
                    </InlineStack>
                    <Collapsible open={showReadyProducts} id="ready-products-list">
                      <BlockStack gap="200">
                        {readyRows.map((row) => (
                          <ProductBrowserItem
                            key={row.shopify.id}
                            row={row}
                            shopDomain={data.shopDomain}
                            selected={row.shopify.id === selectedProductId}
                            onSelect={() => {
                              handleSelectProduct(row.shopify.id, true);
                            }}
                          />
                        ))}
                      </BlockStack>
                    </Collapsible>
                  </BlockStack>
                ) : null}

                {searchedRows.length === 0 ? (
                  <Box padding="400" borderWidth="025" borderColor="border" borderRadius="200">
                    <EmptyState
                      heading="No products match this view"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      Try a different filter or search term.
                    </EmptyState>
                  </Box>
                ) : null}
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

function ProductListItem({
  row,
  shopDomain,
  selected,
  onSelect,
  quiet = false,
  children,
}: {
  row: WorkspaceRow;
  shopDomain: string;
  selected: boolean;
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
              <Badge tone={row.statusTone}>
                {row.statusLabel}
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
              {journey.shortStatus}
            </Text>
            <InlineStack gap="150" wrap>
              {row.state === "ready" ? (
                <Badge tone="success">Setup complete</Badge>
              ) : row.hasGuidance && row.hasKnowledge ? (
                <Badge tone="info">Background sync</Badge>
              ) : null}
            </InlineStack>
          </InlineStack>
          <JourneyStepper journey={journey} />
          <Text as="p" variant="bodySm" tone="subdued">
            {row.detailHint}
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
  workflowUrl,
  saveFeedback,
  inlineValidationError,
  actionError,
  actionMessage,
  actionIntent,
  previewQuestion,
  previewAnswer,
  onPreviewQuestionChange,
  stepOutcomes,
  isSavingSetup,
  isRunningAiAction,
  isDeletingLocalSetup,
  isPreviewingAnswer,
  embedded = false,
  onChangeDraft,
  onWorkflowUrlChange,
  setInlineValidationError,
  onBackToProducts,
}: {
  row: WorkspaceRow;
  shopDomain: string;
  draft: MappingDraft;
  dirty: boolean;
  workflowUrl: string;
  saveFeedback: SaveFeedback | null;
  inlineValidationError: string | null;
  actionError: string | null;
  actionMessage: string | null;
  actionIntent: string | null;
  previewQuestion: string;
  previewAnswer: string;
  onPreviewQuestionChange: (value: string) => void;
  stepOutcomes?: Partial<Record<ProductStepOutcome["step"], StepOutcomeState>>;
  isSavingSetup: boolean;
  isRunningAiAction: boolean;
  isDeletingLocalSetup: boolean;
  isPreviewingAnswer: boolean;
  embedded?: boolean;
  onChangeDraft: (field: keyof MappingDraft, value: string) => void;
  onWorkflowUrlChange: (value: string) => void;
  setInlineValidationError: (value: string | null) => void;
  onBackToProducts?: () => void;
}) {
  const submit = useSubmit();
  const [showReadyEditor, setShowReadyEditor] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasPersistedGuidance = Boolean(row.instruction?.usage_instructions?.trim());
  // Do not mark Step 1 as done from unsaved typing. This prevents accidental
  // step jumps (e.g. typing one character) before pressing Continue/Save draft.
  const hasGuidance = hasPersistedGuidance || (!dirty && Boolean(draft.usage_instructions.trim()));
  const hasAiKnowledge = row.hasKnowledge;
  const languagesDone =
    !row.languageWorkflowEnabled || row.languageCoverage >= 100 || row.readyLanguageCount > 0;

  const wizardSteps: Array<{
    key: "instructions" | "responses" | "languages";
    title: string;
    why: string;
    done: boolean;
  }> = [
    {
      key: "instructions",
      title: "Customer instructions",
      why: "Clear instructions define what customers should do after delivery.",
      done: hasGuidance,
    },
    {
      key: "responses",
      title: "AI responses",
      why: "Knowledge generation improves answer quality and confidence.",
      done: hasAiKnowledge,
    },
    {
      key: "languages",
      title: "Languages",
      why: "Language coverage helps Recete answer customers consistently across locales.",
      done: languagesDone,
    },
  ];
  const firstIncompleteIndex = wizardSteps.findIndex((step) => !step.done);
  const wizardComplete = row.state === "ready" || firstIncompleteIndex === -1;
  const activeWizardIndex = firstIncompleteIndex === -1 ? wizardSteps.length - 1 : firstIncompleteIndex;
  const resolvedWizardIndex = wizardComplete && showReadyEditor ? 0 : activeWizardIndex;
  const activeWizardStep = wizardSteps[resolvedWizardIndex]?.key || "instructions";
  const completedWizardSteps = wizardSteps.filter((step) => step.done).length;
  const wizardProgress = Math.round((completedWizardSteps / wizardSteps.length) * 100);
  const knowledge = buildKnowledgeSummary(row);
  const canSubmitSave = !isSavingSetup && !isRunningAiAction && !isDeletingLocalSetup;
  const canRunAiStep = !isRunningAiAction && !isSavingSetup && !isDeletingLocalSetup;
  const processRunning = isSavingSetup || isRunningAiAction || isDeletingLocalSetup;
  const lifecycle = getLifecyclePresentation(row, {
    actionError,
    processRunning,
  });
  const statusLabel =
    lifecycle.key === "ready" ? "Ready" : lifecycle.key === "processing" ? "In progress" : "Needs attention";
  const statusTone: "success" | "info" | "attention" =
    lifecycle.key === "ready" ? "success" : lifecycle.key === "processing" ? "info" : "attention";
  const activeStepMeta = wizardSteps[resolvedWizardIndex];

  useEffect(() => {
    setShowReadyEditor(false);
    setKnowledgeOpen(false);
    setPreviewOpen(false);
    setShowDangerZone(false);
    setConfirmDelete(false);
  }, [row.shopify.id]);

  function submitSaveDraft(requireInstructions: boolean) {
    if (!canSubmitSave) return;
    if (requireInstructions && !draft.usage_instructions.trim()) {
      setInlineValidationError("Customer instructions are required before continuing.");
      return;
    }
    setInlineValidationError(null);

    const formData = new FormData();
    formData.set("intent", "save-setup");
    formData.set("selected_product_id", row.shopify.id);
    formData.set("title", row.shopify.title);
    formData.set("handle", row.shopify.handle);
    formData.set("external_id", row.shopify.id);
    formData.set("description_html", row.shopify.descriptionHtml || "");
    formData.set("existing_product_id", row.localProduct?.id || "");
    formData.set("workflow_url", workflowUrl || "");
    formData.set("usage_instructions", draft.usage_instructions);
    formData.set("recipe_summary", draft.recipe_summary);
    formData.set("prevention_tips", draft.prevention_tips);
    formData.set("video_url", draft.video_url);
    submit(formData, { method: "post" });
  }

  function submitEmbeddingsFromStep() {
    if (!row.localProduct || !canRunAiStep) return;
    const formData = new FormData();
    formData.set("intent", "embeddings");
    formData.set("productId", row.localProduct?.id || "");
    formData.set("shopifyProductId", row.shopify.id);
    formData.set("productName", row.shopify.title);
    formData.set("hasContent", row.localProduct?.raw_text ? "true" : "false");
    formData.set("enrichmentUrl", workflowUrl || "");
    submit(formData, { method: "post" });
  }

  function submitPreviewAnswer() {
    if (!row.localProduct || isPreviewingAnswer || processRunning) return;
    const formData = new FormData();
    formData.set("intent", "preview-answer");
    formData.set("productId", row.localProduct.id);
    formData.set("shopifyProductId", row.shopify.id);
    formData.set("productName", row.shopify.title);
    formData.set("previewQuestion", previewQuestion.trim() || "How do I use this product?");
    submit(formData, { method: "post" });
  }

  const showEditor = activeWizardStep === "instructions" || showReadyEditor;
  const showAiResponsesStep = activeWizardStep === "responses" && !showEditor;
  const showLanguagesStep = activeWizardStep === "languages" && !showEditor;
  const canContinueStep = !processRunning;
  const setupScore = Math.max(0, Math.min(100, knowledge.qualityScore));
  const readySummary = knowledge.missingInfo.length
    ? "This product can answer questions, but coverage is not complete yet."
    : "This product is fully prepared for customer replies.";
  const runningMessage =
    activeWizardStep === "languages"
      ? "We’re updating product languages. This usually takes a few seconds."
      : "We’re preparing product knowledge. This usually takes a few seconds.";

  const content = (
    <BlockStack gap="500">
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "var(--p-color-bg-surface)",
          paddingBottom: "16px",
          paddingTop: "8px",
          borderBottom: "1px solid var(--p-color-border)",
        }}
      >
        <BlockStack gap="200">
          <InlineStack align="start">
            <Button variant="plain" onClick={onBackToProducts}>
              ← All products
            </Button>
          </InlineStack>

          <InlineStack align="space-between" blockAlign="center" wrap>
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
                  {[row.shopify.vendor || "Shopify product", `/${row.shopify.handle}`].join(" • ")}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {lifecycle.message}
                </Text>
              </BlockStack>
            </InlineStack>
            <Badge tone={statusTone}>
              {statusLabel}
            </Badge>
          </InlineStack>

          <Box padding="150" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="100">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="bodySm" fontWeight="semibold">
                  Step {resolvedWizardIndex + 1} of {wizardSteps.length}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {activeStepMeta?.title || "Setup"}
                </Text>
              </InlineStack>
              <ProgressBar progress={wizardProgress} size="small" />
            </BlockStack>
          </Box>
        </BlockStack>
      </div>

      {processRunning ? (
        <Banner tone="info" title="Updating">
          <Text as="p" variant="bodyMd">{runningMessage}</Text>
        </Banner>
      ) : null}

      {actionError && !processRunning ? (
        <Banner tone="critical" title="Action failed">
          <Text as="p" variant="bodyMd">{actionError}</Text>
        </Banner>
      ) : null}
      {actionMessage && !actionError && !processRunning ? (
        <Banner tone="success" title="Success">
          <Text as="p" variant="bodyMd">{actionMessage}</Text>
        </Banner>
      ) : null}

      {!wizardComplete || showReadyEditor ? (
        <Card padding="500">
          <BlockStack gap="400">
            {showEditor && (
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Step 1: Customer instructions
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {wizardSteps[0].why}
                </Text>
                <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Good examples:
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Use twice daily on clean skin, morning and evening.
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Avoid direct contact with eyes. Stop use if irritation appears.
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Keep away from children and store below 25C.
                    </Text>
                  </BlockStack>
                </Box>

                <TextField
                  label="Customer instructions"
                  name="usage_instructions"
                  value={draft.usage_instructions}
                  onChange={(value) => onChangeDraft("usage_instructions", value)}
                  multiline={6}
                  autoComplete="off"
                  error={inlineValidationError ? "Customer instructions are required." : undefined}
                  helpText="Write the exact guidance Recete should send to customers after delivery."
                />

                <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
                  <TextField
                    label="Warnings and important notes"
                    name="prevention_tips"
                    value={draft.prevention_tips}
                    onChange={(value) => onChangeDraft("prevention_tips", value)}
                    multiline={3}
                    autoComplete="off"
                  />
                  <TextField
                    label="Key product summary"
                    name="recipe_summary"
                    value={draft.recipe_summary}
                    onChange={(value) => onChangeDraft("recipe_summary", value)}
                    multiline={3}
                    autoComplete="off"
                  />
                </InlineGrid>

                <InlineStack gap="200" wrap>
                  {canContinueStep ? (
                    <>
                      <Button
                        variant="primary"
                        loading={isSavingSetup}
                        disabled={!canSubmitSave}
                        onClick={() => submitSaveDraft(true)}
                      >
                        Continue
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={!canSubmitSave}
                        onClick={() => submitSaveDraft(false)}
                      >
                        Save draft
                      </Button>
                    </>
                  ) : null}
                </InlineStack>
              </BlockStack>
            )}

            {showAiResponsesStep && (
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Step 2: AI responses
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {wizardSteps[1].why}
                </Text>

                <TextField
                  label="Extra source URL"
                  autoComplete="off"
                  value={workflowUrl}
                  onChange={onWorkflowUrlChange}
                  placeholder="https://example.com/product-faq"
                  helpText="Optional. Add a page with FAQs or usage details to improve answer quality."
                />

                <InlineStack gap="200" wrap>
                  {canContinueStep ? (
                    <>
                      <Button
                        variant="primary"
                        loading={isRunningAiAction}
                        disabled={!row.localProduct || !canRunAiStep}
                        onClick={submitEmbeddingsFromStep}
                      >
                        Continue
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={!canSubmitSave}
                        onClick={() => submitSaveDraft(false)}
                      >
                        Save draft
                      </Button>
                    </>
                  ) : null}
                </InlineStack>
              </BlockStack>
            )}

            {showLanguagesStep && (
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Step 3: Languages
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {wizardSteps[2].why}
                </Text>

                <TextField
                  label="Extra source URL"
                  autoComplete="off"
                  value={workflowUrl}
                  onChange={onWorkflowUrlChange}
                  placeholder="https://example.com/product-faq"
                  helpText="Optional. If Step 2 was auto-completed, you can still add a source URL here before continuing."
                />

                <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Current coverage
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {row.languageWorkflowEnabled
                        ? `${row.readyLanguageCount} of ${row.requiredLanguageCount} languages ready (${row.languageCoverage}%).`
                        : "Primary language coverage is active."}
                    </Text>
                  </BlockStack>
                </Box>

                {row.languageWorkflowEnabled && row.languageCoverage < 100 ? (
                  <Text as="p" variant="bodySm" tone="subdued">
                    Language sync may continue in the background. You can continue now and monitor coverage later.
                  </Text>
                ) : null}

                <InlineStack gap="200" wrap>
                  {canContinueStep ? (
                    <>
                      <Button
                        variant="primary"
                        loading={isRunningAiAction}
                        disabled={!row.localProduct || !canRunAiStep}
                        onClick={submitEmbeddingsFromStep}
                      >
                        Continue
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={!canSubmitSave}
                        onClick={() => submitSaveDraft(false)}
                      >
                        Save draft
                      </Button>
                    </>
                  ) : null}
                </InlineStack>
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      ) : (
        <BlockStack gap="400">
          <Card padding="500">
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center" wrap>
                <BlockStack gap="050">
                  <Text as="h2" variant="headingMd">
                    Setup completeness: {setupScore}%
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {readySummary}
                  </Text>
                </BlockStack>
                <Badge tone={knowledge.missingInfo.length ? "attention" : "success"}>
                  {knowledge.missingInfo.length ? "Needs attention" : "Ready"}
                </Badge>
              </InlineStack>
              <ProgressBar progress={setupScore} tone={knowledge.missingInfo.length ? "highlight" : "success"} />
              {knowledge.missingInfo.length > 0 ? (
                <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Missing for full coverage
                    </Text>
                    {knowledge.missingInfo.map((item) => (
                      <Text key={item} as="p" variant="bodySm" tone="subdued">
                        • {item}
                      </Text>
                    ))}
                    <InlineStack>
                      <Button onClick={() => setShowReadyEditor(true)} disabled={processRunning}>
                        Add missing details
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Box>
              ) : (
                <InlineStack>
                  <Button onClick={() => setShowReadyEditor(true)} disabled={processRunning}>
                    Edit setup
                  </Button>
                </InlineStack>
              )}
            </BlockStack>
          </Card>

          <Card padding="400">
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="headingSm">
                  AI knowledge
                </Text>
                <Button
                  variant="tertiary"
                  onClick={() => setKnowledgeOpen((current) => !current)}
                  ariaExpanded={knowledgeOpen}
                >
                  {knowledgeOpen ? "Hide" : "Review"}
                </Button>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                This is the information Recete uses to answer customer questions.
              </Text>
              <Collapsible open={knowledgeOpen} id={`knowledge-${row.shopify.id}`}>
                <BlockStack gap="200">
                  <InfoMiniCard title="How Recete should answer" body={knowledge.howToUse} />
                  <InfoListCard
                    title="Key product details"
                    items={knowledge.keyDetails}
                    empty="No key details yet."
                  />
                  <InfoListCard
                    title="Warnings"
                    items={knowledge.warnings}
                    empty="No warnings saved yet."
                  />
                  <InfoListCard
                    title="Common customer questions"
                    items={knowledge.commonQuestions}
                    empty="No common question patterns yet."
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
              </Collapsible>
            </BlockStack>
          </Card>

          <Card padding="400">
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="headingSm">
                  Preview answer
                </Text>
                <Button
                  variant="tertiary"
                  onClick={() => setPreviewOpen((current) => !current)}
                  ariaExpanded={previewOpen}
                >
                  {previewOpen ? "Hide" : "Open"}
                </Button>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Ask a sample question and see how Recete responds.
              </Text>
              <Collapsible open={previewOpen} id={`preview-${row.shopify.id}`}>
                <BlockStack gap="200">
                  <TextField
                    label="Sample question"
                    autoComplete="off"
                    value={previewQuestion}
                    onChange={onPreviewQuestionChange}
                  />
                  <InlineStack>
                    <Button
                      variant="secondary"
                      loading={isPreviewingAnswer}
                      disabled={!row.localProduct || processRunning}
                      onClick={submitPreviewAnswer}
                    >
                      Regenerate answer
                    </Button>
                  </InlineStack>
                  <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      {previewAnswer || "Generate a preview to inspect the response."}
                    </Text>
                  </Box>
                </BlockStack>
              </Collapsible>
            </BlockStack>
          </Card>
        </BlockStack>
      )}

      {wizardComplete && row.localProduct && (
        <BlockStack gap="200">
          <InlineStack>
            <Button
              size="slim"
              variant="plain"
              tone="critical"
              onClick={() => setShowDangerZone((current) => !current)}
            >
              {showDangerZone ? "Hide danger zone" : "Show danger zone"}
            </Button>
          </InlineStack>

          {showDangerZone && (
            <Box padding="200" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Danger zone</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Remove the saved Recete setup for this product. The Shopify product will stay untouched.
                </Text>
                <Checkbox
                  label="I understand this removes the saved setup for this product."
                  checked={confirmDelete}
                  onChange={setConfirmDelete}
                />
                <InlineStack>
                  <InlineActionForm
                    productId={row.localProduct.id}
                    shopifyProductId={row.shopify.id}
                    intent="delete"
                    label="Remove local setup"
                    icon={DeleteIcon}
                    destructive
                    disabled={!confirmDelete || isSavingSetup || isRunningAiAction}
                    loading={isDeletingLocalSetup}
                    variant="secondary"
                  />
                </InlineStack>
              </BlockStack>
            </Box>
          )}
        </BlockStack>
      )}
    </BlockStack>
  );

  if (embedded) return content;

  return content;
}

function ProductBrowserItem({
  row,
  shopDomain,
  selected,
  onSelect,
}: {
  row: WorkspaceRow;
  shopDomain: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const journey = getJourneyMeta(row);
  const productPath = displayProductPath(
    row.localProduct?.url || `https://${shopDomain}/products/${row.shopify.handle}`,
  );
  const lifecycle = getLifecyclePresentation(row);

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
            <Badge tone={lifecycle.tone}>
              {lifecycle.label}
            </Badge>
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">
            {[row.shopify.vendor || "Shopify product", productPath].filter(Boolean).join(" • ")}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {lifecycle.message}
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
  confirmMessage,
}: {
  productId: string;
  shopifyProductId: string;
  productName?: string;
  intent: string;
  label: string;
  icon?: unknown;
  hasContent?: boolean;
  destructive?: boolean;
  enrichmentUrl?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "tertiary";
  onActionStart?: () => void;
  confirmMessage?: string;
}) {
  const submit = useSubmit();

  function submitAction() {
    if (disabled || loading) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
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
