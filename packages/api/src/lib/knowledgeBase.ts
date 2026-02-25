/**
 * Knowledge base management
 * Handles product content chunking and embedding storage
 */

import { getSupabaseServiceClient } from '@recete/shared';
import { chunkText, generateEmbeddingsBatch, type TextChunk } from './embeddings.js';
import crypto from 'node:crypto';
import { trackAiUsageEvent } from './aiUsageEvents.js';

export interface ProcessProductResult {
  productId: string;
  chunksCreated: number;
  totalTokens: number;
  success: boolean;
  error?: string;
}

function chunkTextForRAG(text: string, maxChunkSize: number, overlap: number): TextChunk[] {
  // If enrichment created explicit section markers, chunk per section first to preserve topicality.
  if (!text.includes('[SECTION:')) {
    return chunkText(text, maxChunkSize, overlap);
  }

  const sections = text
    .split(/\n(?=\[SECTION:)/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const allChunks: TextChunk[] = [];
  let index = 0;

  for (const section of sections) {
    const sectionChunks = chunkText(section, maxChunkSize, overlap);
    for (const c of sectionChunks) {
      allChunks.push({ ...c, index });
      index++;
    }
  }

  return allChunks;
}

function detectChunkLanguage(textToProcess: string): string | null {
  const m = textToProcess.match(/\[LANG:([a-z]{2})\]/i);
  if (!m || typeof m.index !== 'number') return null;
  // Only trust explicit lang markers near the start to avoid false positives.
  if (m.index > 200) return null;
  return m[1]?.toLowerCase() ?? null;
}

function inferSectionType(chunkText: string): string {
  const sectionMatch = chunkText.match(/\[SECTION:([A-Z_]+)\]/i);
  if (sectionMatch?.[1]) return sectionMatch[1].toLowerCase();

  const lower = chunkText.toLowerCase();
  if (/\b(ingredients|inci|összetev|hatóanyag|içerik)\b/.test(lower)) return 'ingredients';
  if (/\b(usage|how to use|directions|kullanım|használat|alkalmaz)\b/.test(lower)) return 'usage';
  if (/\b(warning|caution|uyarı|dikkat|figyelmezt)\b/.test(lower)) return 'warnings';
  if (/\b(spf|ph|\bml\b|\bg\b|volume)\b/.test(lower)) return 'specs';
  return 'general';
}

function stripRAGMarkers(text: string): string {
  return text
    .replace(/\[LANG:[a-z]{2}\]\s*/gi, '')
    .replace(/\[PRODUCT_FACTS\]\s*/gi, '')
    .trim();
}

/**
 * Process product content: chunk and generate embeddings
 */
export async function processProductForRAG(
  productId: string,
  rawContent: string,
  enrichedText?: string
): Promise<ProcessProductResult> {
  const serviceClient = getSupabaseServiceClient();

  try {
    // Fetch product name for chunk prefix (improves retrieval relevance)
    const { data: productRow } = await serviceClient
      .from('products')
      .select('name, merchant_id')
      .eq('id', productId)
      .single();
    const productName = productRow?.name || '';
    const merchantId = (productRow as any)?.merchant_id as string | undefined;

    const textToProcess = enrichedText && enrichedText.trim().length > 0 ? enrichedText : rawContent;
    const chunkLanguage = detectChunkLanguage(textToProcess);
    const sourceKind = enrichedText && enrichedText.trim().length > 0 ? 'enriched_text' : 'raw_text';

    // Validate content
    if (!textToProcess || textToProcess.trim().length === 0) {
      return {
        productId,
        chunksCreated: 0,
        totalTokens: 0,
        success: false,
        error: 'No content to process',
      };
    }

    // Chunk text (with 15% overlap for context continuity)
    const chunks = chunkTextForRAG(textToProcess, 1000, 150); // 1000 chars per chunk, 150 overlap

    if (chunks.length === 0) {
      return {
        productId,
        chunksCreated: 0,
        totalTokens: 0,
        success: false,
        error: 'No chunks generated',
      };
    }

    // Generate embeddings (batch)
    const embeddings = await generateEmbeddingsBatch(chunks);

    // Delete existing chunks for this product
    await serviceClient
      .from('knowledge_chunks')
      .delete()
      .eq('product_id', productId);

    // Insert new chunks with embeddings (prefix each chunk with product name for better retrieval)
    const chunksToInsert = chunks.map((chunk, index) => ({
      product_id: productId,
      chunk_text: productName ? `[${productName}] ${stripRAGMarkers(chunk.text)}` : stripRAGMarkers(chunk.text),
      embedding: JSON.stringify(embeddings[index].embedding), // pgvector expects array
      chunk_index: chunk.index,
      section_type: inferSectionType(chunk.text),
      language_code: chunkLanguage,
      source_kind: sourceKind,
      chunk_hash: crypto.createHash('sha256').update(chunk.text).digest('hex'),
    }));

    const { error: insertError } = await serviceClient
      .from('knowledge_chunks')
      .insert(chunksToInsert);

    if (insertError) {
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    const totalTokens = embeddings.reduce((sum, e) => sum + e.tokenCount, 0);
    if (merchantId) {
      void trackAiUsageEvent({
        merchantId,
        feature: 'product_embeddings_rag',
        model: 'text-embedding-3-small',
        requestKind: 'embedding',
        totalTokens,
        metadata: { productId, chunksCreated: chunks.length },
      });
    }

    return {
      productId,
      chunksCreated: chunks.length,
      totalTokens,
      success: true,
    };
  } catch (error) {
    console.error(`Error processing product ${productId}:`, error);
    return {
      productId,
      chunksCreated: 0,
      totalTokens: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch process multiple products
 */
export async function batchProcessProducts(
  productIds: string[]
): Promise<ProcessProductResult[]> {
  const serviceClient = getSupabaseServiceClient();

  // Get products with raw_text and enriched_text
  const { data: products, error } = await serviceClient
    .from('products')
    .select('id, raw_text, enriched_text')
    .in('id', productIds);

  if (error || !products) {
    throw new Error(`Failed to fetch products: ${error?.message}`);
  }

  // Process each product
  const results: ProcessProductResult[] = [];

  for (const product of products) {
    if (!product.raw_text && !product.enriched_text) {
      results.push({
        productId: product.id,
        chunksCreated: 0,
        totalTokens: 0,
        success: false,
        error: 'No raw_text or enriched_text available',
      });
      continue;
    }

    const result = await processProductForRAG(
      product.id,
      product.raw_text || '',
      product.enriched_text || undefined
    );
    results.push(result);

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Get chunk count for a product
 */
export async function getProductChunkCount(productId: string): Promise<number> {
  const serviceClient = getSupabaseServiceClient();

  const { count, error } = await serviceClient
    .from('knowledge_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('product_id', productId);

  if (error) {
    throw new Error(`Failed to count chunks: ${error.message}`);
  }

  return count || 0;
}

/**
 * Delete all chunks for a product
 */
export async function deleteProductChunks(productId: string): Promise<void> {
  const serviceClient = getSupabaseServiceClient();

  const { error } = await serviceClient
    .from('knowledge_chunks')
    .delete()
    .eq('product_id', productId);

  if (error) {
    throw new Error(`Failed to delete chunks: ${error.message}`);
  }
}
