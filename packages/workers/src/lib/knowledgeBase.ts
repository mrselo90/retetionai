/**
 * Knowledge base management (RAG preparation)
 * Copied from API package to avoid cross-package source imports.
 */

import { getSupabaseServiceClient } from '@glowguide/shared';
import { chunkText, generateEmbeddingsBatch } from './embeddings.js';

export interface ProcessProductResult {
  productId: string;
  chunksCreated: number;
  totalTokens: number;
  success: boolean;
  error?: string;
}

export async function processProductForRAG(
  productId: string,
  rawContent: string
): Promise<ProcessProductResult> {
  const serviceClient = getSupabaseServiceClient();

  try {
    if (!rawContent || rawContent.trim().length === 0) {
      return {
        productId,
        chunksCreated: 0,
        totalTokens: 0,
        success: false,
        error: 'No content to process',
      };
    }

    const chunks = chunkText(rawContent, 1000);

    if (chunks.length === 0) {
      return {
        productId,
        chunksCreated: 0,
        totalTokens: 0,
        success: false,
        error: 'No chunks generated',
      };
    }

    const embeddings = await generateEmbeddingsBatch(chunks);

    await serviceClient.from('knowledge_chunks').delete().eq('product_id', productId);

    const chunksToInsert = chunks.map((chunk, index) => ({
      product_id: productId,
      chunk_text: chunk.text,
      embedding: JSON.stringify(embeddings[index].embedding),
      chunk_index: chunk.index,
    }));

    const { error: insertError } = await serviceClient.from('knowledge_chunks').insert(chunksToInsert);

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
    return {
      productId,
      chunksCreated: 0,
      totalTokens: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

