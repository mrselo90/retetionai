/**
 * Product workspace rows: the Shopify catalog joined with Recete's own product
 * records, instructions and facts, plus the status, filters and paging the
 * Products screens show. Pure functions only, shared by server and client.
 */

import type {
  MerchantProduct,
  MerchantProductInstruction,
  ProductFactsSnapshot,
  ProductStepOutcome,
  ShopifyCatalogProduct,
} from '../platform.server';

export type MappingDraft = {
  usage_instructions: string;
  recipe_summary: string;
  prevention_tips: string;
  video_url: string;
};

export type StepOutcomeState = ProductStepOutcome & {
  message?: string;
  intent?: string;
};

export type ActionResult = {
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
  draft?: { usage_instructions: string; prevention_tips: string; recipe_summary: string };
};

// Products drafted per "Draft all with AI" click. Each needs an AI call and a
// few platform writes; this keeps one request well inside timeouts.
export const BULK_DRAFT_LIMIT = 30;

export type SetupState = 'needs_setup' | 'needs_ai_answers' | 'ready';
export type JourneyStep = 'guidance' | 'improve' | 'ready';

export type WorkspaceRow = {
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
  languageState: 'not_started' | 'pending' | 'ready';
  sourceLanguage?: string | null;
  languageSummary: string;
  languageTone: 'attention' | 'info' | 'success';
  progress: number;
  state: SetupState;
  statusLabel: string;
  statusTone: 'attention' | 'info' | 'success';
  nextActionLabel: string;
  detailHint: string;
};

export type LifecyclePresentation = {
  key: 'needs_setup' | 'needs_ai_answers' | 'processing' | 'ready' | 'error';
  label: string;
  tone: 'attention' | 'info' | 'success' | 'critical';
  message: string;
};

export type KnowledgeSummary = {
  howToUse: string;
  keyDetails: string[];
  commonQuestions: string[];
  warnings: string[];
  sources: string[];
  missingInfo: string[];
  qualityScore: number;
};

export type JourneyMeta = {
  activeStep: JourneyStep;
  completedSteps: number;
  totalSteps: number;
  nextActionLabel: string;
  shortStatus: string;
};

export function emptyDraft(): MappingDraft {
  return {
    usage_instructions: '',
    recipe_summary: '',
    prevention_tips: '',
    video_url: '',
  };
}

export function draftFromInstruction(instruction?: MerchantProductInstruction): MappingDraft {
  return {
    usage_instructions: instruction?.usage_instructions || '',
    recipe_summary: instruction?.recipe_summary || '',
    prevention_tips: instruction?.prevention_tips || '',
    video_url: instruction?.video_url || '',
  };
}

export function formatOutcomeDelta(delta?: Record<string, unknown>) {
  if (!delta) return '';

  const parts: string[] = [];
  if (typeof delta.source === 'string') {
    parts.push(delta.source === 'workflow_url' ? 'extra source' : 'product page');
  }
  if (typeof delta.chunksCreated === 'number') {
    parts.push(`${delta.chunksCreated} chunks`);
  }
  if (typeof delta.totalTokens === 'number') {
    parts.push(`${delta.totalTokens} tokens`);
  }
  if (typeof delta.jobId === 'string') {
    parts.push(`job ${delta.jobId}`);
  }

  return parts.join(' • ');
}

export function summarizeText(text: string, maxLength = 140) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trim()}…`;
}

export function getLifecyclePresentation(
  row: WorkspaceRow,
  options?: {
    actionError?: string | null;
    processRunning?: boolean;
    recentAction?: boolean;
  }
): LifecyclePresentation {
  const persistedLifecycle = row.localProduct?.lifecycle;

  if (options?.actionError) {
    return {
      key: 'error',
      label: 'Needs attention',
      tone: 'critical',
      message: options.actionError,
    };
  }

  if (options?.processRunning || options?.recentAction) {
    return {
      key: 'processing',
      label: 'Preparing answers',
      tone: 'info',
      message:
        'Recete is processing this product right now. There is nothing to click until this finishes.',
    };
  }

  if (persistedLifecycle) {
    return {
      key: persistedLifecycle.status,
      label: persistedLifecycle.label,
      tone:
        persistedLifecycle.status === 'ready'
          ? 'success'
          : persistedLifecycle.status === 'needs_ai_answers'
            ? 'info'
            : 'attention',
      message: persistedLifecycle.message,
    };
  }

  if (!row.linked || !row.hasGuidance) {
    return {
      key: 'needs_setup',
      label: 'Needs setup',
      tone: 'attention',
      message: 'Add customer guidance so Recete knows what customers should do after delivery.',
    };
  }

  if (!row.hasKnowledge) {
    return {
      key: 'needs_ai_answers',
      label: 'Needs AI answers',
      tone: 'info',
      message:
        'The guidance is saved. Recete still needs product knowledge before it can answer customers well.',
    };
  }

  return {
    key: 'ready',
    label: 'Ready',
    tone: 'success',
    message:
      row.languageWorkflowEnabled && row.languageCoverage < 100
        ? 'Setup is complete. Extra language coverage will keep improving in the background.'
        : 'Setup is complete and this product is ready to answer customer questions.',
  };
}

export function getFactsArray(facts: Record<string, unknown> | null | undefined, key: string): string[] {
  const value = facts?.[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter((item) => item.trim());
}

export function buildKnowledgeSummary(row: WorkspaceRow): KnowledgeSummary {
  const facts = (row.factsSnapshot?.facts_json || {}) as Record<string, unknown>;
  const identity = (facts.product_identity || {}) as Record<string, unknown>;
  const usageSteps = getFactsArray(facts, 'usage_steps');
  const benefits = getFactsArray(facts, 'benefits');
  const ingredients = getFactsArray(facts, 'ingredients');
  const activeIngredients = getFactsArray(facts, 'active_ingredients');
  const claims = getFactsArray(facts, 'claims');
  const skinTypes = getFactsArray(facts, 'target_skin_types');
  const warnings = [
    ...(row.instruction?.prevention_tips ? [row.instruction.prevention_tips] : []),
    ...getFactsArray(facts, 'warnings'),
  ]
    .map((item) => summarizeText(String(item), 120))
    .filter(Boolean);

  const howToUseSource =
    row.instruction?.usage_instructions || (usageSteps.length ? usageSteps.join('. ') : '');
  const howToUse = summarizeText(howToUseSource || 'No usage guidance yet.', 160);

  const keyDetails: string[] = [];
  if (identity.brand) keyDetails.push(`Brand: ${identity.brand}`);
  if (identity.product_type) keyDetails.push(`Type: ${identity.product_type}`);
  if (identity.variant) keyDetails.push(`Variant: ${identity.variant}`);
  if (identity.volume_value && identity.volume_unit) {
    keyDetails.push(`Size: ${identity.volume_value} ${identity.volume_unit}`);
  }
  if (benefits.length) keyDetails.push(`Benefits: ${benefits.slice(0, 3).join(', ')}`);
  if (claims.length) keyDetails.push(`Claims: ${claims.slice(0, 3).join(', ')}`);
  if (skinTypes.length) keyDetails.push(`Best for: ${skinTypes.slice(0, 3).join(', ')}`);
  if (activeIngredients.length)
    keyDetails.push(`Active ingredients: ${activeIngredients.slice(0, 3).join(', ')}`);
  if (ingredients.length) keyDetails.push(`Ingredients: ${ingredients.slice(0, 3).join(', ')}`);
  if (row.instruction?.recipe_summary?.trim())
    keyDetails.push(
      `Key features & ingredients: ${summarizeText(row.instruction.recipe_summary, 120)}`
    );

  const commonQuestions = [
    'How do I use this product?',
    keyDetails.length ? 'What does this product help with?' : '',
    ingredients.length || activeIngredients.length ? 'What are the key ingredients?' : '',
  ].filter(Boolean);

  const sources: string[] = [];
  if (row.localProduct?.url) sources.push('Product page');
  if (row.hasGuidance) sources.push('Your guidance');
  if (row.hasOptionalDetails) sources.push('Optional details');
  if (row.factsSnapshot?.source_url) sources.push('Structured product facts');

  const hasManualFeatures = Boolean(row.instruction?.recipe_summary?.trim());
  const languageCoverageIncomplete = row.languageWorkflowEnabled && row.languageCoverage < 100;

  const missingInfo: string[] = [];
  if (!row.instruction?.usage_instructions?.trim()) missingInfo.push('How to use the product');
  // AI knowledge is the precondition for answering anything: without embeddings
  // retrieval returns nothing regardless of how complete the text fields look.
  if (!row.hasKnowledge) missingInfo.push('AI knowledge (not generated yet)');
  if (!warnings.length) missingInfo.push('Warnings or important notes');
  if (!benefits.length && !claims.length && !hasManualFeatures) missingInfo.push('Key benefits');
  if (!ingredients.length && !activeIngredients.length) missingInfo.push('Ingredients');
  if (languageCoverageIncomplete) missingInfo.push('Reply language coverage');

  // Scored against what actually determines answer quality, not just whether
  // text fields are non-empty. The previous version never looked at embeddings,
  // so a product with zero AI knowledge could still read "100% complete", and
  // its floor was 40% because nothing could take it lower.
  let qualityScore = 100;
  if (!row.hasKnowledge) qualityScore -= 30;
  if (!row.instruction?.usage_instructions?.trim()) qualityScore -= 20;
  if (!warnings.length) qualityScore -= 10;
  if (!benefits.length && !claims.length && !hasManualFeatures) qualityScore -= 10;
  // recipe_summary no longer satisfies this: one free-text field used to buy
  // back 30 points across two checks without any ingredient data existing.
  if (!ingredients.length && !activeIngredients.length) qualityScore -= 20;
  if (languageCoverageIncomplete) qualityScore -= 10;
  qualityScore = Math.max(0, qualityScore);

  return {
    howToUse,
    keyDetails,
    commonQuestions,
    warnings,
    sources: sources.length ? sources : ['No sources connected yet'],
    missingInfo,
    qualityScore,
  };
}

export function getJourneyMeta(row: WorkspaceRow): JourneyMeta {
  const guidanceDone = row.linked && row.hasGuidance;
  const improveDone = row.hasKnowledge;
  const totalSteps = 2;
  const completedSteps = [guidanceDone, improveDone].filter(Boolean).length;

  if (!guidanceDone) {
    return {
      activeStep: 'guidance',
      completedSteps,
      totalSteps,
      nextActionLabel: 'Continue',
      shortStatus: 'Write what customers should know',
    };
  }
  if (!improveDone) {
    return {
      activeStep: 'improve',
      completedSteps,
      totalSteps,
      nextActionLabel: 'Continue',
      shortStatus: 'Improve AI replies',
    };
  }
  return {
    activeStep: 'ready',
    completedSteps: totalSteps,
    totalSteps,
    nextActionLabel: 'Review',
    shortStatus: 'Setup complete',
  };
}

export function buildWorkspaceRows(
  catalogProducts: ShopifyCatalogProduct[],
  merchantProducts: MerchantProduct[],
  instructions: MerchantProductInstruction[],
  productFacts: ProductFactsSnapshot[],
  serviceLanguages: string[],
  multiLangEnabled: boolean
): WorkspaceRow[] {
  const localByExternalId = new Map(
    merchantProducts
      .filter((product) => product.external_id)
      .map((product) => [product.external_id as string, product])
  );
  const instructionsByExternalId = new Map<string, MerchantProductInstruction>();
  const instructionsByProductId = new Map<string, MerchantProductInstruction>();

  for (const instruction of instructions) {
    if (instruction.external_id) instructionsByExternalId.set(instruction.external_id, instruction);
    instructionsByProductId.set(instruction.product_id, instruction);
  }

  const factsByProductId = new Map((productFacts || []).map((fact) => [fact.product_id, fact]));

  const catalogExternalIds = new Set(catalogProducts.map((p) => p.id));
  const combinedProducts = [...catalogProducts];

  for (const mp of merchantProducts) {
    if (!mp.external_id || !catalogExternalIds.has(mp.external_id)) {
      combinedProducts.push({
        id: mp.id,
        title: mp.name || 'Manual Source',
        handle: `manual-${mp.id.slice(0, 8)}`,
        status: 'ACTIVE',
        vendor: 'Manual Entry',
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
      instruction?.video_url?.trim()
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
    const languageCoverage =
      linked && hasGuidance
        ? languageWorkflowEnabled
          ? (languageHealth?.answerCoverage ?? 0)
          : baseChunkCount > 0
            ? 100
            : 0
        : 0;
    const hasKnowledge = readyLanguageCount > 0 || Boolean(baseChunkCount > 0);
    const languageState = languageWorkflowEnabled
      ? languageHealth?.state || 'not_started'
      : baseChunkCount > 0
        ? 'ready'
        : 'not_started';
    const state: SetupState =
      !linked || !hasGuidance ? 'needs_setup' : hasKnowledge ? 'ready' : 'needs_ai_answers';
    const progress = !linked
      ? 0
      : !hasGuidance
        ? 30
        : Math.min(100, Math.max(55, 55 + Math.round(languageCoverage * 0.45)));
    const languageSummary =
      !linked || !hasGuidance
        ? `Reply languages will be prepared after guidance is saved`
        : !languageWorkflowEnabled
          ? 'Primary reply language is ready.'
          : languageCoverage >= 100
            ? `Ready in ${readyLanguageCount}/${requiredLanguageCount} reply languages`
            : readyLanguageCount > 0
              ? `${readyLanguageCount}/${requiredLanguageCount} reply languages are ready. More are still syncing.`
              : languageState === 'pending'
                ? `Language sync is running in the background`
                : `Reply languages will keep syncing in the background`;
    const languageTone =
      !linked || !hasGuidance
        ? 'info'
        : languageCoverage >= 100
          ? 'success'
          : readyLanguageCount > 0
            ? 'attention'
            : 'info';

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
        (!linked || !hasGuidance ? 'Needs setup' : hasKnowledge ? 'Ready' : 'Needs AI answers'),
      statusTone:
        localProduct?.lifecycle?.status === 'ready'
          ? 'success'
          : localProduct?.lifecycle?.status === 'needs_ai_answers'
            ? 'info'
            : !linked || !hasGuidance
              ? 'attention'
              : hasKnowledge
                ? 'success'
                : 'info',
      nextActionLabel:
        localProduct?.lifecycle?.nextActionLabel ||
        (!linked ? 'Set up' : !hasGuidance ? 'Continue' : hasKnowledge ? 'Review' : 'Generate AI'),
      detailHint:
        localProduct?.lifecycle?.message ||
        (!linked
          ? 'Create the Recete setup and add guidance.'
          : !hasGuidance
            ? 'Add customer guidance so Recete knows what customers should do next.'
            : hasKnowledge
              ? languageWorkflowEnabled && languageCoverage < 100
                ? 'Answers are ready now. Extra language coverage will keep syncing in the background.'
                : 'Ready for customer replies.'
              : 'Prepare the answer knowledge Recete will use in customer replies.'),
    };
  });
}

export const PRODUCT_TABS = ['all', 'needs_setup', 'needs_ai_answers', 'ready'] as const;
export type ProductTab = (typeof PRODUCT_TABS)[number];

export const PRODUCT_TAB_LABELS: Record<ProductTab, string> = {
  all: 'All',
  needs_setup: 'Needs setup',
  needs_ai_answers: 'Needs AI answers',
  ready: 'Ready',
};

export function parseProductTab(value: string | null | undefined): ProductTab {
  return PRODUCT_TABS.includes(value as ProductTab) ? (value as ProductTab) : 'all';
}

/** Case-insensitive match on title, handle or vendor. */
export function searchWorkspaceRows(rows: WorkspaceRow[], query: string): WorkspaceRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [row.shopify.title, row.shopify.handle, row.shopify.vendor || ''].some((value) =>
      value.toLowerCase().includes(needle)
    )
  );
}

export function filterWorkspaceRows(
  rows: WorkspaceRow[],
  { tab, query }: { tab: ProductTab; query: string }
): WorkspaceRow[] {
  const searched = searchWorkspaceRows(rows, query);
  return tab === 'all' ? searched : searched.filter((row) => row.state === tab);
}

/** Tab counts for the current search, so a tab's number matches what it lists. */
export function countWorkspaceRows(rows: WorkspaceRow[]): Record<ProductTab, number> {
  const counts: Record<ProductTab, number> = {
    all: rows.length,
    needs_setup: 0,
    needs_ai_answers: 0,
    ready: 0,
  };
  for (const row of rows) counts[row.state] += 1;
  return counts;
}

export function paginateRows<T>(
  items: T[],
  page: number,
  pageSize: number
): { items: T[]; page: number; pageCount: number; hasPrevious: boolean; hasNext: boolean } {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: current,
    pageCount,
    hasPrevious: current > 1,
    hasNext: current < pageCount,
  };
}
