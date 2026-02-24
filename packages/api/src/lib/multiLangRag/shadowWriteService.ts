import { getSupabaseServiceClient, logger } from '@recete/shared';
import { ShopSettingsService } from './shopSettingsService.js';
import { ProductI18nService } from './productI18nService.js';
import { EmbeddingService } from './embeddingService.js';
import { VectorSearchService } from './vectorSearchService.js';
import { buildEmbeddingContentHash, buildEmbeddingDocument, normalizeLangCode } from './utils.js';
import { getMultiLangRagFlags } from './config.js';
import type { ProductI18nSnapshot } from './types.js';

function snapshotFromProductRow(product: any): ProductI18nSnapshot {
  return {
    title: product.name || 'Product',
    description_html: product.enriched_text || product.raw_text || '',
    specs_json: (product.multilang_specs_json && typeof product.multilang_specs_json === 'object') ? product.multilang_specs_json : {},
    faq_json: Array.isArray(product.multilang_faq_json) ? product.multilang_faq_json : [],
  };
}

export class MultiLangRagShadowWriteService {
  constructor(
    private settingsService = new ShopSettingsService(),
    private i18nService = new ProductI18nService(),
    private embeddingService = new EmbeddingService(),
    private vectorSearchService = new VectorSearchService(),
  ) {}

  async syncProduct(shopId: string, productId: string): Promise<void> {
    const flags = getMultiLangRagFlags();
    if (!flags.shadowWrite) return;

    const svc = getSupabaseServiceClient();
    const { data: product, error } = await svc
      .from('products')
      .select('id, merchant_id, name, url, raw_text, enriched_text')
      .eq('id', productId)
      .eq('merchant_id', shopId)
      .single();
    if (error || !product) {
      logger.warn({ error, shopId, productId }, 'Multi-lang shadow write skipped: product not found');
      return;
    }

    const sourceText = String(product.enriched_text || product.raw_text || product.name || '').trim();
    if (!sourceText) {
      logger.info({ shopId, productId }, 'Multi-lang shadow write skipped: no source text');
      return;
    }

    const settings = await this.settingsService.getOrCreate(shopId, sourceText);
    const sourceSnapshot = snapshotFromProductRow(product);
    const i18nResults = await this.i18nService.upsertTranslations({
      shopId,
      productId,
      sourceSnapshot,
      sourceLang: settings.default_source_lang,
      enabledLangs: settings.enabled_langs,
    });

    for (const lang of [...new Set([normalizeLangCode(settings.default_source_lang), ...settings.enabled_langs.map(normalizeLangCode)])]) {
      try {
        const row = await this.i18nService.getProductI18n(shopId, productId, lang);
        if (!row) continue;

        const doc = buildEmbeddingDocument({
          title: row.title || sourceSnapshot.title,
          description_html: row.description_html || '',
          specs_json: row.specs_json || {},
          faq_json: row.faq_json || [],
        });
        if (!doc.trim()) continue;
        const contentHash = buildEmbeddingContentHash(doc);
        const existing = await this.vectorSearchService.getExistingEmbeddingMeta({
          shopId,
          productId,
          lang,
          embeddingModel: flags.embeddingModel,
        });
        if (existing?.content_hash === contentHash) continue;
        const embedding = await this.embeddingService.embedText(doc);
        await this.vectorSearchService.upsertProductEmbedding({
          shopId,
          productId,
          lang,
          embeddingModel: flags.embeddingModel,
          contentHash,
          embedding,
        });
      } catch (embedErr) {
        logger.warn({ embedErr, shopId, productId, lang }, 'Multi-lang shadow embedding failed');
      }
    }

    logger.info(
      { shopId, productId, i18nResults, enabledLangs: settings.enabled_langs },
      'Multi-lang RAG shadow write sync completed'
    );
  }
}

