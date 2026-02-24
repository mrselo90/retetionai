import { getSupabaseServiceClient } from '@recete/shared';
import type { RetrievedProductEmbedding } from './types.js';

export class VectorSearchService {
  async upsertProductEmbedding(input: {
    shopId: string;
    productId: string;
    lang: string;
    embeddingModel: string;
    contentHash: string;
    embedding: number[];
  }): Promise<void> {
    const svc = getSupabaseServiceClient();
    const { error } = await svc
      .from('product_embeddings')
      .upsert(
        {
          shop_id: input.shopId,
          product_id: input.productId,
          lang: input.lang,
          embedding_model: input.embeddingModel,
          content_hash: input.contentHash,
          embedding: JSON.stringify(input.embedding),
          indexed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id,product_id,lang,embedding_model' }
      );
    if (error) throw new Error(`product_embeddings upsert failed: ${error.message}`);
  }

  async getExistingEmbeddingMeta(input: {
    shopId: string;
    productId: string;
    lang: string;
    embeddingModel: string;
  }): Promise<{ content_hash: string } | null> {
    const svc = getSupabaseServiceClient();
    const { data, error } = await svc
      .from('product_embeddings')
      .select('content_hash')
      .eq('shop_id', input.shopId)
      .eq('product_id', input.productId)
      .eq('lang', input.lang)
      .eq('embedding_model', input.embeddingModel)
      .maybeSingle();
    if (error) throw new Error(`product_embeddings select failed: ${error.message}`);
    return (data as any) || null;
  }

  async searchByLanguage(input: {
    shopId: string;
    lang: string;
    queryEmbedding: number[];
    matchCount: number;
  }): Promise<RetrievedProductEmbedding[]> {
    const svc = getSupabaseServiceClient();
    const { data, error } = await svc.rpc('match_product_embeddings_by_lang', {
      p_shop_id: input.shopId,
      p_lang: input.lang,
      p_query_embedding: JSON.stringify(input.queryEmbedding),
      p_match_count: input.matchCount,
    });
    if (error) throw new Error(`match_product_embeddings_by_lang failed: ${error.message}`);
    const rows = (data || []) as any[];
    if (!rows.length) return [];

    const productIds = [...new Set(rows.map((r) => r.product_id))];
    const [{ data: products }, { data: i18nRows }] = await Promise.all([
      svc.from('products').select('id,name').in('id', productIds),
      svc.from('product_i18n').select('product_id,lang,title,description_html').eq('shop_id', input.shopId).eq('lang', input.lang).in('product_id', productIds),
    ]);
    const pMap = new Map((products || []).map((p: any) => [p.id, p]));
    const iMap = new Map((i18nRows || []).map((r: any) => [r.product_id, r]));

    return rows.map((r) => ({
      productId: r.product_id,
      lang: r.lang,
      distance: Number(r.distance ?? 1),
      similarity: Number(r.similarity ?? 0),
      productName: pMap.get(r.product_id)?.name,
      title: iMap.get(r.product_id)?.title,
      descriptionText: iMap.get(r.product_id)?.description_html,
    }));
  }
}

