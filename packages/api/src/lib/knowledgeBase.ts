/**
 * Knowledge base management
 * Handles product content chunking and embedding storage
 */

import { getSupabaseServiceClient } from '@glowguide/shared';
import { chunkText, generateEmbeddingsBatch, type TextChunk } from './embeddings.js';

export interface ProcessProductResult {
  productId: string;
  chunksCreated: number;
  totalTokens: number;
  success: boolean;
  error?: string;
}

/**
 * Process product content: chunk and generate embeddings
 */
export async function processProductForRAG(
  productId: string,
  rawContent: string
): Promise<ProcessProductResult> {
  const serviceClient = getSupabaseServiceClient();

  try {
    // Validate content
    if (!rawContent || rawContent.trim().length === 0) {
      return {
        productId,
        chunksCreated: 0,
        totalTokens: 0,
        success: false,
        error: 'No content to process',
      };
    }

    // Chunk text
    const chunks = chunkText(rawContent, 1000); // 1000 chars per chunk

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

    // Insert new chunks with embeddings
    const chunksToInsert = chunks.map((chunk, index) => ({
      product_id: productId,
      chunk_text: chunk.text,
      embedding: JSON.stringify(embeddings[index].embedding), // pgvector expects array
      chunk_index: chunk.index,
    }));

    const { error: insertError } = await serviceClient
      .from('knowledge_chunks')
      .insert(chunksToInsert);

    if (insertError) {
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    const totalTokens = embeddings.reduce((sum, e) => sum + e.tokenCount, 0);

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

  // Get products with raw_content
  const { data: products, error } = await serviceClient
    .from('products')
    .select('id, raw_content')
    .in('id', productIds);

  if (error || !products) {
    throw new Error(`Failed to fetch products: ${error?.message}`);
  }

  // Process each product
  const results: ProcessProductResult[] = [];

  for (const product of products) {
    if (!product.raw_content) {
      results.push({
        productId: product.id,
        chunksCreated: 0,
        totalTokens: 0,
        success: false,
        error: 'No raw_content available',
      });
      continue;
    }

    const result = await processProductForRAG(product.id, product.raw_content);
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
