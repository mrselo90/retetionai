/**
 * Knowledge base management (RAG preparation)
 * Copied from API package to avoid cross-package source imports.
 */

import { getSupabaseServiceClient } from '@recete/shared';
import { chunkText, generateEmbeddingsBatch } from './embeddings.js';
import crypto from 'node:crypto';

export interface ProcessProductResult {
  productId: string;
  chunksCreated: number;
  totalTokens: number;
  success: boolean;
  error?: string;
}

function chunkTextForRAG(text: string, maxChunkSize: number, overlap: number) {
  if (!text.includes('[SECTION:')) return chunkText(text, maxChunkSize, overlap);

  const sections = text
    .split(/\n(?=\[SECTION:)/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const allChunks: Array<{ text: string; index: number }> = [];
  let index = 0;
  for (const section of sections) {
    for (const chunk of chunkText(section, maxChunkSize, overlap)) {
      allChunks.push({ ...chunk, index });
      index++;
    }
  }
  return allChunks;
}

function detectChunkLanguage(textToProcess: string): string | null {
  const m = textToProcess.match(/\[LANG:([a-z]{2})\]/i);
  if (!m || typeof m.index !== 'number') return null;
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

export async function processProductForRAG(
  productId: string,
  rawContent: string
): Promise<ProcessProductResult> {
  const serviceClient = getSupabaseServiceClient();

  try {
    const chunkLanguage = detectChunkLanguage(rawContent);
    const sourceKind = rawContent.includes('[SECTION:') ? 'enriched_text' : 'raw_text';
    if (!rawContent || rawContent.trim().length === 0) {
      return {
        productId,
        chunksCreated: 0,
        totalTokens: 0,
        success: false,
        error: 'No content to process',
      };
    }

    const chunks = chunkTextForRAG(rawContent, 1000, 150);

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
      chunk_text: stripRAGMarkers(chunk.text),
      embedding: JSON.stringify(embeddings[index].embedding),
      chunk_index: chunk.index,
      section_type: inferSectionType(chunk.text),
      language_code: chunkLanguage,
      source_kind: sourceKind,
      chunk_hash: crypto.createHash('sha256').update(chunk.text).digest('hex'),
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
