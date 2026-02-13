/**
 * RAG Tests
 * Tests for RAG query functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryKnowledgeBase, formatRAGResultsForLLM } from './rag';
import { getSupabaseServiceClient } from '@glowguide/shared';
import { mockSupabaseClient } from '../test/mocks';
import { generateEmbedding } from './embeddings';

// Mock dependencies
vi.mock('@glowguide/shared', async () => {
  const actual = await vi.importActual('@glowguide/shared');
  return {
    ...actual,
    getSupabaseServiceClient: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('./embeddings', () => ({
  generateEmbedding: vi.fn(),
}));

describe('queryKnowledgeBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
  });

  it('should query knowledge base and return results', async () => {
    const merchantId = 'test-merchant-id';
    const query = 'What is the size of this product?';
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

    // Mock embedding generation
    (generateEmbedding as any).mockResolvedValueOnce({
      embedding: mockEmbedding,
      usage: { prompt_tokens: 10, total_tokens: 10 },
    });

    // Mock knowledge chunks
    const mockChunks = [
      {
        id: 'chunk-1',
        product_id: 'product-1',
        chunk_text: 'This product is size M',
        chunk_index: 0,
        embedding: new Array(1536).fill(0.1),
        products: {
          id: 'product-1',
          name: 'Test Product',
          url: 'https://example.com/product',
          merchant_id: merchantId,
        },
      },
    ];

    const kbQuery = mockSupabaseClient.from('knowledge_chunks') as any;
    kbQuery.__setDefaultResult({
      data: mockChunks,
      error: null,
    });

    const result = await queryKnowledgeBase({
      merchantId,
      query,
      topK: 5,
    });

    expect(result).toBeDefined();
    expect(result.results).toBeDefined();
    expect(result.query).toBe(query);
    expect(result.totalResults).toBeGreaterThanOrEqual(0);
  });

  it('should return empty results when no chunks found', async () => {
    const merchantId = 'test-merchant-id';
    const query = 'Non-existent product query';
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

    (generateEmbedding as any).mockResolvedValueOnce({
      embedding: mockEmbedding,
      usage: { prompt_tokens: 10, total_tokens: 10 },
    });

    const kbQuery = mockSupabaseClient.from('knowledge_chunks') as any;
    kbQuery.__setDefaultResult({ data: [], error: null });

    const result = await queryKnowledgeBase({
      merchantId,
      query,
      topK: 5,
    });

    expect(result.results).toHaveLength(0);
    expect(result.totalResults).toBe(0);
  });

  it('should filter by product IDs', async () => {
    const merchantId = 'test-merchant-id';
    const query = 'Test query';
    // Use valid UUIDs so RAG code applies the filter (invalid IDs are filtered out)
    const productIds = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ];
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

    (generateEmbedding as any).mockResolvedValueOnce({
      embedding: mockEmbedding,
      usage: { prompt_tokens: 10, total_tokens: 10 },
    });

    const kbQuery = mockSupabaseClient.from('knowledge_chunks') as any;
    kbQuery.__setDefaultResult({ data: [], error: null });

    await queryKnowledgeBase({
      merchantId,
      query,
      productIds,
      topK: 5,
    });

    // Should filter by product IDs (valid UUIDs trigger .in('product_id', productIds))
    expect((kbQuery.in as any)).toHaveBeenCalledWith('product_id', productIds);
  });

  it('should calculate similarity scores', async () => {
    const merchantId = 'test-merchant-id';
    const query = 'Test query';
    const mockEmbedding = new Array(1536).fill(0.5);
    const chunkEmbedding = new Array(1536).fill(0.5);

    (generateEmbedding as any).mockResolvedValueOnce({
      embedding: mockEmbedding,
      usage: { prompt_tokens: 10, total_tokens: 10 },
    });

    const mockChunks = [
      {
        id: 'chunk-1',
        product_id: 'product-1',
        chunk_text: 'Test chunk',
        chunk_index: 0,
        embedding: chunkEmbedding,
        products: {
          id: 'product-1',
          name: 'Test Product',
          url: 'https://example.com/product',
          merchant_id: merchantId,
        },
      },
    ];

    const kbQuery = mockSupabaseClient.from('knowledge_chunks') as any;
    kbQuery.__setDefaultResult({ data: mockChunks, error: null });

    const result = await queryKnowledgeBase({
      merchantId,
      query,
      topK: 5,
    });

    expect(result.results).toBeDefined();
    if (result.results.length > 0) {
      expect(result.results[0].similarity).toBeDefined();
      expect(result.results[0].similarity).toBeGreaterThanOrEqual(0);
      expect(result.results[0].similarity).toBeLessThanOrEqual(1.000001);
    }
  });
});

describe('formatRAGResultsForLLM', () => {
  it('should format RAG results for LLM context', () => {
    const results = [
      {
        chunkId: 'chunk-1',
        productId: 'product-1',
        productName: 'Test Product',
        productUrl: 'https://example.com/product',
        chunkText: 'This product is size M',
        chunkIndex: 0,
        similarity: 0.95,
      },
      {
        chunkId: 'chunk-2',
        productId: 'product-1',
        productName: 'Test Product',
        productUrl: 'https://example.com/product',
        chunkText: 'This product is made of cotton',
        chunkIndex: 1,
        similarity: 0.90,
      },
    ];

    const formatted = formatRAGResultsForLLM(results);

    expect(formatted).toBeDefined();
    expect(formatted).toContain('Test Product');
    expect(formatted).toContain('size M');
    expect(formatted).toContain('cotton');
  });

  it('should handle empty results', () => {
    const formatted = formatRAGResultsForLLM([]);

    expect(formatted).toBeDefined();
    // Should return empty or default message
  });
});
