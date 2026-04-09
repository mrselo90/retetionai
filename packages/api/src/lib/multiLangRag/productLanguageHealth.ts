import { ShopSettingsService } from './shopSettingsService.js';
import { normalizeLangCode } from './utils.js';

export interface ProductLanguageHealth {
  sourceLanguage: string | null;
  requiredLanguages: string[];
  translatedLanguages: string[];
  readyLanguages: string[];
  missingLanguages: string[];
  pendingLanguages: string[];
  translationCoverage: number;
  answerCoverage: number;
  state: 'not_started' | 'pending' | 'ready';
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export async function buildProductLanguageHealthMap(
  serviceClient: any,
  merchantId: string,
  products: Array<{ id: string }>,
  options?: { requiredLanguages?: string[] },
): Promise<Map<string, ProductLanguageHealth>> {
  const productIds = products.map((product) => String(product.id)).filter(Boolean);
  const emptyMap = new Map<string, ProductLanguageHealth>();

  if (productIds.length === 0) return emptyMap;

  const settings =
    options?.requiredLanguages?.length
      ? { enabled_langs: options.requiredLanguages }
      : await new ShopSettingsService().getOrCreate(merchantId);
  const requiredLanguages = [
    ...new Set((settings.enabled_langs || []).map((lang) => normalizeLangCode(lang)).filter(Boolean)),
  ];
  const safeRequiredLanguages = requiredLanguages.length > 0 ? requiredLanguages : ['en'];

  const [{ data: i18nRows }, { data: chunkRows }] = await Promise.all([
    serviceClient
      .from('product_i18n')
      .select('product_id, lang, source_lang')
      .eq('shop_id', merchantId)
      .in('product_id', productIds),
    serviceClient
      .from('knowledge_chunks_i18n')
      .select('product_id, language_code')
      .eq('shop_id', merchantId)
      .in('product_id', productIds),
  ]);

  const translatedByProduct = new Map<string, Set<string>>();
  const readyByProduct = new Map<string, Set<string>>();
  const sourceByProduct = new Map<string, string>();

  for (const row of (i18nRows || []) as Array<{ product_id: string; lang?: string | null; source_lang?: string | null }>) {
    const productId = String(row.product_id);
    const lang = normalizeLangCode(row.lang);
    if (!translatedByProduct.has(productId)) translatedByProduct.set(productId, new Set<string>());
    translatedByProduct.get(productId)?.add(lang);
    if (row.source_lang && !sourceByProduct.has(productId)) {
      sourceByProduct.set(productId, normalizeLangCode(row.source_lang));
    }
  }

  for (const row of (chunkRows || []) as Array<{ product_id: string; language_code?: string | null }>) {
    const productId = String(row.product_id);
    const lang = normalizeLangCode(row.language_code);
    if (!readyByProduct.has(productId)) readyByProduct.set(productId, new Set<string>());
    readyByProduct.get(productId)?.add(lang);
  }

  for (const product of products) {
    const productId = String(product.id);
    const translatedLanguages = [...(translatedByProduct.get(productId) || new Set<string>())];
    const readyLanguages = safeRequiredLanguages.filter((lang) => readyByProduct.get(productId)?.has(lang));
    const translatedRequiredLanguages = safeRequiredLanguages.filter((lang) =>
      translatedByProduct.get(productId)?.has(lang),
    );
    const missingLanguages = safeRequiredLanguages.filter((lang) => !readyLanguages.includes(lang));
    const pendingLanguages = translatedRequiredLanguages.filter((lang) => !readyLanguages.includes(lang));
    const state: ProductLanguageHealth['state'] =
      readyLanguages.length === safeRequiredLanguages.length
        ? 'ready'
        : translatedLanguages.length > 0 || readyLanguages.length > 0
          ? 'pending'
          : 'not_started';

    emptyMap.set(productId, {
      sourceLanguage: sourceByProduct.get(productId) || null,
      requiredLanguages: safeRequiredLanguages,
      translatedLanguages,
      readyLanguages,
      missingLanguages,
      pendingLanguages,
      translationCoverage: percent(translatedRequiredLanguages.length, safeRequiredLanguages.length),
      answerCoverage: percent(readyLanguages.length, safeRequiredLanguages.length),
      state,
    });
  }

  return emptyMap;
}
