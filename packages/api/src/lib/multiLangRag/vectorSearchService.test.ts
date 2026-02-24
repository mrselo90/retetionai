import { describe, expect, it, vi } from 'vitest';
import { VectorSearchService } from './vectorSearchService.js';

const rpcMock = vi.fn();

vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: () => ({
    rpc: rpcMock,
    from: (table: string) => ({
      select: () => ({
        in: async () => ({ data: table === 'products' ? [{ id: 'p1', name: 'Prod' }] : [{ product_id: 'p1', lang: 'tr', title: 'Prod', description_html: 'Desc' }] }),
        eq: function () { return this; },
      }),
    }),
  }),
}));

describe('VectorSearchService', () => {
  it('passes shop_id and lang filters to Supabase RPC', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ product_id: 'p1', lang: 'tr', distance: 0.1, similarity: 0.9 }],
      error: null,
    });
    const svc = new VectorSearchService();
    await svc.searchByLanguage({
      shopId: 'shop-1',
      lang: 'tr',
      queryEmbedding: [0, 1],
      matchCount: 8,
    });
    expect(rpcMock).toHaveBeenCalledWith('match_product_embeddings_by_lang', expect.objectContaining({
      p_shop_id: 'shop-1',
      p_lang: 'tr',
      p_match_count: 8,
    }));
  });
});

