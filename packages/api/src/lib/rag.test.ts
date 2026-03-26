/**
 * RAG utility tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatRAGResultsForLLM, getOrderProductContextResolved } from './rag';
import { getSupabaseServiceClient } from '@recete/shared';
import { mockSupabaseClient } from '../test/mocks';

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

  it('should resolve a unique partial item-name match without broadening ambiguously', async () => {
    const ordersBuilder: any = mockSupabaseClient.from('orders');
    ordersBuilder.__pushResult({
      data: {
        id: 'order-2',
        merchant_id: 'merchant-1',
        user_id: 'user-1',
        external_order_id: 'ORDER-002',
      },
      error: null,
    });

    const eventsBuilder: any = mockSupabaseClient.from('external_events');
    eventsBuilder.__setDefaultResult({
      data: [
        {
          payload: {
            external_order_id: 'ORDER-002',
            items: [
              { name: 'Vitamin C Serum' },
            ],
          },
        },
      ],
      error: null,
    });

    const productsBuilder: any = mockSupabaseClient.from('products');
    productsBuilder.__pushResult({
      data: [
        { id: 'prod-1', name: 'Maruderm Vitamin C Serum' },
        { id: 'prod-2', name: 'Maruderm Retinol Cream' },
      ],
      error: null,
    });

    const chunksBuilder: any = mockSupabaseClient.from('knowledge_chunks');
    chunksBuilder.__setDefaultResult({ data: [], error: null });

    const result = await getOrderProductContextResolved('order-2', 'merchant-1');

    expect(result.productIds).toEqual(['prod-1']);
    expect(result.source).toBe('external_events');
  });
});
