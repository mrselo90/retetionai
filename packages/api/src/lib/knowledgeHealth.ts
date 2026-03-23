export type KnowledgeReasonCode =
  | 'missing_scraped_content'
  | 'missing_enriched_content'
  | 'missing_usage_instructions'
  | 'thin_usage_instructions'
  | 'missing_return_tips'
  | 'missing_facts'
  | 'missing_embeddings';

export interface ProductKnowledgeHealth {
  score: number;
  coverage: 'strong' | 'moderate' | 'weak';
  answerRisk: 'low' | 'medium' | 'high';
  missingReasonCodes: KnowledgeReasonCode[];
  metrics: {
    chunkCount: number;
    factFieldCount: number;
    hasEnrichedText: boolean;
    hasFacts: boolean;
    hasPreventionTips: boolean;
    hasRawText: boolean;
    usageInstructionLength: number;
  };
}

export interface MerchantKnowledgeHealthSummary {
  averageScore: number;
  strongProducts: number;
  productsAtRisk: number;
  weakProducts: number;
  topMissingReasonCode: KnowledgeReasonCode | null;
  topMissingReasonCount: number;
  topAtRiskProducts: Array<{
    answerRisk: ProductKnowledgeHealth['answerRisk'];
    id: string;
    name: string;
    score: number;
  }>;
}

interface ProductHealthSource {
  id: string;
  name?: string | null;
  raw_text?: string | null;
  enriched_text?: string | null;
}

interface ProductInstructionRow {
  prevention_tips?: string | null;
  product_id: string;
  usage_instructions?: string | null;
}

interface ProductFactsRow {
  facts_json?: Record<string, unknown> | null;
  product_id: string;
}

function textLength(value: string | null | undefined): number {
  return typeof value === 'string' ? value.trim().length : 0;
}

function countMeaningfulFactFields(facts: Record<string, unknown> | null | undefined): number {
  if (!facts || typeof facts !== 'object') return 0;

  const ignoredKeys = new Set(['schema_version', 'detected_language', 'evidence_quotes']);
  let total = 0;

  for (const [key, value] of Object.entries(facts)) {
    if (ignoredKeys.has(key)) continue;
    if (typeof value === 'string' && value.trim()) total += 1;
    else if (Array.isArray(value) && value.some((item) => typeof item === 'string' ? item.trim() : Boolean(item))) total += 1;
    else if (value && typeof value === 'object' && Object.values(value).some(Boolean)) total += 1;
    else if (typeof value === 'number' || typeof value === 'boolean') total += 1;
  }

  return total;
}

export function scoreProductKnowledgeHealth(input: {
  chunkCount: number;
  enrichedText?: string | null;
  factsJson?: Record<string, unknown> | null;
  preventionTips?: string | null;
  rawText?: string | null;
  usageInstructions?: string | null;
}): ProductKnowledgeHealth {
  const rawTextLength = textLength(input.rawText);
  const enrichedTextLength = textLength(input.enrichedText);
  const usageInstructionLength = textLength(input.usageInstructions);
  const preventionTipsLength = textLength(input.preventionTips);
  const factFieldCount = countMeaningfulFactFields(input.factsJson);
  const chunkCount = Math.max(0, input.chunkCount || 0);

  let score = 0;
  const missingReasonCodes: KnowledgeReasonCode[] = [];

  if (rawTextLength >= 500) score += 20;
  else if (rawTextLength > 0) score += 10;
  else missingReasonCodes.push('missing_scraped_content');

  if (enrichedTextLength >= 300) score += 10;
  else if (enrichedTextLength > 0) score += 5;
  else missingReasonCodes.push('missing_enriched_content');

  if (usageInstructionLength >= 240) score += 25;
  else if (usageInstructionLength >= 80) {
    score += 15;
    missingReasonCodes.push('thin_usage_instructions');
  } else if (usageInstructionLength > 0) {
    score += 8;
    missingReasonCodes.push('thin_usage_instructions');
  } else {
    missingReasonCodes.push('missing_usage_instructions');
  }

  if (preventionTipsLength >= 120) score += 10;
  else if (preventionTipsLength > 0) score += 5;
  else missingReasonCodes.push('missing_return_tips');

  if (factFieldCount >= 5) score += 20;
  else if (factFieldCount >= 2) score += 12;
  else if (factFieldCount > 0) score += 6;
  else missingReasonCodes.push('missing_facts');

  if (chunkCount > 0) score += 15;
  else missingReasonCodes.push('missing_embeddings');

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const coverage: ProductKnowledgeHealth['coverage'] =
    boundedScore >= 80 ? 'strong' : boundedScore >= 55 ? 'moderate' : 'weak';
  const answerRisk: ProductKnowledgeHealth['answerRisk'] =
    boundedScore >= 75 ? 'low' : boundedScore >= 45 ? 'medium' : 'high';

  return {
    score: boundedScore,
    coverage,
    answerRisk,
    missingReasonCodes,
    metrics: {
      chunkCount,
      factFieldCount,
      hasEnrichedText: enrichedTextLength > 0,
      hasFacts: factFieldCount > 0,
      hasPreventionTips: preventionTipsLength > 0,
      hasRawText: rawTextLength > 0,
      usageInstructionLength,
    },
  };
}

export async function buildProductKnowledgeHealthMap(
  serviceClient: any,
  merchantId: string,
  products: ProductHealthSource[],
): Promise<Map<string, ProductKnowledgeHealth>> {
  const productIds = products.map((product) => product.id);
  const emptyMap = new Map<string, ProductKnowledgeHealth>();

  if (productIds.length === 0) return emptyMap;

  const [{ data: instructions }, { data: facts }, { data: chunkRows }] = await Promise.all([
    serviceClient
      .from('product_instructions')
      .select('product_id, usage_instructions, prevention_tips')
      .eq('merchant_id', merchantId)
      .in('product_id', productIds),
    serviceClient
      .from('product_facts')
      .select('product_id, facts_json')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .in('product_id', productIds),
    serviceClient
      .from('knowledge_chunks')
      .select('product_id')
      .in('product_id', productIds),
  ]);

  const instructionMap = new Map<string, ProductInstructionRow>();
  for (const row of (instructions || []) as ProductInstructionRow[]) {
    instructionMap.set(row.product_id, row);
  }

  const factsMap = new Map<string, ProductFactsRow>();
  for (const row of (facts || []) as ProductFactsRow[]) {
    factsMap.set(row.product_id, row);
  }

  const chunkCountMap = new Map<string, number>();
  for (const row of (chunkRows || []) as Array<{ product_id: string }>) {
    chunkCountMap.set(row.product_id, (chunkCountMap.get(row.product_id) || 0) + 1);
  }

  for (const product of products) {
    const instruction = instructionMap.get(product.id);
    const factsRow = factsMap.get(product.id);
    emptyMap.set(
      product.id,
      scoreProductKnowledgeHealth({
        chunkCount: chunkCountMap.get(product.id) || 0,
        enrichedText: product.enriched_text,
        factsJson: factsRow?.facts_json || undefined,
        preventionTips: instruction?.prevention_tips,
        rawText: product.raw_text,
        usageInstructions: instruction?.usage_instructions,
      }),
    );
  }

  return emptyMap;
}

export function summarizeMerchantKnowledgeHealth(
  products: ProductHealthSource[],
  healthByProductId: Map<string, ProductKnowledgeHealth>,
): MerchantKnowledgeHealthSummary {
  if (products.length === 0) {
    return {
      averageScore: 0,
      strongProducts: 0,
      productsAtRisk: 0,
      weakProducts: 0,
      topMissingReasonCode: null,
      topMissingReasonCount: 0,
      topAtRiskProducts: [],
    };
  }

  const reasonCounts = new Map<KnowledgeReasonCode, number>();
  let totalScore = 0;
  let strongProducts = 0;
  let weakProducts = 0;
  let productsAtRisk = 0;

  const topAtRiskProducts = products
    .map((product) => {
      const health = healthByProductId.get(product.id) || scoreProductKnowledgeHealth({ chunkCount: 0 });
      totalScore += health.score;
      if (health.coverage === 'strong') strongProducts += 1;
      if (health.coverage === 'weak') weakProducts += 1;
      if (health.answerRisk !== 'low') productsAtRisk += 1;
      for (const code of health.missingReasonCodes) {
        reasonCounts.set(code, (reasonCounts.get(code) || 0) + 1);
      }
      return {
        id: product.id,
        name: product.name || 'Product',
        score: health.score,
        answerRisk: health.answerRisk,
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  let topMissingReasonCode: KnowledgeReasonCode | null = null;
  let topMissingReasonCount = 0;
  for (const [code, count] of reasonCounts.entries()) {
    if (count > topMissingReasonCount) {
      topMissingReasonCode = code;
      topMissingReasonCount = count;
    }
  }

  return {
    averageScore: Math.round(totalScore / products.length),
    strongProducts,
    productsAtRisk,
    weakProducts,
    topMissingReasonCode,
    topMissingReasonCount,
    topAtRiskProducts,
  };
}
