import { getSupabaseServiceClient } from '@recete/shared';
import { detectLanguage } from '../i18n.js';
import { normalizeLangCode } from './utils.js';
import type { ShopSettingsRecord } from './types.js';

export class ShopSettingsService {
  async getOrCreate(shopId: string, seedTextForLanguage?: string): Promise<ShopSettingsRecord> {
    const svc = getSupabaseServiceClient();
    const { data: existing, error: getError } = await svc
      .from('shop_settings')
      .select('shop_id, default_source_lang, enabled_langs, multi_lang_rag_enabled')
      .eq('shop_id', shopId)
      .maybeSingle();
    if (getError) throw new Error(`shop_settings query failed: ${getError.message}`);

    if (existing) {
      return {
        shop_id: existing.shop_id,
        default_source_lang: normalizeLangCode(existing.default_source_lang),
        enabled_langs: Array.isArray(existing.enabled_langs) ? existing.enabled_langs.map((x: any) => normalizeLangCode(String(x))) : ['en'],
        multi_lang_rag_enabled: Boolean(existing.multi_lang_rag_enabled),
      };
    }

    const inferred = seedTextForLanguage ? detectLanguage(seedTextForLanguage) : 'en';
    const defaultLang = normalizeLangCode(inferred);
    const enabledLangs = [defaultLang];
    const { data: inserted, error: insErr } = await svc
      .from('shop_settings')
      .insert({
        shop_id: shopId,
        default_source_lang: defaultLang,
        enabled_langs: enabledLangs,
        multi_lang_rag_enabled: false,
      })
      .select('shop_id, default_source_lang, enabled_langs, multi_lang_rag_enabled')
      .single();
    if (insErr) throw new Error(`shop_settings insert failed: ${insErr.message}`);
    return {
      shop_id: inserted.shop_id,
      default_source_lang: normalizeLangCode(inserted.default_source_lang),
      enabled_langs: Array.isArray(inserted.enabled_langs) ? inserted.enabled_langs.map((x: any) => normalizeLangCode(String(x))) : enabledLangs,
      multi_lang_rag_enabled: Boolean(inserted.multi_lang_rag_enabled),
    };
  }
}

