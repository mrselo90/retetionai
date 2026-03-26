import { getSupabaseServiceClient, logger } from '@recete/shared';
import { detectLanguage } from '../i18n.js';
import { normalizeLangCode } from './utils.js';
import type { ShopSettingsRecord } from './types.js';

export class ShopSettingsService {
  private buildFallbackSettings(shopId: string, seedTextForLanguage?: string): ShopSettingsRecord {
    const inferred = seedTextForLanguage ? detectLanguage(seedTextForLanguage) : 'en';
    const defaultLang = normalizeLangCode(inferred);
    return {
      shop_id: shopId,
      default_source_lang: defaultLang,
      enabled_langs: [defaultLang],
      multi_lang_rag_enabled: false,
    };
  }

  async getOrCreate(shopId: string, seedTextForLanguage?: string): Promise<ShopSettingsRecord> {
    if (!shopId?.trim()) {
      throw new Error('shop_settings requires a non-empty shopId');
    }

    const svc = getSupabaseServiceClient();
    const { data: existing, error: getError } = await svc
      .from('shop_settings')
      .select('shop_id, default_source_lang, enabled_langs, multi_lang_rag_enabled')
      .eq('shop_id', shopId)
      .maybeSingle();
    if (getError) throw new Error(`shop_settings query failed: ${getError.message}`);

    if (existing?.shop_id) {
      return {
        shop_id: existing.shop_id,
        default_source_lang: normalizeLangCode(existing.default_source_lang),
        enabled_langs: Array.isArray(existing.enabled_langs) ? existing.enabled_langs.map((x: any) => normalizeLangCode(String(x))) : ['en'],
        multi_lang_rag_enabled: Boolean(existing.multi_lang_rag_enabled),
      };
    }

    const fallback = this.buildFallbackSettings(shopId, seedTextForLanguage);
    const { data: inserted, error: insErr } = await svc
      .from('shop_settings')
      .insert({
        shop_id: shopId,
        default_source_lang: fallback.default_source_lang,
        enabled_langs: fallback.enabled_langs,
        multi_lang_rag_enabled: false,
      })
      .select('shop_id, default_source_lang, enabled_langs, multi_lang_rag_enabled')
      .single();
    if (insErr) {
      logger.warn({ insErr, shopId }, 'shop_settings insert failed; using ephemeral defaults for shadow sync');
      return fallback;
    }
    if (!inserted?.shop_id) {
      logger.warn({ shopId }, 'shop_settings insert returned no row; using ephemeral defaults for shadow sync');
      return fallback;
    }
    return {
      shop_id: inserted.shop_id,
      default_source_lang: normalizeLangCode(inserted.default_source_lang),
      enabled_langs: Array.isArray(inserted.enabled_langs) ? inserted.enabled_langs.map((x: any) => normalizeLangCode(String(x))) : fallback.enabled_langs,
      multi_lang_rag_enabled: Boolean(inserted.multi_lang_rag_enabled),
    };
  }

  async update(
    shopId: string,
    patch: Partial<Pick<ShopSettingsRecord, 'default_source_lang' | 'enabled_langs' | 'multi_lang_rag_enabled'>>
  ): Promise<ShopSettingsRecord> {
    const current = await this.getOrCreate(shopId);
    const nextDefault = patch.default_source_lang ? normalizeLangCode(patch.default_source_lang) : current.default_source_lang;
    const nextEnabled = Array.isArray(patch.enabled_langs)
      ? [...new Set(patch.enabled_langs.map((x) => normalizeLangCode(String(x))).filter(Boolean))]
      : current.enabled_langs;
    if (!nextEnabled.includes(nextDefault)) nextEnabled.unshift(nextDefault);

    const nextEnabledFinal = [...new Set(nextEnabled)];
    const nextEnabledFiltered = nextEnabledFinal.filter(Boolean);

    const svc = getSupabaseServiceClient();
    const { data, error } = await svc
      .from('shop_settings')
      .upsert(
        {
          shop_id: shopId,
          default_source_lang: nextDefault,
          enabled_langs: nextEnabledFiltered,
          multi_lang_rag_enabled: patch.multi_lang_rag_enabled ?? current.multi_lang_rag_enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id' }
      )
      .select('shop_id, default_source_lang, enabled_langs, multi_lang_rag_enabled')
      .single();

    if (error) throw new Error(`shop_settings update failed: ${error.message}`);
    return {
      shop_id: data.shop_id,
      default_source_lang: normalizeLangCode(data.default_source_lang),
      enabled_langs: Array.isArray(data.enabled_langs) ? data.enabled_langs.map((x: any) => normalizeLangCode(String(x))) : [nextDefault],
      multi_lang_rag_enabled: Boolean(data.multi_lang_rag_enabled),
    };
  }
}
