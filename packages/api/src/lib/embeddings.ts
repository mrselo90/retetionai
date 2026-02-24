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
  // Clean text
  const cleaned = text.trim().replace(/\s+/g, ' ');

  if (cleaned.length === 0) {
    return [];
  }

  // If text is small enough, return as single chunk
  if (cleaned.length <= maxChunkSize) {
    return [{ text: cleaned, index: 0 }];
  }

  // Split by sentences (basic approach)
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];

  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;
  let overlapText = ''; // Trailing text from previous chunk for context continuity

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();

    // If adding this sentence exceeds max size, save current chunk and start new one
    if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
      const chunkContent = currentChunk.trim();
      chunks.push({
        text: chunkContent,
        index: chunkIndex,
      });
      chunkIndex++;

      // Carry over the tail of the previous chunk as overlap for context
      overlapText = overlapSize > 0 && chunkContent.length > overlapSize
        ? chunkContent.slice(-overlapSize).trim()
        : '';

      currentChunk = overlapText ? overlapText + ' ' + trimmedSentence : trimmedSentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
    }
  }

  // Add last chunk
  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex,
    });
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
