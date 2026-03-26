import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnifiedRetrievalService } from './unifiedRetrieval.js';
import { getSupabaseServiceClient } from '@recete/shared';

vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
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

  it('falls back to legacy retrieval when multilingual chunk retrieval errors', async () => {
    const rpc = vi.fn(async (fn: string) => {
      if (fn === 'match_knowledge_chunks_i18n') {
        return {
          data: null,
          error: { message: 'rpc failed' },
        };
      }

      return {
        data: [
          {
            id: 'legacy-1',
            product_id: 'p1',
            product_name: 'Legacy Product',
            product_url: 'https://example.com/p1',
            chunk_text: 'Legacy usage guidance',
            chunk_index: 0,
            similarity: 0.77,
          },
        ],
        error: null,
      };
    });

    (getSupabaseServiceClient as any).mockReturnValue({
      rpc,
      from: vi.fn(),
    });

    const service = new UnifiedRetrievalService(
      { getOrCreate: vi.fn(async () => ({ default_source_lang: 'en' })) } as any,
      { translateText: vi.fn() } as any,
    );

    const result = await service.retrieve({
      merchantId: 'm1',
      question: 'How to use?',
      userLang: 'en',
      productIds: ['p1'],
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.productId).toBe('p1');
    expect(result.results[0]?.productName).toBe('Legacy Product');
    expect(result.effectiveLanguage).toBe('en');
    expect(result.usedFallback).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
