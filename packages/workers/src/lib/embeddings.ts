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

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function isValidChunkSize(text: string): boolean {
  const estimatedTokens = estimateTokenCount(text);
  return estimatedTokens <= MAX_TOKENS_PER_CHUNK;
}
