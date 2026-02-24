import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MultiLangRagShadowWriteService } from './shadowWriteService.js';
import { __resetMultiLangRagFlagsForTests } from './config.js';
import { buildEmbeddingContentHash, buildEmbeddingDocument } from './utils.js';

vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id: 'prod-1',
                merchant_id: 'shop-1',
                name: 'Prod',
                raw_text: 'raw',
                enriched_text: 'enriched',
              },
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
  logger: { info: vi.fn(), warn: vi.fn() },
}));

describe('MultiLangRagShadowWriteService', () => {
  beforeEach(() => {
    process.env.MULTI_LANG_RAG_SHADOW_WRITE = 'true';
    process.env.EMBEDDING_MODEL = 'text-embedding-3-small';
    __resetMultiLangRagFlagsForTests();
  });

  it('skips embedding when content_hash is unchanged', async () => {
    const upsertTranslations = vi.fn(async () => []);
    const getProductI18n = vi.fn(async () => ({
      title: 'Prod',
      description_html: 'enriched',
      specs_json: {},
      faq_json: [],
    }));
    const doc = buildEmbeddingDocument({
      title: 'Prod',
      description_html: 'enriched',
      specs_json: {},
      faq_json: [],
    });
    const existingMeta = vi.fn(async () => ({ content_hash: buildEmbeddingContentHash(doc) }));
    const embedText = vi.fn(async () => [0, 1, 2]);
    const upsertEmbedding = vi.fn(async () => undefined);

    const svc = new MultiLangRagShadowWriteService(
      { getOrCreate: async () => ({ shop_id: 'shop-1', default_source_lang: 'en', enabled_langs: ['en'], multi_lang_rag_enabled: false }) } as any,
      { upsertTranslations, getProductI18n } as any,
      { getModel: () => 'text-embedding-3-small', embedText } as any,
      { getExistingEmbeddingMeta: existingMeta, upsertProductEmbedding: upsertEmbedding } as any,
    );
    await svc.syncProduct('shop-1', 'prod-1');

    expect(upsertTranslations).toHaveBeenCalled();
    expect(embedText).not.toHaveBeenCalled();
    expect(upsertEmbedding).not.toHaveBeenCalled();
  });
});
