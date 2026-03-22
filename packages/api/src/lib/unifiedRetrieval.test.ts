import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnifiedRetrievalService } from './unifiedRetrieval.js';
import { getSupabaseServiceClient } from '@recete/shared';

vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

vi.mock('./cache.js', () => ({
  getCache: vi.fn(async () => null),
  setCache: vi.fn(),
}));

vi.mock('./embeddings.js', () => ({
  generateEmbedding: vi.fn(async () => ({ embedding: new Array(1536).fill(0.1) })),
}));

describe('UnifiedRetrievalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers multilingual chunk retrieval when available', async () => {
    (getSupabaseServiceClient as any).mockReturnValue({
      rpc: vi.fn(async () => ({
        data: [
          {
            id: 'c1',
            product_id: 'p1',
            language_code: 'tr',
            chunk_text: 'Kullanim bilgisi',
            chunk_index: 0,
            chunk_type: 'usage',
            section_type: 'usage',
            similarity: 0.91,
          },
        ],
        error: null,
      })),
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn(async () => ({
          data: [{ id: 'p1', name: 'Prod 1', url: 'https://example.com/p1' }],
          error: null,
        })),
      })),
    });

    const service = new UnifiedRetrievalService(
      { getOrCreate: vi.fn(async () => ({ default_source_lang: 'hu' })) } as any,
      { translateText: vi.fn() } as any,
    );

    const result = await service.retrieve({
      merchantId: 'm1',
      question: 'Bu urun nasil kullanilir?',
      userLang: 'tr',
      productIds: ['p1'],
      topK: 5,
      similarityThreshold: 0.6,
      preferredSectionTypes: ['usage'],
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.productId).toBe('p1');
    expect(result.effectiveLanguage).toBe('tr');
    expect(result.usedFallback).toBe(false);
  });

  it('throws when multilingual chunk retrieval errors', async () => {
    (getSupabaseServiceClient as any).mockReturnValue({
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: 'rpc failed' },
      })),
      from: vi.fn(),
    });

    const service = new UnifiedRetrievalService(
      { getOrCreate: vi.fn(async () => ({ default_source_lang: 'en' })) } as any,
      { translateText: vi.fn() } as any,
    );

    await expect(
      service.retrieve({
        merchantId: 'm1',
        question: 'How to use?',
        userLang: 'en',
        productIds: ['p1'],
      })
    ).rejects.toThrow('Failed to query multilingual chunk index: rpc failed');
  });
});
