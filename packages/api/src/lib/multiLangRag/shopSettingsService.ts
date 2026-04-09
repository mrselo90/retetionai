import { getSupabaseServiceClient, logger } from '@recete/shared';
import { detectLanguage } from '../i18n.js';
import { normalizeLangCode } from './utils.js';
import type { ShopSettingsRecord } from './types.js';

export class ShopSettingsService {
  private normalizeEnabledLangs(value: unknown): string[] {
    const normalized = Array.isArray(value)
      ? value.map((x: any) => normalizeLangCode(String(x))).filter(Boolean)
      : ['en'];
    return normalized.length > 0 ? [...new Set(normalized)] : ['en'];
  }

  private async ensureAlwaysEnabled(
    shopId: string,
    current: { default_source_lang?: string | null; enabled_langs?: unknown },
  ): Promise<void> {
    const svc = getSupabaseServiceClient();
    const enabledLangs = this.normalizeEnabledLangs(current.enabled_langs);
    const { error } = await svc
      .from('shop_settings')
      .upsert(
        {
          shop_id: shopId,
          default_source_lang: normalizeLangCode(current.default_source_lang || 'en'),
          enabled_langs: enabledLangs,
          multi_lang_rag_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'shop_id' }
      );
    if (error) {
      logger.warn({ error, shopId }, 'shop_settings auto-enable failed; continuing with forced true in memory');
    }
  }

  private buildFallbackSettings(shopId: string, seedTextForLanguage?: string): ShopSettingsRecord {
    const inferred = seedTextForLanguage ? detectLanguage(seedTextForLanguage) : 'en';
    const defaultLang = normalizeLangCode(inferred);
    return {
      shop_id: shopId,
      default_source_lang: defaultLang,
      enabled_langs: ['en'],
      multi_lang_rag_enabled: true,
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
      if (!existing.multi_lang_rag_enabled) {
        await this.ensureAlwaysEnabled(shopId, existing);
      }
      return {
        shop_id: existing.shop_id,
        default_source_lang: normalizeLangCode(existing.default_source_lang),
        enabled_langs: this.normalizeEnabledLangs(existing.enabled_langs),
        multi_lang_rag_enabled: true,
      };
    }

    const fallback = this.buildFallbackSettings(shopId, seedTextForLanguage);
    const { data: inserted, error: insErr } = await svc
      .from('shop_settings')
      .insert({
        shop_id: shopId,
        default_source_lang: fallback.default_source_lang,
        enabled_langs: fallback.enabled_langs,
        multi_lang_rag_enabled: true,
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
      enabled_langs: this.normalizeEnabledLangs(inserted.enabled_langs),
      multi_lang_rag_enabled: true,
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

    const nextEnabledFinal = [...new Set(nextEnabled)];
    const nextEnabledFiltered = nextEnabledFinal.filter(Boolean);
    const nextEnabledSafe = nextEnabledFiltered.length > 0 ? nextEnabledFiltered : ['en'];

    const svc = getSupabaseServiceClient();
    const { data, error } = await svc
      .from('shop_settings')
      .upsert(
        {
          shop_id: shopId,
          default_source_lang: nextDefault,
          enabled_langs: nextEnabledSafe,
          multi_lang_rag_enabled: true,
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
      enabled_langs: this.normalizeEnabledLangs(data.enabled_langs),
      multi_lang_rag_enabled: true,
    };
  }
}
