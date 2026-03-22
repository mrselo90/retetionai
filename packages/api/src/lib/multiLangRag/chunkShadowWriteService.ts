import crypto from 'node:crypto';
import { getSupabaseServiceClient, logger } from '@recete/shared';
import { chunkText, generateEmbeddingsBatch, type TextChunk } from '../embeddings.js';
import { ProductI18nService } from './productI18nService.js';
import { EmbeddingService } from './embeddingService.js';
import { ShopSettingsService } from './shopSettingsService.js';
import { getMultiLangRagFlags } from './config.js';
import { buildProductI18nSourceSnapshot } from './productI18nSnapshot.js';
import { normalizeLangCode, stableStringify, stripHtmlToText } from './utils.js';

type ChunkDoc = {
  lang: string;
  sectionType: string;
  sourceKind: string;
  sourceRef: Record<string, unknown>;
  text: string;
};

function chunkSection(doc: ChunkDoc, maxChunkSize = 1000, overlap = 150): Array<ChunkDoc & { chunk: TextChunk }> {
  return chunkText(doc.text, maxChunkSize, overlap).map((chunk) => ({ ...doc, chunk }));
}

function buildSectionedChunkDocs(row: {
  product_id: string;
  lang: string;
  title?: string | null;
  description_html?: string | null;
  specs_json?: Record<string, any> | null;
  faq_json?: any[] | null;
}): ChunkDoc[] {
  const lang = normalizeLangCode(row.lang);
  const docs: ChunkDoc[] = [];
  const title = String(row.title || 'Product').trim();
  const description = stripHtmlToText(row.description_html || '');
  const specs = row.specs_json && typeof row.specs_json === 'object' ? row.specs_json : {};
  const faqs = Array.isArray(row.faq_json) ? row.faq_json : [];

  if (title) {
    docs.push({
      lang,
      sectionType: 'identity',
      sourceKind: 'product_i18n.title',
      sourceRef: { field: 'title' },
      text: `[LANG:${lang}]\n[SECTION:IDENTITY]\nTitle: ${title}`,
    });
  }

  if (description) {
    docs.push({
      lang,
      sectionType: 'general',
      sourceKind: 'product_i18n.description_html',
      sourceRef: { field: 'description_html' },
      text: `[LANG:${lang}]\n[SECTION:GENERAL]\n${description}`,
    });
  }

  const usageLines: string[] = [];
  const warningLines: string[] = [];
  const specLines: string[] = [];

  for (const [key, value] of Object.entries(specs)) {
    if (value == null) continue;
    const rendered = Array.isArray(value)
      ? value.map(String).join(', ')
      : typeof value === 'object'
        ? stableStringify(value)
        : String(value);
    const lower = key.toLowerCase();
    if (lower.includes('usage')) {
      usageLines.push(`${key}: ${rendered}`);
    } else if (lower.includes('warning') || lower.includes('prevent')) {
      warningLines.push(`${key}: ${rendered}`);
    } else {
      specLines.push(`${key}: ${rendered}`);
    }
  }

  if (usageLines.length > 0) {
    docs.push({
      lang,
      sectionType: 'usage',
      sourceKind: 'product_i18n.specs_json',
      sourceRef: { field: 'specs_json', keys: usageLines.map((line) => line.split(':')[0]) },
      text: `[LANG:${lang}]\n[SECTION:USAGE]\n${usageLines.join('\n')}`,
    });
  }

  if (warningLines.length > 0) {
    docs.push({
      lang,
      sectionType: 'warnings',
      sourceKind: 'product_i18n.specs_json',
      sourceRef: { field: 'specs_json', keys: warningLines.map((line) => line.split(':')[0]) },
      text: `[LANG:${lang}]\n[SECTION:WARNINGS]\n${warningLines.join('\n')}`,
    });
  }

  if (specLines.length > 0) {
    docs.push({
      lang,
      sectionType: 'specs',
      sourceKind: 'product_i18n.specs_json',
      sourceRef: { field: 'specs_json', keys: specLines.map((line) => line.split(':')[0]) },
      text: `[LANG:${lang}]\n[SECTION:SPECS]\n${specLines.join('\n')}`,
    });
  }

  for (let i = 0; i < faqs.length; i++) {
    const faq = faqs[i];
    const q = typeof faq?.question === 'string' ? faq.question.trim() : '';
    const a = typeof faq?.answer === 'string' ? faq.answer.trim() : '';
    if (!q && !a) continue;
    docs.push({
      lang,
      sectionType: 'faq',
      sourceKind: 'product_i18n.faq_json',
      sourceRef: { field: 'faq_json', index: i },
      text: `[LANG:${lang}]\n[SECTION:FAQ]\nQ: ${q}\nA: ${a}`.trim(),
    });
  }

  return docs.filter((doc) => doc.text.trim().length > 0);
}

export class MultiLangChunkShadowWriteService {
  constructor(
    private settingsService = new ShopSettingsService(),
    private i18nService = new ProductI18nService(),
    private embeddingService = new EmbeddingService(),
  ) {}

  async syncProduct(shopId: string, productId: string): Promise<void> {
    const flags = getMultiLangRagFlags();
    if (!flags.chunkShadowWrite) return;

    const svc = getSupabaseServiceClient();
    const { data: product, error } = await svc
      .from('products')
      .select('id, merchant_id, name, url, raw_text, enriched_text, multilang_specs_json, multilang_faq_json')
      .eq('id', productId)
      .eq('merchant_id', shopId)
      .single();
    if (error || !product) {
      logger.warn({ error, shopId, productId }, 'Multi-lang chunk shadow write skipped: product not found');
      return;
    }

    const sourceText = String(product.enriched_text || product.raw_text || product.name || '').trim();
    if (!sourceText) {
      logger.info({ shopId, productId }, 'Multi-lang chunk shadow write skipped: no source text');
      return;
    }

    const { data: productInstruction } = await svc
      .from('product_instructions')
      .select('usage_instructions, recipe_summary, prevention_tips')
      .eq('merchant_id', shopId)
      .eq('product_id', productId)
      .maybeSingle();

    const settings = await this.settingsService.getOrCreate(shopId, sourceText);
    const sourceSnapshot = buildProductI18nSourceSnapshot({ ...product, product_instructions: productInstruction || null });
    await this.i18nService.upsertTranslations({
      shopId,
      productId,
      sourceSnapshot,
      sourceLang: settings.default_source_lang,
      enabledLangs: settings.enabled_langs,
    });

    const langs = [...new Set([
      normalizeLangCode(settings.default_source_lang),
      ...settings.enabled_langs.map(normalizeLangCode),
    ])];

    await svc
      .from('knowledge_chunks_i18n')
      .delete()
      .eq('shop_id', shopId)
      .eq('product_id', productId)
      .eq('embedding_model', await this.embeddingService.getModel());

    const embeddingModel = await this.embeddingService.getModel();
    for (const lang of langs) {
      const row = await this.i18nService.getProductI18n(shopId, productId, lang);
      if (!row) continue;

      const docs = buildSectionedChunkDocs(row as any);
      const chunked = docs.flatMap((doc) => chunkSection(doc));
      if (chunked.length === 0) continue;

      const embeddings = await generateEmbeddingsBatch(chunked.map((item) => item.chunk));
      const records = chunked.map((item, index) => ({
        shop_id: shopId,
        product_id: productId,
        lang,
        language_code: lang,
        embedding_model: embeddingModel,
        chunk_text: item.chunk.text,
        embedding: JSON.stringify(embeddings[index].embedding),
        chunk_index: index,
        chunk_type: item.sectionType,
        section_type: item.sectionType,
        source_type: item.sourceKind,
        source_kind: item.sourceKind,
        source_ref: item.sourceRef,
        content_hash: crypto.createHash('sha256').update(item.chunk.text).digest('hex'),
        content_version: 1,
        indexed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: insertError } = await svc.from('knowledge_chunks_i18n').insert(records);
      if (insertError) {
        throw new Error(`knowledge_chunks_i18n insert failed for ${lang}: ${insertError.message}`);
      }
    }

    logger.info(
      {
        shopId,
        productId,
        langs,
        embeddingModel,
      },
      'Multi-lang chunk shadow write sync completed',
    );
  }
}
