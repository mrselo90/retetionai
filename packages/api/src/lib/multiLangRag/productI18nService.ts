import { getSupabaseServiceClient, logger } from '@recete/shared';
import { TranslationService } from './translationService.js';
import { buildSourceSnapshotHash, normalizeLangCode } from './utils.js';
import type { ProductI18nSnapshot, ShopSettingsRecord } from './types.js';

export interface UpsertI18nOptions {
  shopId: string;
  productId: string;
  sourceSnapshot: ProductI18nSnapshot;
  sourceLang: string;
  enabledLangs: string[];
}

export class ProductI18nService {
  constructor(private translator = new TranslationService()) {}

  async upsertTranslations(options: UpsertI18nOptions): Promise<Array<{ lang: string; skipped: boolean; reason?: string }>> {
    const svc = getSupabaseServiceClient();
    const sourceLang = normalizeLangCode(options.sourceLang);
    const enabledLangs = [...new Set((options.enabledLangs || []).map(normalizeLangCode).filter(Boolean))];
    if (!enabledLangs.includes(sourceLang)) enabledLangs.unshift(sourceLang);

    const sourceHash = buildSourceSnapshotHash(options.sourceSnapshot);
    const results: Array<{ lang: string; skipped: boolean; reason?: string }> = [];

    // Load existing rows once
    const { data: existingRows, error: existingError } = await svc
      .from('product_i18n')
      .select('id, lang, locked, source_hash')
      .eq('shop_id', options.shopId)
      .eq('product_id', options.productId)
      .in('lang', enabledLangs);
    if (existingError) throw new Error(`product_i18n existing query failed: ${existingError.message}`);
    const existingByLang = new Map((existingRows || []).map((r: any) => [normalizeLangCode(r.lang), r]));

    // Source language row always upsert
    await this.upsertSingle(options.shopId, options.productId, sourceLang, sourceLang, sourceHash, options.sourceSnapshot);
    results.push({ lang: sourceLang, skipped: false });

    for (const lang of enabledLangs) {
      if (lang === sourceLang) continue;
      const existing = existingByLang.get(lang);
      if (existing?.locked) {
        results.push({ lang, skipped: true, reason: 'locked' });
        continue;
      }
      if (existing?.source_hash && existing.source_hash === sourceHash) {
        results.push({ lang, skipped: true, reason: 'same_source_hash' });
        continue;
      }
      try {
        const translated = await this.translator.translateProductSnapshot(options.sourceSnapshot, sourceLang, lang);
        await this.upsertSingle(options.shopId, options.productId, lang, sourceLang, sourceHash, translated);
        results.push({ lang, skipped: false });
      } catch (error) {
        logger.warn({ error, shopId: options.shopId, productId: options.productId, lang }, 'product_i18n translation failed');
        results.push({ lang, skipped: true, reason: 'translation_error' });
      }
    }
    return results;
  }

  private async upsertSingle(
    shopId: string,
    productId: string,
    lang: string,
    sourceLang: string,
    sourceHash: string,
    snapshot: ProductI18nSnapshot
  ) {
    const svc = getSupabaseServiceClient();
    const { error } = await svc
      .from('product_i18n')
      .upsert(
        {
          shop_id: shopId,
          product_id: productId,
          lang,
          title: snapshot.title,
          description_html: snapshot.description_html,
          specs_json: snapshot.specs_json || {},
          faq_json: snapshot.faq_json || [],
          source_lang: sourceLang,
          source_hash: sourceHash,
          translated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id,product_id,lang' }
      );
    if (error) throw new Error(`product_i18n upsert failed (${lang}): ${error.message}`);
  }

  async getProductI18n(shopId: string, productId: string, lang: string) {
    const svc = getSupabaseServiceClient();
    const { data, error } = await svc
      .from('product_i18n')
      .select('id, shop_id, product_id, lang, title, description_html, specs_json, faq_json, source_lang, source_hash')
      .eq('shop_id', shopId)
      .eq('product_id', productId)
      .eq('lang', normalizeLangCode(lang))
      .maybeSingle();
    if (error) throw new Error(`product_i18n lookup failed: ${error.message}`);
    return data as any;
  }

  async getProductI18nMany(shopId: string, productIds: string[], lang: string) {
    const svc = getSupabaseServiceClient();
    const { data, error } = await svc
      .from('product_i18n')
      .select('product_id, lang, title, description_html, specs_json, faq_json, source_lang, source_hash')
      .eq('shop_id', shopId)
      .eq('lang', normalizeLangCode(lang))
      .in('product_id', productIds);
    if (error) throw new Error(`product_i18n bulk lookup failed: ${error.message}`);
    return (data || []) as any[];
  }
}

