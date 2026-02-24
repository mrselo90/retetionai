import type { SupportedLanguage } from './i18n.js';
import type { ProductFactSnapshot } from './productFactsQuery.js';

export interface ProductFactsPlannerOptions {
  responseLength?: 'short' | 'medium' | 'long' | string;
  includeEvidenceQuote?: boolean;
}

export interface PlannedFactAnswer {
  answer: string;
  queryType: 'volume' | 'ingredients' | 'active_ingredients' | 'skin_type' | 'usage' | 'warnings';
  usedProductId: string;
  usedFactKeys: string[];
  evidenceQuotesUsed?: string[];
  direct: true;
}

type UsageSubtype = 'how' | 'frequency' | 'general';

function detectFactQueryType(query: string): PlannedFactAnswer['queryType'] | null {
  const q = query.toLowerCase();
  if (/\b(ml|gram|g |oz|volume|kaç ml|hány ml)\b/i.test(q)) return 'volume';
  if (/\b(active ingredients|hatóanyag|aktif içerik)\b/i.test(q)) return 'active_ingredients';
  if (/\b(ingredients|inci|összetev|içerik|i̇çerik|parfüm|fragrance|illatanyag)\b/i.test(q)) return 'ingredients';
  if (/\b(how to use|directions|usage|nasıl kullan|kullanım|használat|alkalmaz|ne sıklıkla|kaç kez|milyen gyakran|how often|frequency)\b/i.test(q)) {
    return 'usage';
  }
  if (/\b(warning|caution|uyarı|dikkat|figyelmezt|avoid contact|göz(e)? kaç|szem(ébe|be) kerül|allergy|alerji|allergia)\b/i.test(q)) {
    return 'warnings';
  }
  if (/\b(skin|cilt|bőr|suitable|uygun|megfelelő|sensitive|sensitive skin|érzékeny)\b/i.test(q)) return 'skin_type';
  return null;
}

function detectUsageSubtype(query: string): UsageSubtype {
  const q = query.toLowerCase();
  if (/\b(kaç kez|ne sıklıkla|günde|how often|frequency|twice daily|daily|hányszor|milyen gyakran|naponta)\b/i.test(q)) {
    return 'frequency';
  }
  if (/^(nasıl|nasil|how|hogyan)\b/i.test(q) || /\b(nasıl kullan|how to use|directions|használat|alkalmaz)\b/i.test(q)) {
    return 'how';
  }
  return 'general';
}

function pickSnapshot(snapshots: ProductFactSnapshot[], query: string): ProductFactSnapshot | null {
  if (snapshots.length === 0) return null;
  if (snapshots.length === 1) return snapshots[0];
  const q = query.toLowerCase();
  const byName = snapshots.find((s) => q.includes((s.productName || '').toLowerCase()));
  return byName || null; // avoid arbitrary choice when ambiguous
}

function listStr(values: string[], lang: SupportedLanguage): string {
  if (values.length === 0) return '';
  if (lang === 'tr') return values.join(', ');
  if (lang === 'hu') return values.join(', ');
  return values.join(', ');
}

function noInfo(lang: SupportedLanguage, productName: string, topic: string): string {
  if (lang === 'tr') return `${productName} için ${topic} bilgisi elimde net olarak yok. Ambalaj üzerindeki ürün bilgisini kontrol etmenizi öneririm.`;
  if (lang === 'hu') return `A(z) ${productName} termékhez nem látok egyértelmű ${topic} információt. Kérem, ellenőrizze a csomagoláson szereplő adatokat.`;
  return `I don't have clear ${topic} information for ${productName}. Please check the product packaging details.`;
}

function lengthCaps(responseLength?: string): { listMax: number; usageStepsMax: number } {
  if (responseLength === 'short') return { listMax: 5, usageStepsMax: 2 };
  if (responseLength === 'long') return { listMax: 12, usageStepsMax: 5 };
  return { listMax: 8, usageStepsMax: 4 };
}

function pickEvidenceQuotes(
  snap: ProductFactSnapshot,
  queryType: PlannedFactAnswer['queryType'],
  maxQuotes: number = 1
): string[] {
  const preferred = snap.evidence
    .filter((e) => {
      const fk = (e.factKey || '').toLowerCase();
      if (!fk) return true;
      if (queryType === 'volume') return /volume|identity/.test(fk);
      if (queryType === 'ingredients') return /ingredient|inci/.test(fk);
      if (queryType === 'active_ingredients') return /active|ingredient/.test(fk);
      if (queryType === 'usage') return /usage|frequency/.test(fk);
      if (queryType === 'warnings') return /warning|caution/.test(fk);
      if (queryType === 'skin_type') return /skin/.test(fk);
      return true;
    })
    .map((e) => e.quote.trim())
    .filter(Boolean);
  return [...new Set(preferred)].slice(0, maxQuotes);
}

function evidenceSuffix(lang: SupportedLanguage, quotes: string[]): string {
  if (!quotes.length) return '';
  const q = quotes[0].slice(0, 180);
  if (lang === 'tr') return ` Kaynak notu: "${q}"`;
  if (lang === 'hu') return ` Forrásrészlet: "${q}"`;
  return ` Source note: "${q}"`;
}

function usageAnswer(lang: SupportedLanguage, productName: string, usageSteps: string[], frequency?: string | null): string {
  const stepsPart = usageSteps.length
    ? (lang === 'tr'
        ? `Kullanım adımları: ${usageSteps.slice(0, 4).map((s, i) => `${i + 1}) ${s}`).join(' ')}`
        : lang === 'hu'
          ? `Használati lépések: ${usageSteps.slice(0, 4).map((s, i) => `${i + 1}) ${s}`).join(' ')}`
          : `Usage steps: ${usageSteps.slice(0, 4).map((s, i) => `${i + 1}) ${s}`).join(' ')}`)
    : '';
  const freqPart = frequency
    ? (lang === 'tr'
        ? ` Sıklık: ${frequency}.`
        : lang === 'hu'
          ? ` Gyakoriság: ${frequency}.`
          : ` Frequency: ${frequency}.`)
    : '';

  if (lang === 'tr') return `${productName} için bulduğum kullanım bilgisi şöyle. ${stepsPart}${freqPart}`.trim();
  if (lang === 'hu') return `A(z) ${productName} termékhez ezt a használati információt találtam. ${stepsPart}${freqPart}`.trim();
  return `For ${productName}, this is the usage information I found. ${stepsPart}${freqPart}`.trim();
}

function usageFrequencyFirstAnswer(
  lang: SupportedLanguage,
  productName: string,
  frequency?: string | null,
  usageSteps: string[] = []
): string {
  if (frequency) {
    if (lang === 'tr') return `${productName} için gördüğüm kullanım sıklığı: ${frequency}.`;
    if (lang === 'hu') return `A(z) ${productName} terméknél látott használati gyakoriság: ${frequency}.`;
    return `The usage frequency I can see for ${productName} is: ${frequency}.`;
  }
  if (usageSteps.length > 0) {
    if (lang === 'tr') return `${productName} için net bir sıklık bilgisi görmüyorum, ancak kullanım adımlarını paylaşabilirim.`;
    if (lang === 'hu') return `A(z) ${productName} terméknél nem látok egyértelmű gyakoriságot, de a használati lépéseket meg tudom osztani.`;
    return `I don't see a clear frequency for ${productName}, but I can share the usage steps.`;
  }
  return noInfo(lang, productName, lang === 'tr' ? 'kullanım sıklığı' : lang === 'hu' ? 'használati gyakoriság' : 'usage frequency');
}

function onboardingUsageLooksRequested(query: string): boolean {
  const q = query.toLowerCase();
  return /usage steps, frequency, and warnings|kullanım adımları, kullanım sıklığı ve uyarılar|használati lépések, gyakoriság és figyelmeztetések/i.test(q);
}

function warningsSnippetForUsage(lang: SupportedLanguage, warnings: string[], maxItems: number): string {
  const list = warnings.slice(0, maxItems).filter(Boolean);
  if (!list.length) return '';
  if (lang === 'tr') return ` Önemli uyarılar: ${list.join(' ; ')}.`;
  if (lang === 'hu') return ` Fontos figyelmeztetések: ${list.join(' ; ')}.`;
  return ` Important warnings: ${list.join(' ; ')}.`;
}

function warningsAnswer(lang: SupportedLanguage, productName: string, warnings: string[]): string {
  const list = warnings.slice(0, 5);
  if (lang === 'tr') return `${productName} için gördüğüm uyarılar: ${list.join(' ; ')}.`;
  if (lang === 'hu') return `A(z) ${productName} terméknél ezeket a figyelmeztetéseket látom: ${list.join(' ; ')}.`;
  return `Warnings I can see for ${productName}: ${list.join(' ; ')}.`;
}

type WarningSubtype = 'eye_contact' | 'irritation' | 'general';

function detectWarningSubtype(query: string): WarningSubtype {
  const q = query.toLowerCase();
  if (/\b(göz(e)?|eye|szem).*(kaç|contact|kerül)|avoid contact with eyes\b/i.test(q)) return 'eye_contact';
  if (/\b(kızar|yanma|tahriş|irritation|redness|burning|allerg|allergia|allergy|piros)\b/i.test(q)) return 'irritation';
  return 'general';
}

function warningActionHint(lang: SupportedLanguage, subtype: WarningSubtype): string {
  if (subtype === 'eye_contact') {
    if (lang === 'tr') return 'Gözle temasta ürün etiketindeki uyarıları takip etmenizi ve bölgeyi nazikçe durulamanızı öneririm.';
    if (lang === 'hu') return 'Szembe kerülés esetén kövesse a termék címkéjén lévő figyelmeztetéseket, és óvatosan öblítse le a területet.';
    return 'If it gets into the eyes, follow the product label warnings and gently rinse the area.';
  }
  if (subtype === 'irritation') {
    if (lang === 'tr') return 'Rahatsızlık olursa kullanımı durdurup ürün etiketindeki uyarıları takip etmeniz en güvenli yaklaşım olur.';
    if (lang === 'hu') return 'Ha irritáció jelentkezik, a legbiztonságosabb, ha abbahagyja a használatot és követi a címkén szereplő figyelmeztetéseket.';
    return 'If irritation occurs, the safest approach is to stop using it and follow the warnings on the product label.';
  }
  if (lang === 'tr') return 'En doğru kullanım için ürün etiketindeki uyarıları esas almanızı öneririm.';
  if (lang === 'hu') return 'A legpontosabb használathoz a termék címkéjén szereplő figyelmeztetéseket érdemes követni.';
  return 'For the most accurate guidance, follow the warnings on the product label.';
}

export function planStructuredFactAnswer(
  query: string,
  lang: SupportedLanguage,
  snapshots: ProductFactSnapshot[],
  options?: ProductFactsPlannerOptions
): PlannedFactAnswer | null {
  const queryType = detectFactQueryType(query);
  if (!queryType) return null;

  const snap = pickSnapshot(snapshots, query);
  if (!snap) return null;

  const facts: any = snap.facts || {};
  const identity = facts.product_identity || {};
  const productName = identity.title || snap.productName || 'Product';
  const caps = lengthCaps(options?.responseLength);
  const quotes = options?.includeEvidenceQuote === false ? [] : pickEvidenceQuotes(snap, queryType, 1);

  if (queryType === 'volume') {
    if (identity.volume_value != null && identity.volume_unit) {
      const answer =
        lang === 'tr'
          ? `${productName} ürününün hacmi ${identity.volume_value} ${identity.volume_unit} olarak görünüyor.`
          : lang === 'hu'
            ? `A(z) ${productName} termék kiszerelése ${identity.volume_value} ${identity.volume_unit}.`
            : `${productName} appears to be ${identity.volume_value} ${identity.volume_unit}.`;
      return {
        answer: answer + evidenceSuffix(lang, quotes),
        queryType,
        usedProductId: snap.productId,
        usedFactKeys: ['product_identity.volume'],
        evidenceQuotesUsed: quotes,
        direct: true,
      };
    }
    return {
      answer: noInfo(lang, productName, lang === 'tr' ? 'hacim' : lang === 'hu' ? 'kiszerelés' : 'volume') + evidenceSuffix(lang, quotes),
      queryType,
      usedProductId: snap.productId,
      usedFactKeys: [],
      evidenceQuotesUsed: quotes,
      direct: true,
    };
  }

  if (queryType === 'ingredients') {
    const ingredients = Array.isArray(facts.ingredients) ? facts.ingredients.map(String).filter(Boolean) : [];
    if (ingredients.length > 0) {
      const answer =
        lang === 'tr'
          ? `${productName} için gördüğüm içerikler: ${listStr(ingredients.slice(0, caps.listMax), lang)}.`
          : lang === 'hu'
            ? `A(z) ${productName} termék összetevői között ezeket látom: ${listStr(ingredients.slice(0, caps.listMax), lang)}.`
            : `For ${productName}, the ingredients I can see are: ${listStr(ingredients.slice(0, caps.listMax), lang)}.`;
      return { answer: answer + evidenceSuffix(lang, quotes), queryType, usedProductId: snap.productId, usedFactKeys: ['ingredients'], evidenceQuotesUsed: quotes, direct: true };
    }
    return { answer: noInfo(lang, productName, lang === 'hu' ? 'összetevő' : lang === 'tr' ? 'içerik' : 'ingredient') + evidenceSuffix(lang, quotes), queryType, usedProductId: snap.productId, usedFactKeys: [], evidenceQuotesUsed: quotes, direct: true };
  }

  if (queryType === 'active_ingredients') {
    const active = Array.isArray(facts.active_ingredients) ? facts.active_ingredients.map(String).filter(Boolean) : [];
    if (active.length > 0) {
      const answer =
        lang === 'tr'
          ? `${productName} için aktif içerikler olarak şunlar görünüyor: ${listStr(active.slice(0, caps.listMax), lang)}.`
          : lang === 'hu'
            ? `A(z) ${productName} terméknél a feltüntetett hatóanyagok: ${listStr(active.slice(0, caps.listMax), lang)}.`
            : `The listed active ingredients for ${productName} are: ${listStr(active.slice(0, caps.listMax), lang)}.`;
      return { answer: answer + evidenceSuffix(lang, quotes), queryType, usedProductId: snap.productId, usedFactKeys: ['active_ingredients'], evidenceQuotesUsed: quotes, direct: true };
    }
    return { answer: noInfo(lang, productName, lang === 'hu' ? 'hatóanyag' : lang === 'tr' ? 'aktif içerik' : 'active ingredient') + evidenceSuffix(lang, quotes), queryType, usedProductId: snap.productId, usedFactKeys: [], evidenceQuotesUsed: quotes, direct: true };
  }

  if (queryType === 'skin_type') {
    const skinTypes = Array.isArray(facts.target_skin_types) ? facts.target_skin_types.map(String).filter(Boolean) : [];
    if (skinTypes.length > 0) {
      const answer =
        lang === 'tr'
          ? `${productName} için uygun cilt tipleri arasında şunlar görünüyor: ${listStr(skinTypes, lang)}.`
          : lang === 'hu'
            ? `A(z) ${productName} terméknél ezek a bőrtípusok szerepelnek: ${listStr(skinTypes, lang)}.`
            : `The listed suitable skin types for ${productName} include: ${listStr(skinTypes, lang)}.`;
      return { answer: answer + evidenceSuffix(lang, quotes), queryType, usedProductId: snap.productId, usedFactKeys: ['target_skin_types'], evidenceQuotesUsed: quotes, direct: true };
    }
    return { answer: noInfo(lang, productName, lang === 'hu' ? 'bőrtípus' : lang === 'tr' ? 'cilt tipi' : 'skin type') + evidenceSuffix(lang, quotes), queryType, usedProductId: snap.productId, usedFactKeys: [], evidenceQuotesUsed: quotes, direct: true };
  }

  if (queryType === 'usage') {
    const usageSteps = Array.isArray(facts.usage_steps) ? facts.usage_steps.map(String).filter(Boolean) : [];
    const frequency = typeof facts.frequency === 'string' ? facts.frequency : null;
    const warnings = Array.isArray(facts.warnings) ? facts.warnings.map(String).filter(Boolean) : [];
    const usageSubtype = detectUsageSubtype(query);
    const shouldIncludeWarningsSnippet = onboardingUsageLooksRequested(query);
    const warningSnippet = shouldIncludeWarningsSnippet ? warningsSnippetForUsage(lang, warnings, Math.min(2, caps.listMax)) : '';
    const usedFactKeys = ['usage_steps', ...(frequency ? ['frequency'] : []), ...(shouldIncludeWarningsSnippet && warnings.length > 0 ? ['warnings'] : [])];
    if (usageSteps.length > 0 || frequency) {
      const baseAnswer =
        usageSubtype === 'frequency'
          ? usageFrequencyFirstAnswer(lang, productName, frequency, usageSteps.slice(0, caps.usageStepsMax))
          : usageAnswer(lang, productName, usageSteps.slice(0, caps.usageStepsMax), frequency);
      return {
        answer: (baseAnswer + warningSnippet).trim() + evidenceSuffix(lang, quotes),
        queryType,
        usedProductId: snap.productId,
        usedFactKeys,
        evidenceQuotesUsed: quotes,
        direct: true,
      };
    }
    return {
      answer: noInfo(lang, productName, lang === 'hu' ? 'használat' : lang === 'tr' ? 'kullanım' : 'usage') + evidenceSuffix(lang, quotes),
      queryType,
      usedProductId: snap.productId,
      usedFactKeys: [],
      evidenceQuotesUsed: quotes,
      direct: true,
    };
  }

  if (queryType === 'warnings') {
    const warnings = Array.isArray(facts.warnings) ? facts.warnings.map(String).filter(Boolean) : [];
    const subtype = detectWarningSubtype(query);
    if (warnings.length > 0) {
      return {
        answer:
          `${warningsAnswer(lang, productName, warnings.slice(0, caps.listMax))} ${warningActionHint(lang, subtype)}`
            .trim() + evidenceSuffix(lang, quotes),
        queryType,
        usedProductId: snap.productId,
        usedFactKeys: ['warnings'],
        evidenceQuotesUsed: quotes,
        direct: true,
      };
    }
    return {
      answer:
        `${noInfo(lang, productName, lang === 'hu' ? 'figyelmeztetés' : lang === 'tr' ? 'uyarı' : 'warning')} ${warningActionHint(lang, subtype)}`
          .trim() + evidenceSuffix(lang, quotes),
      queryType,
      usedProductId: snap.productId,
      usedFactKeys: [],
      evidenceQuotesUsed: quotes,
      direct: true,
    };
  }

  return null;
}
