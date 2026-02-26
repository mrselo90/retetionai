/**
 * RAG (Retrieval Augmented Generation) utilities
 * Semantic search over product knowledge base
 */

import { getSupabaseServiceClient } from '@recete/shared';
import { generateEmbedding } from './embeddings.js';
import { getCache, setCache } from './cache.js';
import crypto from 'node:crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(s: string): boolean {
  return typeof s === 'string' && UUID_REGEX.test(s.trim());
}

export interface RAGQueryOptions {
  merchantId: string;
  query: string;
  productIds?: string[]; // Filter by specific products
  topK?: number; // Number of results to return
  similarityThreshold?: number; // Minimum similarity score (0-1)
  preferredSectionTypes?: string[];
  preferredLanguage?: 'tr' | 'en' | 'hu' | string;
  candidateMultiplier?: number;
  diversityRerank?: boolean;
  cacheKey?: string;
  cacheTtlSeconds?: number;
  cacheEmbedding?: boolean;
}

export interface RAGResult {
  chunkId: string;
  productId: string;
  productName: string;
  productUrl: string;
  chunkText: string;
  chunkIndex: number;
  similarity: number;
  sectionType?: string | null;
  languageCode?: string | null;
}

export interface RAGQueryResponse {
  query: string;
  results: RAGResult[];
  totalResults: number;
  executionTime: number;
}

interface OrderScopeResolution {
  productIds: string[];
  chunks: RAGResult[];
  source: 'external_events' | 'merchant_fallback_legacy' | 'none';
}

function normalizeProductNameForMatch(name: string): string {
  return (name || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

/**
 * Perform semantic search over knowledge base
 * Uses pgvector HNSW index via Supabase RPC for fast similarity search
 */
export async function queryKnowledgeBase(
  options: RAGQueryOptions
): Promise<RAGQueryResponse> {
  const startTime = Date.now();
  const {
    merchantId,
    query,
    productIds: rawProductIds,
    topK = 5,
    similarityThreshold = 0.7,
    preferredSectionTypes,
    preferredLanguage,
    candidateMultiplier,
    diversityRerank = true,
    cacheKey,
    cacheTtlSeconds = 900,
    cacheEmbedding = true,
  } = options;

  // Only use product IDs that are valid UUIDs (avoids "invalid input syntax for type uuid" when query is pasted into Product IDs field)
  const productIds =
    rawProductIds && rawProductIds.length > 0
      ? rawProductIds.filter(isValidUUID)
      : undefined;

  if (cacheKey) {
    const cached = await getCache<{ results: RAGResult[]; totalResults: number }>('rag_query_v2', cacheKey);
    if (cached) {
      return {
        query,
        results: cached.results,
        totalResults: cached.totalResults,
        executionTime: Date.now() - startTime,
      };
    }
  }

  let queryEmbedding: number[] | null = null;
  if (cacheEmbedding) {
    const embedKey = crypto.createHash('sha256').update(query).digest('hex');
    const cachedEmbedding = await getCache<number[]>('rag_embed_v1', embedKey);
    if (cachedEmbedding) {
      queryEmbedding = cachedEmbedding;
    }
  }

  if (!queryEmbedding) {
    const embeddingResult = await generateEmbedding(query);
    queryEmbedding = embeddingResult.embedding;
    if (cacheEmbedding) {
      const embedKey = crypto.createHash('sha256').update(query).digest('hex');
      void setCache('rag_embed_v1', embedKey, queryEmbedding, 3600);
    }
  }

  const serviceClient = getSupabaseServiceClient();

  const dbMatchCount = Math.min(
    50,
    Math.max(
      topK,
      topK * (candidateMultiplier ?? ((preferredSectionTypes?.length || preferredLanguage) ? 3 : 1))
    )
  );

  // Use pgvector RPC for DB-side cosine similarity (leverages HNSW index)
  const { data: rows, error } = await serviceClient.rpc('match_knowledge_chunks', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_merchant_id: merchantId,
    match_product_ids: productIds && productIds.length > 0 ? productIds : null,
    match_threshold: similarityThreshold,
    match_count: dbMatchCount,
  });

  if (error) {
    throw new Error(`Failed to query knowledge base: ${error.message}`);
  }

  if (!rows || rows.length === 0) {
    const response = {
      query,
      results: [],
      totalResults: 0,
      executionTime: Date.now() - startTime,
    };
    if (cacheKey) {
      void setCache('rag_query_v2', cacheKey, { results: response.results, totalResults: response.totalResults }, cacheTtlSeconds);
    }
    return response;
  }

  let results: RAGResult[] = (rows as any[]).map((row) => ({
    chunkId: row.id,
    productId: row.product_id,
    productName: row.product_name,
    productUrl: row.product_url,
    chunkText: row.chunk_text,
    chunkIndex: row.chunk_index,
    similarity: row.similarity,
    sectionType: row.section_type ?? null,
    languageCode: row.language_code ?? null,
  }));

  if (preferredSectionTypes?.length || preferredLanguage) {
    const preferredSet = new Set((preferredSectionTypes || []).map((s) => s.toLowerCase()));
    results = results
      .map((r) => {
        let score = r.similarity;
        if (r.sectionType && preferredSet.has(r.sectionType.toLowerCase())) score += 0.08;
        if (preferredLanguage && r.languageCode && r.languageCode.toLowerCase() === preferredLanguage.toLowerCase()) score += 0.03;
        return { ...r, similarity: Math.min(0.999, score) };
      })
      .sort((a, b) => b.similarity - a.similarity);
  } else {
    results = results.sort((a, b) => b.similarity - a.similarity);
  }

  if (diversityRerank && results.length > 1) {
    results = rerankWithDiversity(results, topK);
  } else {
    results = results.slice(0, topK);
  }

  const response = {
    query,
    results,
    totalResults: results.length,
    executionTime: Date.now() - startTime,
  };

  if (cacheKey) {
    void setCache('rag_query_v2', cacheKey, { results: response.results, totalResults: response.totalResults }, cacheTtlSeconds);
  }

  return response;
}

function rerankWithDiversity(results: RAGResult[], topK: number): RAGResult[] {
  const selected: RAGResult[] = [];
  const remaining = [...results].sort((a, b) => b.similarity - a.similarity);

  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const sameProductCount = selected.filter((s) => s.productId === candidate.productId).length;
      const sameSection = candidate.sectionType
        ? selected.some((s) => s.sectionType && s.sectionType === candidate.sectionType)
        : false;

      const productPenalty = Math.min(0.12, sameProductCount * 0.06);
      const sectionPenalty = sameSection ? 0.04 : 0;
      const score = candidate.similarity - productPenalty - sectionPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]);
  }

  return selected;
}

/**
 * Format RAG results for LLM context
 */
export function formatRAGResultsForLLM(results: RAGResult[]): string {
  if (results.length === 0) {
    return 'No relevant product information found.';
  }

  const formatted = results
    .map((result, index) => {
      const section = result.sectionType ? `Section: ${result.sectionType}` : '';
      const url = result.productUrl ? `Source: ${result.productUrl}` : '';
      const metaLines = [section, url].filter(Boolean).join('\n');
      return `[${index + 1}] ${result.productName}
${metaLines ? `${metaLines}\n` : ''}${result.chunkText}
Similarity: ${(result.similarity * 100).toFixed(1)}%`;
    })
    .join('\n\n---\n\n');

  return `Relevant Product Information:\n\n${formatted}`;
}

/**
 * Get product context for a user's order
 * Retrieves all chunks for products in the order
 */
export async function getOrderProductContext(
  orderId: string,
  merchantId: string
): Promise<RAGResult[]> {
  const result = await getOrderProductContextResolved(orderId, merchantId);
  return result.chunks;
}

/**
 * Best-effort order-scoped product resolution.
 * Resolves products from external_events.payload.items[*].external_product_id when available.
 * Returns empty scope (instead of all merchant products) when order items cannot be resolved.
 */
export async function getOrderProductContextResolved(
  orderId: string,
  merchantId: string
): Promise<OrderScopeResolution> {
  const serviceClient = getSupabaseServiceClient();

  // Get order with products (from orders table, we need to join with items)
  // For MVP, we'll assume products are linked via external_product_id
  // This is a simplified version - in production, you'd have an order_items table

  const { data: order, error: orderError } = await serviceClient
    .from('orders')
    .select('id, merchant_id, user_id, external_order_id')
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .single();

  if (orderError || !order) {
    throw new Error('Order not found');
  }

  // Try to resolve product IDs from normalized event payload items
  let resolvedProductIds: string[] = [];
  try {
    const { data: events } = await serviceClient
      .from('external_events')
      .select('payload, received_at')
      .eq('merchant_id', order.merchant_id)
      .contains('payload', { external_order_id: (order as any).external_order_id })
      .order('received_at', { ascending: false })
      .limit(5);

    const eventItems = (events || []).flatMap((e: any) =>
      Array.isArray(e?.payload?.items) ? e.payload.items : []
    );

    const externalProductIds = Array.from(
      new Set(
        eventItems
          .map((i: any) => (typeof i?.external_product_id === 'string' ? i.external_product_id.trim() : ''))
          .filter(Boolean)
      )
    );

    if (externalProductIds.length > 0) {
      const { data: products } = await serviceClient
        .from('products')
        .select('id, external_id')
        .eq('merchant_id', order.merchant_id)
        .in('external_id', externalProductIds);

      resolvedProductIds = Array.from(new Set((products || []).map((p: any) => p.id)));
    }

    // Fallback for manual / CSV orders where external_product_id may be missing or not mapped.
    if (resolvedProductIds.length === 0) {
      const eventItemNames = Array.from(
        new Set(
          eventItems
            .map((i: any) => (typeof i?.name === 'string' ? i.name.trim() : ''))
            .filter(Boolean)
        )
      );

      if (eventItemNames.length > 0) {
        const { data: merchantProducts } = await serviceClient
          .from('products')
          .select('id, name')
          .eq('merchant_id', order.merchant_id)
          .limit(5000);

        const requestedNames = new Set(eventItemNames.map(normalizeProductNameForMatch));
        resolvedProductIds = Array.from(
          new Set(
            (merchantProducts || [])
              .filter((p: any) => requestedNames.has(normalizeProductNameForMatch(String(p?.name || ''))))
              .map((p: any) => p.id)
          )
        );
      }
    }
  } catch {
    // Best-effort only. We'll return no scope rather than broadening incorrectly.
    resolvedProductIds = [];
  }

  if (resolvedProductIds.length === 0) {
    return { productIds: [], chunks: [], source: 'none' };
  }

  const { data: chunks, error: chunksError } = await serviceClient
    .from('knowledge_chunks')
    .select(
      `
      id,
      product_id,
      chunk_text,
      chunk_index,
      products!inner (
        id,
        name,
        url,
        merchant_id
      )
    `
    )
    .eq('products.merchant_id', order.merchant_id)
    .in('product_id', resolvedProductIds)
    .order('chunk_index', { ascending: true });

  if (chunksError) {
    throw new Error(`Failed to get product context: ${chunksError.message}`);
  }

  if (!chunks || chunks.length === 0) {
    return { productIds: resolvedProductIds, chunks: [], source: 'external_events' };
  }

  const mapped = chunks.map((chunk: any) => ({
    chunkId: chunk.id,
    productId: chunk.product_id,
    productName: chunk.products.name,
    productUrl: chunk.products.url,
    chunkText: chunk.chunk_text,
    chunkIndex: chunk.chunk_index,
    similarity: 1.0, // Not calculated for full context retrieval
  }));

  return { productIds: resolvedProductIds, chunks: mapped, source: 'external_events' };
}
