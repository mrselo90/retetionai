import crypto from 'node:crypto';
import { getSupabaseServiceClient, logger } from '@recete/shared';
import { getCache, setCache } from './cache.js';
import { generateEmbedding } from './embeddings.js';
import { type RAGResult } from './rag.js';
import { ShopSettingsService } from './multiLangRag/shopSettingsService.js';
import { TranslationService } from './multiLangRag/translationService.js';
import { normalizeLangCode } from './multiLangRag/utils.js';
import { getMultiLangRagFlags } from './multiLangRag/config.js';

export interface UnifiedRetrievalInput {
  merchantId: string;
  question: string;
  userLang: string;
  productIds?: string[];
  topK?: number;
  similarityThreshold?: number;
  preferredSectionTypes?: string[];
  cacheKey?: string;
  cacheTtlSeconds?: number;
}

export interface UnifiedRetrievalOutput {
  query: string;
  results: RAGResult[];
  totalResults: number;
  executionTime: number;
  effectiveLanguage: string;
  usedFallback: boolean;
  fallbackLanguage: string | null;
}

function normalizeTextForMatch(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeForMatch(value: string): string[] {
  return normalizeTextForMatch(value)
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function maxSimilarity(results: RAGResult[]): number {
  return results.reduce((max, row) => Math.max(max, Number(row.similarity || 0)), 0);
}

function rerankResults(options: {
  question: string;
  results: RAGResult[];
  preferredSectionTypes?: string[];
  topK: number;
}): RAGResult[] {
  const { question, results, preferredSectionTypes, topK } = options;
  const preferredSet = new Set((preferredSectionTypes || []).map((section) => section.toLowerCase()));
  const queryTokens = new Set(tokenizeForMatch(question));
  const perProductSeen = new Map<string, number>();

  const ranked = results
    .map((result) => {
      let score = Number(result.similarity || 0);
      const productTokens = tokenizeForMatch(result.productName || '');
      const overlapCount = productTokens.filter((token) => queryTokens.has(token)).length;

      if (preferredSet.size > 0 && result.sectionType && preferredSet.has(result.sectionType.toLowerCase())) {
        score += 0.08;
      }

      if (productTokens.length > 0 && overlapCount > 0) {
        score += Math.min(0.07, overlapCount * 0.03);
      }

      const priorCount = perProductSeen.get(result.productId) || 0;
      perProductSeen.set(result.productId, priorCount + 1);
      if (priorCount > 0) {
        score -= Math.min(0.04, priorCount * 0.02);
      }

      return {
        result,
        score,
      };
    })
    .sort((a, b) => b.score - a.score || Number(b.result.similarity || 0) - Number(a.result.similarity || 0))
    .map((entry) => entry.result);

  return ranked.slice(0, topK);
}

async function getQueryEmbedding(query: string): Promise<number[]> {
  const embedKey = crypto.createHash('sha256').update(query).digest('hex');
  const cachedEmbedding = await getCache<number[]>('rag_embed_v1', embedKey);
  if (cachedEmbedding) {
    return cachedEmbedding;
  }

  const embeddingResult = await generateEmbedding(query);
  void setCache('rag_embed_v1', embedKey, embeddingResult.embedding, 3600);
  return embeddingResult.embedding;
}

async function getProductPresentationMap(
  merchantId: string,
  productIds: string[],
): Promise<Map<string, { name: string; url: string }>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const serviceClient = getSupabaseServiceClient();
  const { data: products, error } = await serviceClient
    .from('products')
    .select('id, name, url')
    .eq('merchant_id', merchantId)
    .in('id', productIds);

  if (error || !products) {
    throw new Error(`Failed to load product presentation for multilingual chunk retrieval: ${error?.message || 'unknown error'}`);
  }

  return new Map(
    products.map((product: any) => [
      product.id,
      {
        name: String(product.name || 'Product'),
        url: String(product.url || ''),
      },
    ]),
  );
}

async function queryLegacyKnowledgeBase(options: {
  merchantId: string;
  queryEmbedding: number[];
  productIds?: string[];
  topK: number;
  similarityThreshold: number;
}): Promise<RAGResult[]> {
  const { merchantId, queryEmbedding, productIds, topK, similarityThreshold } = options;
  const serviceClient = getSupabaseServiceClient();
  const scopedProductIds =
    Array.isArray(productIds) && productIds.length > 0 ? [...new Set(productIds)] : null;

  const { data: rows, error } = await serviceClient.rpc('match_knowledge_chunks', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_merchant_id: merchantId,
    match_product_ids: scopedProductIds,
    match_threshold: similarityThreshold,
    match_count: topK,
  });

  if (error) {
    logger.warn({ error: error.message, merchantId }, 'Legacy knowledge_chunks fallback RPC failed');
    return [];
  }

  return (Array.isArray(rows) ? rows : []).map((row: any) => ({
    chunkId: String(row.id),
    productId: String(row.product_id),
    productName: String(row.product_name || 'Product'),
    productUrl: String(row.product_url || ''),
    chunkText: String(row.chunk_text || ''),
    chunkIndex: Number(row.chunk_index || 0),
    similarity: Number(row.similarity || 0),
    sectionType: null,
    languageCode: null,
  }));
}

async function queryKnowledgeBaseI18n(options: UnifiedRetrievalInput & { languageCode: string }): Promise<{
  query: string;
  results: RAGResult[];
  totalResults: number;
  executionTime: number;
}> {
  const startTime = Date.now();
  const {
    merchantId,
    question,
    productIds,
    topK = 5,
    similarityThreshold = 0.6,
    preferredSectionTypes,
    cacheKey,
    cacheTtlSeconds = 900,
    languageCode,
  } = options;

  const normalizedLanguage = normalizeLangCode(languageCode);
  const scopedProductIds =
    Array.isArray(productIds) && productIds.length > 0 ? [...new Set(productIds)] : undefined;
  const effectiveCacheKey = cacheKey ? `${cacheKey}:i18n:${normalizedLanguage}` : undefined;

  if (effectiveCacheKey) {
    const cached = await getCache<{ results: RAGResult[]; totalResults: number }>('rag_query_i18n_v1', effectiveCacheKey);
    if (cached) {
      return {
        query: question,
        results: cached.results,
        totalResults: cached.totalResults,
        executionTime: Date.now() - startTime,
      };
    }
  }

  const queryEmbedding = await getQueryEmbedding(question);
  const serviceClient = getSupabaseServiceClient();
  const flags = getMultiLangRagFlags();
  const dbMatchCount = Math.min(50, Math.max(topK, topK * ((preferredSectionTypes?.length || normalizedLanguage) ? 3 : 1)));
  const { data: rows, error } = await serviceClient.rpc('match_knowledge_chunks_i18n', {
    p_shop_id: merchantId,
    p_language_code: normalizedLanguage,
    p_query_embedding: JSON.stringify(queryEmbedding),
    p_product_ids: scopedProductIds && scopedProductIds.length > 0 ? scopedProductIds : null,
    p_chunk_types: preferredSectionTypes && preferredSectionTypes.length > 0 ? preferredSectionTypes : null,
    p_source_types: null,
    p_match_threshold: similarityThreshold,
    p_match_count: dbMatchCount,
    p_embedding_model: flags.embeddingModel,
  });

  if (error) {
    logger.warn({ error: error.message, merchantId }, 'i18n chunk index query failed, trying legacy fallback');
    const legacyResults = await queryLegacyKnowledgeBase({
      merchantId, queryEmbedding, productIds, topK, similarityThreshold,
    });
    return {
      query: question,
      results: legacyResults,
      totalResults: legacyResults.length,
      executionTime: Date.now() - startTime,
    };
  }

  const rawRows = Array.isArray(rows) ? rows as any[] : [];
  if (rawRows.length === 0) {
    const legacyResults = await queryLegacyKnowledgeBase({
      merchantId, queryEmbedding, productIds, topK, similarityThreshold,
    });
    if (legacyResults.length > 0) {
      logger.info({ merchantId, topK }, 'i18n chunks empty, served from legacy knowledge_chunks');
      return {
        query: question,
        results: legacyResults,
        totalResults: legacyResults.length,
        executionTime: Date.now() - startTime,
      };
    }

    const response = {
      query: question,
      results: [],
      totalResults: 0,
      executionTime: Date.now() - startTime,
    };
    if (effectiveCacheKey) {
      void setCache('rag_query_i18n_v1', effectiveCacheKey, { results: response.results, totalResults: response.totalResults }, cacheTtlSeconds);
    }
    return response;
  }

  const presentationMap = await getProductPresentationMap(
    merchantId,
    [...new Set(rawRows.map((row) => String(row.product_id)).filter(Boolean))],
  );

  let results: RAGResult[] = rawRows.map((row) => {
    const productId = String(row.product_id);
    const meta = presentationMap.get(productId);
    return {
      chunkId: String(row.id),
      productId,
      productName: meta?.name || 'Product',
      productUrl: meta?.url || '',
      chunkText: String(row.chunk_text || ''),
      chunkIndex: Number(row.chunk_index || 0),
      similarity: Number(row.similarity || 0),
      sectionType: row.chunk_type ?? row.section_type ?? null,
      languageCode: row.language_code ?? normalizedLanguage,
    };
  });

  results = rerankResults({
    question,
    results,
    preferredSectionTypes,
    topK,
  });

  const response = {
    query: question,
    results,
    totalResults: results.length,
    executionTime: Date.now() - startTime,
  };

  if (effectiveCacheKey) {
    void setCache('rag_query_i18n_v1', effectiveCacheKey, { results: response.results, totalResults: response.totalResults }, cacheTtlSeconds);
  }

  return response;
}

export class UnifiedRetrievalService {
  constructor(
    private shopSettingsService = new ShopSettingsService(),
    private translationService = new TranslationService(),
  ) {}

  async retrieve(input: UnifiedRetrievalInput): Promise<UnifiedRetrievalOutput> {
    const userLang = normalizeLangCode(input.userLang);
    const settings = await this.shopSettingsService.getOrCreate(input.merchantId, input.question);
    const serviceLanguages = [...new Set(
      (settings.enabled_langs || []).map((lang) => normalizeLangCode(lang)).filter(Boolean),
    )];
    const replyLanguages =
      serviceLanguages.length > 0
        ? serviceLanguages
        : ['en'];
    const primaryLanguage = replyLanguages.includes(userLang) ? userLang : replyLanguages[0];
    const readPrimary = async (language: string, query: string, cacheKey?: string) =>
      queryKnowledgeBaseI18n({
        ...input,
        question: query,
        userLang: language,
        cacheKey,
        languageCode: language,
      });

    const primaryQuestion =
      primaryLanguage === userLang
        ? input.question
        : await this.translationService.translateText(
            input.question,
            userLang,
            primaryLanguage,
            {
              merchantId: input.merchantId,
              feature: 'unified_retrieval_service_language_translation',
              metadata: {
                stage: 'service_language_entry',
                original_lang: userLang,
                service_lang: primaryLanguage,
              },
            },
          );
    const primary = await readPrimary(primaryLanguage, primaryQuestion, input.cacheKey);
    const fallbackLanguage = replyLanguages.find((language) => language !== primaryLanguage) || null;
    const shouldTryFallback =
      Boolean(fallbackLanguage)
      && (
        primary.results.length === 0
        || maxSimilarity(primary.results) < Math.max(0.55, (input.similarityThreshold || 0.6) - 0.05)
      );

    if (!shouldTryFallback) {
      return {
        ...primary,
        effectiveLanguage: primaryLanguage,
        usedFallback: primaryLanguage !== userLang,
        fallbackLanguage: primaryLanguage !== userLang ? primaryLanguage : null,
      };
    }

    let translatedQuestion: string;
    try {
      translatedQuestion = await this.translationService.translateText(
        input.question,
        userLang,
        fallbackLanguage as string,
        {
          merchantId: input.merchantId,
          feature: 'unified_retrieval_query_fallback',
          metadata: {
            stage: 'query_fallback',
            original_lang: userLang,
            fallback_lang: fallbackLanguage,
          },
        },
      );
    } catch (translationError) {
      logger.warn(
        { error: translationError instanceof Error ? translationError.message : 'unknown', merchantId: input.merchantId },
        'Translation fallback failed, returning primary-language results',
      );
      return {
        ...primary,
        effectiveLanguage: primaryLanguage,
        usedFallback: primaryLanguage !== userLang,
        fallbackLanguage: primaryLanguage !== userLang ? primaryLanguage : null,
      };
    }

    const fallback = await readPrimary(
      fallbackLanguage as string,
      translatedQuestion,
      input.cacheKey ? `${input.cacheKey}:fallback:${fallbackLanguage}` : undefined,
    );

    if (fallback.results.length === 0 || maxSimilarity(fallback.results) < maxSimilarity(primary.results)) {
      return {
        ...primary,
        effectiveLanguage: primaryLanguage,
        usedFallback: primaryLanguage !== userLang,
        fallbackLanguage: primaryLanguage !== userLang ? primaryLanguage : null,
      };
    }

    return {
      ...fallback,
      effectiveLanguage: fallbackLanguage as string,
      usedFallback: true,
      fallbackLanguage: fallbackLanguage as string,
    };
  }
}
