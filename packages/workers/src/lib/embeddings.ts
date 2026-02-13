/**
 * Embedding generation utilities
 * Copied from API package to avoid cross-package source imports.
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_TOKENS_PER_CHUNK = 8000;

export interface TextChunk {
  text: string;
  index: number;
  tokenCount?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    encoding_format: 'float',
  });

  return {
    embedding: response.data[0].embedding,
    tokenCount: response.usage.total_tokens,
  };
}

export async function generateEmbeddingsBatch(chunks: TextChunk[]): Promise<EmbeddingResult[]> {
  const texts = chunks.map((c) => c.text);

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    encoding_format: 'float',
  });

  return response.data.map((item) => ({
    embedding: item.embedding,
    tokenCount: response.usage.total_tokens / Math.max(1, texts.length),
  }));
}

export function chunkText(text: string, maxChunkSize: number = 1000): TextChunk[] {
  const cleaned = text.trim().replace(/\s+/g, ' ');

  if (cleaned.length === 0) {
    return [];
  }

  if (cleaned.length <= maxChunkSize) {
    return [{ text: cleaned, index: 0 }];
  }

  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];

  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();

    if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
      });
      chunkIndex++;
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex,
    });
  }

  return chunks;
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function isValidChunkSize(text: string): boolean {
  const estimatedTokens = estimateTokenCount(text);
  return estimatedTokens <= MAX_TOKENS_PER_CHUNK;
}

