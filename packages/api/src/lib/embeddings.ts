/**
 * Embedding generation utilities
 * Uses OpenAI API to generate embeddings for text chunks
 */

import { getOpenAIClient } from './openaiClient.js';

// Model configuration
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensions, cost-effective
const MAX_TOKENS_PER_CHUNK = 8000; // OpenAI limit is 8191 tokens

export interface TextChunk {
  text: string;
  index: number;
  tokenCount?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

/**
 * Generate embedding for a single text chunk
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      encoding_format: 'float',
    });

    return {
      embedding: response.data[0].embedding,
      tokenCount: response.usage.total_tokens,
    };
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate embeddings for multiple text chunks (batch)
 */
export async function generateEmbeddingsBatch(
  chunks: TextChunk[]
): Promise<EmbeddingResult[]> {
  try {
    const openai = getOpenAIClient();
    // OpenAI supports batch embedding (up to 2048 inputs)
    const texts = chunks.map((c) => c.text);

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      encoding_format: 'float',
    });

    return response.data.map((item, index) => ({
      embedding: item.embedding,
      tokenCount: response.usage.total_tokens / texts.length, // Approximate per chunk
    }));
  } catch (error) {
    console.error('Error generating embeddings batch:', error);
    throw new Error(
      `Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Chunk text into smaller pieces for embedding
 * Uses sentence-based chunking with configurable overlap
 */
export function chunkText(text: string, maxChunkSize: number = 1000, overlapSize: number = 150): TextChunk[] {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (normalized.length === 0) {
    return [];
  }

  if (normalized.length <= maxChunkSize) {
    return [{ text: normalized, index: 0 }];
  }

  const sentencesFromParagraph = (para: string): string[] => {
    const cleaned = para.replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];
    return cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
  };

  const paragraphs = normalized.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
  const segments: string[] = [];
  if (paragraphs.length > 1) {
    for (const para of paragraphs) {
      if (para.length > maxChunkSize) {
        segments.push(...sentencesFromParagraph(para));
      } else {
        segments.push(para);
      }
    }
  } else {
    segments.push(...sentencesFromParagraph(normalized));
  }

  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;
  let overlapText = '';

  for (const segment of segments) {
    const trimmedSegment = segment.trim();
    if (!trimmedSegment) continue;

    if (trimmedSegment.length > maxChunkSize) {
      let start = 0;
      while (start < trimmedSegment.length) {
        const slice = trimmedSegment.slice(start, start + maxChunkSize);
        if (currentChunk.trim()) {
          chunks.push({ text: currentChunk.trim(), index: chunkIndex });
          chunkIndex++;
          currentChunk = '';
        }
        chunks.push({ text: slice.trim(), index: chunkIndex });
        chunkIndex++;
        start += maxChunkSize;
      }
      overlapText = '';
      continue;
    }

    if (currentChunk.length + trimmedSegment.length > maxChunkSize && currentChunk.length > 0) {
      const chunkContent = currentChunk.trim();
      chunks.push({ text: chunkContent, index: chunkIndex });
      chunkIndex++;

      overlapText =
        overlapSize > 0 && chunkContent.length > overlapSize
          ? chunkContent.slice(-overlapSize).trim()
          : '';

      currentChunk = overlapText ? `${overlapText} ${trimmedSegment}` : trimmedSegment;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSegment;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ text: currentChunk.trim(), index: chunkIndex });
  }

  return chunks;
}

/**
 * Estimate token count (rough approximation)
 * 1 token ≈ 4 characters for English text
 */
export function estimateTokenCount(text: string): number {
  // Use /3 ratio — more conservative and accurate for non-English (Turkish, Hungarian) text
  return Math.ceil(text.length / 3);
}

/**
 * Validate chunk size
 */
export function isValidChunkSize(text: string): boolean {
  const estimatedTokens = estimateTokenCount(text);
  return estimatedTokens <= MAX_TOKENS_PER_CHUNK;
}
