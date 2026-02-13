/**
 * Embeddings Tests
 * Tests for OpenAI embedding generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __setOpenAIClientForTests } from './openaiClient';

import { generateEmbedding, generateEmbeddingsBatch } from './embeddings';

describe('generateEmbedding', () => {
  let mockCreate: any;
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn();
    __setOpenAIClientForTests({
      embeddings: {
        create: mockCreate,
      },
    } as any);
  });

  it('should generate embedding for text', async () => {
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

    mockCreate.mockResolvedValueOnce({
      data: [
        {
          embedding: mockEmbedding,
          index: 0,
        },
      ],
      usage: {
        prompt_tokens: 10,
        total_tokens: 10,
      },
    });

    const result = await generateEmbedding('Test text');

    expect(result.embedding).toBeDefined();
    expect(result.embedding).toHaveLength(1536);
    expect(result.tokenCount).toBe(10);
  });

  it('should handle API errors', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API Error'));

    await expect(generateEmbedding('Test text')).rejects.toThrow();
  });

  it('should handle empty text', async () => {
    const mockEmbedding = new Array(1536).fill(0);

    mockCreate.mockResolvedValueOnce({
      data: [
        {
          embedding: mockEmbedding,
          index: 0,
        },
      ],
      usage: {
        prompt_tokens: 0,
        total_tokens: 0,
      },
    });

    const result = await generateEmbedding('');

    expect(result.embedding).toBeDefined();
  });
});

describe('generateEmbeddingsBatch', () => {
  let mockCreate: any;
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate = vi.fn();
    __setOpenAIClientForTests({
      embeddings: {
        create: mockCreate,
      },
    } as any);
  });

  it('should generate embeddings for multiple texts', async () => {
    const chunks = [
      { text: 'Text 1', index: 0 },
      { text: 'Text 2', index: 1 },
      { text: 'Text 3', index: 2 },
    ];
    const mockEmbeddings = chunks.map(() => new Array(1536).fill(0).map(() => Math.random()));

    mockCreate.mockResolvedValueOnce({
      data: mockEmbeddings.map((emb, idx) => ({
        embedding: emb,
        index: idx,
      })),
      usage: {
        prompt_tokens: 30,
        total_tokens: 30,
      },
    });

    const results = await generateEmbeddingsBatch(chunks);

    expect(results).toHaveLength(3);
    results.forEach((result) => {
      expect(result.embedding).toBeDefined();
      expect(result.embedding).toHaveLength(1536);
    });
  });

  it('should handle batch size limits', async () => {
    // Create large batch
    const chunks = Array(100).fill(null).map((_, idx) => ({
      text: 'This is a test text that will exceed token limits',
      index: idx,
    }));
    
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
    
    mockCreate.mockResolvedValueOnce({
      data: chunks.map(() => ({
        embedding: mockEmbedding,
        index: 0,
      })),
      usage: {
        prompt_tokens: 1000,
        total_tokens: 1000,
      },
    });

    const results = await generateEmbeddingsBatch(chunks);

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
  });
});
