import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiLangRagAnswerService } from './answerService.js';
import { __setOpenAIClientForTests } from '../openaiClient.js';
import { __resetMultiLangRagFlagsForTests } from './config.js';

vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn() },
}));

describe('MultiLangRagAnswerService', () => {
  beforeEach(() => {
    process.env.MULTI_LANG_RAG_MIN_SIM = '0.75';
    process.env.LLM_MODEL = 'gpt-4o-mini';
    process.env.EMBEDDING_MODEL = 'text-embedding-3-small';
    __resetMultiLangRagFlagsForTests();
    __setOpenAIClientForTests({
      chat: {
        completions: {
          create: vi.fn(async () => ({
            choices: [{ message: { content: 'TR cevap' } }],
            usage: { total_tokens: 123 },
          })),
        },
      },
    } as any);
  });

  it('falls back to source language retrieval when user-lang evidence is weak', async () => {
    const searchByLanguage = vi
      .fn()
      .mockResolvedValueOnce([{ productId: 'p1', lang: 'tr', similarity: 0.31, distance: 0.69 }])
      .mockResolvedValueOnce([{ productId: 'p1', lang: 'hu', similarity: 0.91, distance: 0.09, productName: 'Prod' }]);

    const svc = new MultiLangRagAnswerService(
      { embedText: vi.fn(async () => new Array(1536).fill(0)) } as any,
      { searchByLanguage, getExistingEmbeddingMeta: vi.fn(), upsertProductEmbedding: vi.fn() } as any,
      { translateText: vi.fn(async (t: string, _s: string, target: string) => target === 'hu' ? `HU:${t}` : `TR:${t}`) } as any,
      { getOrCreate: vi.fn(async () => ({ shop_id: 's1', default_source_lang: 'hu', enabled_langs: ['hu', 'tr'], multi_lang_rag_enabled: false })) } as any,
      { getProductI18nMany: vi.fn(async () => [{ product_id: 'p1', title: 'Prod HU', description_html: '<p>Használat...</p>' }]) } as any,
    );

    const out = await svc.answer({ shopId: 's1', question: 'Bu ürün nasıl kullanılır?', userLang: 'tr' });
    expect(out.used_fallback).toBe(true);
    expect(out.fallback_lang).toBe('hu');
    expect(out.cited_products).toContain('p1');
    expect(searchByLanguage).toHaveBeenCalledTimes(2);
  });
});

