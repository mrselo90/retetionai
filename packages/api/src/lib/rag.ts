/**
 * RAG (Retrieval Augmented Generation) utilities
 * Semantic search over product knowledge base
 */

import { getSupabaseServiceClient } from '@glowguide/shared';
import { generateEmbedding } from './embeddings.js';

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
}

export interface RAGResult {
  chunkId: string;
  productId: string;
  productName: string;
  productUrl: string;
  chunkText: string;
  chunkIndex: number;
  similarity: number;
}

export interface RAGQueryResponse {
  query: string;
  results: RAGResult[];
  totalResults: number;
  executionTime: number;
}

/**
 * Perform semantic search over knowledge base
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
  } = options;

  // Only use product IDs that are valid UUIDs (avoids "invalid input syntax for type uuid" when query is pasted into Product IDs field)
  const productIds =
    rawProductIds && rawProductIds.length > 0
      ? rawProductIds.filter(isValidUUID)
      : undefined;

  // Generate embedding for query
  const { embedding: queryEmbedding } = await generateEmbedding(query);

  // Build SQL query for vector similarity search
  const serviceClient = getSupabaseServiceClient();

  // pgvector cosine similarity: 1 - (embedding <=> query_embedding)
  // We use the <=> operator for cosine distance, then convert to similarity
  let sqlQuery = serviceClient
    .from('knowledge_chunks')
    .select(
      `
      id,
      product_id,
      chunk_text,
      chunk_index,
      embedding,
      products!inner (
        id,
        name,
        url,
        merchant_id
      )
    `
    )
    .eq('products.merchant_id', merchantId);

  // Filter by product IDs if specified (only valid UUIDs)
  if (productIds && productIds.length > 0) {
    sqlQuery = sqlQuery.in('product_id', productIds);
  }

  // Execute query
  const { data: chunks, error } = await sqlQuery;

  if (error) {
    throw new Error(`Failed to query knowledge base: ${error.message}`);
  }

  if (!chunks || chunks.length === 0) {
    return {
      query,
      results: [],
      totalResults: 0,
      executionTime: Date.now() - startTime,
    };
  }

  // Calculate cosine similarity for each chunk
  // Note: Supabase doesn't support vector operations in the query directly,
  // so we calculate similarity in-memory
  const results: RAGResult[] = chunks
    .map((chunk: any) => {
      // Parse embedding (stored as JSON string)
      let chunkEmbedding: number[];
      try {
        chunkEmbedding =
          typeof chunk.embedding === 'string'
            ? JSON.parse(chunk.embedding)
            : chunk.embedding;
      } catch {
        return null;
      }

      // Calculate cosine similarity
      const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);

      return {
        chunkId: chunk.id,
        productId: chunk.product_id,
        productName: chunk.products.name,
        productUrl: chunk.products.url,
        chunkText: chunk.chunk_text,
        chunkIndex: chunk.chunk_index,
        similarity,
      };
    })
    .filter((result): result is RAGResult => result !== null)
    .filter((result) => result.similarity >= similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return {
    query,
    results,
    totalResults: results.length,
    executionTime: Date.now() - startTime,
  };
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
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
      return `[${index + 1}] ${result.productName}
${result.chunkText}
(Relevance: ${(result.similarity * 100).toFixed(1)}%)`;
    })
    .join('\n\n---\n\n');

  return `Relevant Product Information:\n\n${formatted}`;
}

/**
 * Get product context for a user's order
 * Retrieves all chunks for products in the order
 */
export async function getOrderProductContext(
  orderId: string
): Promise<RAGResult[]> {
  const serviceClient = getSupabaseServiceClient();

  // Get order with products (from orders table, we need to join with items)
  // For MVP, we'll assume products are linked via external_product_id
  // This is a simplified version - in production, you'd have an order_items table

  const { data: order, error: orderError } = await serviceClient
    .from('orders')
    .select('id, merchant_id, user_id')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new Error('Order not found');
  }

  // Get all products for this merchant
  // In production, filter by products in the order
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
    .order('chunk_index', { ascending: true });

  if (chunksError) {
    throw new Error(`Failed to get product context: ${chunksError.message}`);
  }

  if (!chunks || chunks.length === 0) {
    return [];
  }

  return chunks.map((chunk: any) => ({
    chunkId: chunk.id,
    productId: chunk.product_id,
    productName: chunk.products.name,
    productUrl: chunk.products.url,
    chunkText: chunk.chunk_text,
    chunkIndex: chunk.chunk_index,
    similarity: 1.0, // Not calculated for full context retrieval
  }));
}
