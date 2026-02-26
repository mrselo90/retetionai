/**
 * RAG Tests
 * Tests for RAG query functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryKnowledgeBase, formatRAGResultsForLLM, getOrderProductContextResolved } from './rag';
import { getSupabaseServiceClient } from '@recete/shared';
import { mockSupabaseClient } from '../test/mocks';
import { generateEmbedding } from './embeddings';

// Mock dependencies
vi.mock('@recete/shared', async () => {
  const actual = await vi.importActual('@recete/shared');
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

vi.mock('./cache', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(true),
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

    // Mock RPC results (pgvector search)
    const mockRpcRows = [
      {
        id: 'chunk-1',
        product_id: 'product-1',
        chunk_text: 'This product is size M',
        chunk_index: 0,
        similarity: 0.92,
        product_name: 'Test Product',
        product_url: 'https://example.com/product',
      },
    ];

    (mockSupabaseClient.rpc as any).mockResolvedValueOnce({
      data: mockRpcRows,
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
    expect(result.totalResults).toBe(1);
    expect(result.results[0].productName).toBe('Test Product');
    expect(result.results[0].similarity).toBe(0.92);
  });

  it('should return empty results when no chunks found', async () => {
    const merchantId = 'test-merchant-id';
    const query = 'Non-existent product query';
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

    (generateEmbedding as any).mockResolvedValueOnce({
      embedding: mockEmbedding,
      usage: { prompt_tokens: 10, total_tokens: 10 },
    });

    (mockSupabaseClient.rpc as any).mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await queryKnowledgeBase({
      merchantId,
      query,
      topK: 5,
    });

    expect(result.results).toHaveLength(0);
    expect(result.totalResults).toBe(0);
  });

  it('should pass product IDs to RPC', async () => {
    const merchantId = 'test-merchant-id';
    const query = 'Test query';
    const productIds = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ];
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());

    (generateEmbedding as any).mockResolvedValueOnce({
      embedding: mockEmbedding,
      usage: { prompt_tokens: 10, total_tokens: 10 },
    });

    (mockSupabaseClient.rpc as any).mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await queryKnowledgeBase({
      merchantId,
      query,
      productIds,
      topK: 5,
    });

    // Should pass product IDs to the RPC call
    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      'match_knowledge_chunks',
      expect.objectContaining({
        match_merchant_id: merchantId,
        match_product_ids: productIds,
        match_count: 5,
      })
    );
  });

  it('should return similarity scores from RPC', async () => {
    const merchantId = 'test-merchant-id';
    const query = 'Test query';
    const mockEmbedding = new Array(1536).fill(0.5);

    (generateEmbedding as any).mockResolvedValueOnce({
      embedding: mockEmbedding,
      usage: { prompt_tokens: 10, total_tokens: 10 },
    });

    const mockRpcRows = [
      {
        id: 'chunk-1',
        product_id: 'product-1',
        chunk_text: 'Test chunk',
        chunk_index: 0,
        similarity: 0.95,
        product_name: 'Test Product',
        product_url: 'https://example.com/product',
      },
    ];

    (mockSupabaseClient.rpc as any).mockResolvedValueOnce({
      data: mockRpcRows,
      error: null,
    });

    const result = await queryKnowledgeBase({
      merchantId,
      query,
      topK: 5,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].similarity).toBe(0.95);
    expect(result.results[0].similarity).toBeGreaterThanOrEqual(0);
    expect(result.results[0].similarity).toBeLessThanOrEqual(1);
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

describe('getOrderProductContextResolved', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.__reset();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
  });

  it('should resolve products by item name when external product IDs are not mapped', async () => {
    const ordersBuilder: any = mockSupabaseClient.from('orders');
    ordersBuilder.__pushResult({
      data: {
        id: 'order-1',
        merchant_id: 'merchant-1',
        user_id: 'user-1',
        external_order_id: 'ORDER-001',
      },
      error: null,
    });

    const eventsBuilder: any = mockSupabaseClient.from('external_events');
    eventsBuilder.__setDefaultResult({
      data: [
        {
          payload: {
            external_order_id: 'ORDER-001',
            items: [
              { external_product_id: 'manual-unmapped-1', name: 'Maruderm Vitamin C Cream' },
              { name: 'Maruderm Cleanser Gel' },
            ],
          },
        },
      ],
      error: null,
    });

    const productsBuilder: any = mockSupabaseClient.from('products');
    // First query: external_id lookup -> no matches
    productsBuilder.__pushResult({ data: [], error: null });
    // Second query: merchant products for name fallback -> matches by name
    productsBuilder.__pushResult({
      data: [
        { id: 'prod-1', name: 'Maruderm Vitamin C Cream' },
        { id: 'prod-2', name: 'Maruderm Cleanser Gel' },
        { id: 'prod-3', name: 'Unrelated Product' },
      ],
      error: null,
    });

    const chunksBuilder: any = mockSupabaseClient.from('knowledge_chunks');
    chunksBuilder.__setDefaultResult({ data: [], error: null });

    const result = await getOrderProductContextResolved('order-1', 'merchant-1');

    expect(result.productIds).toEqual(['prod-1', 'prod-2']);
    expect(result.source).toBe('external_events');
    expect(result.chunks).toEqual([]);
  });
});
