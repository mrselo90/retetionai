import crypto from 'node:crypto';
import { getProductInstructionsByProductIds } from '@recete/shared';
import { formatRAGResultsForLLM, getOrderProductContextResolved, type RAGResult } from './rag.js';
import { getActiveProductFactsContext, getActiveProductFactsSnapshots } from './productFactsQuery.js';
import { planStructuredFactAnswer } from './productFactsPlanner.js';
import type { SupportedLanguage } from './i18n.js';
import { UnifiedRetrievalService } from './unifiedRetrieval.js';
import { getCosmeticRagPolicy } from './ragRetrievalPolicy.js';

export interface GroundingAssemblyInput {
  merchantId: string;
  question: string;
  userLang: SupportedLanguage;
  responseLang?: SupportedLanguage;
  orderId?: string;
  productIds?: string[];
  retrievalQuery?: string;
  plannerQuery?: string;
  topK?: number;
  similarityThreshold?: number;
  preferredSectionTypes?: string[];
  cacheKey?: string;
  cacheTtlSeconds?: number;
  instructionScope?: 'order_only' | 'facts_products';
  responseLength?: string;
}

export interface GroundingAssemblyOutput {
  context?: string;
  citedProducts: string[];
  usedDeterministicFacts: boolean;
  deterministicAnswer?: string;
  orderScopeSource?: string;
  retrievalLanguage: string;
  retrievalUsedFallback: boolean;
  retrievalFallbackLanguage: string | null;
}

function buildRecipeBlock(row: any): string {
  let block = `[${row.product_name ?? 'Product'}]\nUsage / Recipe: ${row.usage_instructions}`;
  if (row.recipe_summary) block += `\nSummary: ${row.recipe_summary}`;
  if (row.video_url) block += `\nTutorial Video: ${row.video_url}`;
  if (row.prevention_tips) block += `\nReturn Prevention Tips: ${row.prevention_tips}`;
  return block;
}

function getEvidencePriority(result: RAGResult): number {
  const section = String(result.sectionType || '').toLowerCase();
  if (section === 'faq') return 10;
  if (section === 'warnings') return 20;
  if (section === 'usage') return 30;
  if (section === 'ingredients' || section === 'active_ingredients') return 40;
  if (section === 'troubleshooting') return 50;
  if (section === 'specs' || section === 'identity' || section === 'claims') return 60;
  if (section === 'general') return 90;
  return 75;
}

export function prioritizeEvidenceResults(results: RAGResult[]): RAGResult[] {
  return [...results].sort((a, b) => {
    const priorityDelta = getEvidencePriority(a) - getEvidencePriority(b);
    if (priorityDelta !== 0) return priorityDelta;
    return Number(b.similarity || 0) - Number(a.similarity || 0);
  });
}

export function buildInstructionEvidenceBlock(instructions: any[]): string {
  const recipeBlocks = instructions.map(buildRecipeBlock);
  return recipeBlocks.length > 0
    ? `--- Product usage instructions (recipes) ---\n${recipeBlocks.join('\n\n')}`
    : '';
}

export function buildGroundedEvidenceContext(input: {
  factsText?: string;
  instructions?: any[];
  ragResults?: RAGResult[];
}): string {
  const prioritizedResults = prioritizeEvidenceResults(input.ragResults || []);
  const ragContext = prioritizedResults.length > 0
    ? formatRAGResultsForLLM(prioritizedResults)
    : '';
  const instructionBlock = buildInstructionEvidenceBlock(input.instructions || []);

  return [
    input.factsText || '',
    instructionBlock,
    ragContext,
  ].filter(Boolean).join('\n\n');
}

export function buildGroundingCacheKey(input: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

export async function assembleGroundingEvidence(
  input: GroundingAssemblyInput,
): Promise<GroundingAssemblyOutput> {
  const retrievalPolicy = getCosmeticRagPolicy(input.retrievalQuery || input.question);
  let scopedProductIds = Array.isArray(input.productIds) && input.productIds.length > 0
    ? [...new Set(input.productIds)]
    : undefined;
  let orderScopeSource: string | undefined;

  if ((!scopedProductIds || scopedProductIds.length === 0) && input.orderId) {
    const orderScope = await getOrderProductContextResolved(input.orderId, input.merchantId);
    scopedProductIds = orderScope.productIds;
    orderScopeSource = orderScope.source;
  }

  const shouldSuppressBroadRetrieval = Boolean(input.orderId && (!scopedProductIds || scopedProductIds.length === 0));
  const retrievalQuery = input.retrievalQuery || input.question;
  const cacheKey = input.cacheKey || buildGroundingCacheKey({
    merchantId: input.merchantId,
    retrievalQuery,
    productIds: scopedProductIds || null,
    topK: input.topK || retrievalPolicy.topK,
    similarityThreshold: input.similarityThreshold || retrievalPolicy.similarityThreshold,
    preferredSectionTypes: input.preferredSectionTypes || retrievalPolicy.preferredSectionTypes || null,
    lang: input.userLang,
    responseLang: input.responseLang || input.userLang,
  });

  const ragResult = shouldSuppressBroadRetrieval
    ? {
        query: retrievalQuery,
        results: [],
        totalResults: 0,
        executionTime: 0,
        effectiveLanguage: input.userLang,
        usedFallback: false,
        fallbackLanguage: null,
      }
    : await new UnifiedRetrievalService().retrieve({
        merchantId: input.merchantId,
        question: retrievalQuery,
        userLang: input.userLang,
        productIds: scopedProductIds,
        topK: input.topK || retrievalPolicy.topK,
        similarityThreshold: input.similarityThreshold || retrievalPolicy.similarityThreshold,
        preferredSectionTypes: input.preferredSectionTypes || retrievalPolicy.preferredSectionTypes,
        cacheKey,
        cacheTtlSeconds: input.cacheTtlSeconds ?? 900,
      });

  const instructionProductIds =
    input.instructionScope === 'order_only'
      ? (scopedProductIds || [])
      : ((scopedProductIds && scopedProductIds.length > 0)
          ? scopedProductIds
          : [...new Set(ragResult.results.map((r) => r.productId))]);

  const factsProductIds = instructionProductIds.length > 0
    ? instructionProductIds
    : [...new Set(ragResult.results.map((r) => r.productId))];

  const [factsContext, factsSnapshots, instructions] = await Promise.all([
    factsProductIds.length > 0
      ? getActiveProductFactsContext(input.merchantId, factsProductIds)
      : Promise.resolve({ text: '', factCount: 0, productIds: [] }),
    factsProductIds.length > 0
      ? getActiveProductFactsSnapshots(input.merchantId, factsProductIds)
      : Promise.resolve([]),
    instructionProductIds.length > 0
      ? getProductInstructionsByProductIds(input.merchantId, instructionProductIds)
      : Promise.resolve([]),
  ]);

  const plannerQuery = input.plannerQuery || input.question;
  const planned = factsSnapshots.length > 0
    ? planStructuredFactAnswer(plannerQuery, input.responseLang || input.userLang, factsSnapshots, {
        responseLength: input.responseLength,
        includeEvidenceQuote: true,
      })
    : null;

  const context = buildGroundedEvidenceContext({
    factsText: factsContext.text || '',
    instructions,
    ragResults: ragResult.results,
  });

  return {
    context: context || undefined,
    citedProducts: factsProductIds.length > 0
      ? factsProductIds
      : [...new Set(ragResult.results.map((r) => r.productId))],
    usedDeterministicFacts: Boolean(planned),
    deterministicAnswer: planned?.answer,
    orderScopeSource,
    retrievalLanguage: ragResult.effectiveLanguage,
    retrievalUsedFallback: ragResult.usedFallback,
    retrievalFallbackLanguage: ragResult.fallbackLanguage,
  };
}
