import { getSupabaseServiceClient, logger } from '@recete/shared';
import { detectLanguage, type SupportedLanguage } from '../i18n.js';
import { getOpenAIClient } from '../openaiClient.js';
import { fetchShopifyLiveProductQuotes } from '../shopify.js';
import { EmbeddingService } from './embeddingService.js';
import { VectorSearchService } from './vectorSearchService.js';
import { TranslationService } from './translationService.js';
import { ShopSettingsService } from './shopSettingsService.js';
import { ProductI18nService } from './productI18nService.js';
import { getMultiLangRagFlags } from './config.js';
import { normalizeLangCode, stripHtmlToText } from './utils.js';

export interface AnswerRequestInput {
  shopId: string;
  question: string;
  userLang?: string;
}

export interface AnswerResponseOutput {
  answer: string;
  lang_detected: string;
  used_fallback: boolean;
  fallback_lang: string | null;
  cited_products: string[];
  latency_ms: number;
}

function evidenceMetrics(scores: number[]): { max: number; avgTop3: number } {
  const top = [...scores].sort((a, b) => b - a);
  return {
    max: top[0] ?? 0,
    avgTop3: top.slice(0, 3).reduce((s, x) => s + x, 0) / Math.max(1, Math.min(3, top.length)),
  };
}

function isPriceOrStockQuestion(q: string): boolean {
  return /\b(price|fiyat|ár|stock|stok|inventory|in stock|készlet)\b/i.test(q);
}

async function getShopifyAuthForMerchant(shopId: string): Promise<{ shop: string; accessToken: string } | null> {
  const svc = getSupabaseServiceClient();
  const { data, error } = await svc
    .from('integrations')
    .select('auth_data,status')
    .eq('merchant_id', shopId)
    .eq('provider', 'shopify')
    .in('status', ['active', 'pending'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const authData = data.auth_data as { shop?: string; access_token?: string } | null;
  if (!authData?.shop || !authData?.access_token) return null;
  return { shop: authData.shop, accessToken: authData.access_token };
}

function formatLiveQuoteAnswer(userLang: string, items: Array<{ name: string; priceLines: string[]; stockLines: string[] }>, ts: string): string {
  if (!items.length) {
    if (userLang === 'tr') return `Canlı fiyat/stok için ürün eşleşmesi bulamadım. Hangi ürünü kastettiğinizi netleştirir misiniz? Kontrol zamanı: ${ts}`;
    if (userLang === 'hu') return `Nem találtam egyező terméket az élő ár/készlet ellenőrzéshez. Pontosítaná, melyik termékről van szó? Ellenőrzés ideje: ${ts}`;
    return `I couldn't match a product for live price/stock verification. Could you clarify which product you mean? Checked at: ${ts}`;
  }
  const intro =
    userLang === 'tr' ? `Canlı Shopify verisine göre (${ts})` :
      userLang === 'hu' ? `Élő Shopify adatok alapján (${ts})` :
        `Based on live Shopify data (${ts})`;
  const lines: string[] = [intro];
  for (const item of items.slice(0, 3)) {
    lines.push(`- ${item.name}`);
    for (const p of item.priceLines.slice(0, 3)) lines.push(`  ${userLang === 'hu' ? 'Ár' : userLang === 'tr' ? 'Fiyat' : 'Price'}: ${p}`);
    for (const s of item.stockLines.slice(0, 3)) lines.push(`  ${userLang === 'hu' ? 'Készlet' : userLang === 'tr' ? 'Stok' : 'Stock'}: ${s}`);
  }
  return lines.join('\n');
}

export class MultiLangRagAnswerService {
  constructor(
    private embeddingService = new EmbeddingService(),
    private vectorSearchService = new VectorSearchService(),
    private translator = new TranslationService(),
    private shopSettingsService = new ShopSettingsService(),
    private productI18nService = new ProductI18nService(),
  ) {}

  async answer(input: AnswerRequestInput): Promise<AnswerResponseOutput> {
    const start = Date.now();
    const flags = getMultiLangRagFlags();
    const timings: Record<string, number> = {};
    const t0 = Date.now();
    const userLang = normalizeLangCode(input.userLang || detectLanguage(input.question));
    timings.detect = Date.now() - t0;

    const t1 = Date.now();
    const settings = await this.shopSettingsService.getOrCreate(input.shopId, input.question);
    const defaultSourceLang = normalizeLangCode(settings.default_source_lang);
    timings.settings = Date.now() - t1;

    const retrieve = async (lang: string, queryText: string) => {
      const tEmbed = Date.now();
      const qEmb = await this.embeddingService.embedText(queryText);
      const embedMs = Date.now() - tEmbed;
      const tSearch = Date.now();
      const rows = await this.vectorSearchService.searchByLanguage({
        shopId: input.shopId,
        lang,
        queryEmbedding: qEmb,
        matchCount: 8,
      });
      const searchMs = Date.now() - tSearch;
      return { rows, embedMs, searchMs };
    };

    const first = await retrieve(userLang, input.question);
    timings.embed_user = first.embedMs;
    timings.retrieve_user = first.searchMs;
    let usedFallback = false;
    let fallbackLang: string | null = null;
    let effectiveLang = userLang;
    let retrievalRows = first.rows;
    let translatedQuestion = input.question;

    const m1 = evidenceMetrics(first.rows.map((r) => r.similarity));
    const weakEvidence = m1.max < flags.minSimilarity && m1.avgTop3 < flags.minSimilarity * 0.92;

    if (weakEvidence && defaultSourceLang && defaultSourceLang !== userLang) {
      const tTrans = Date.now();
      translatedQuestion = await this.translator.translateText(input.question, userLang, defaultSourceLang);
      timings.translate_query = Date.now() - tTrans;
      const second = await retrieve(defaultSourceLang, translatedQuestion);
      timings.embed_fallback = second.embedMs;
      timings.retrieve_fallback = second.searchMs;
      const m2 = evidenceMetrics(second.rows.map((r) => r.similarity));
      if (second.rows.length > 0 && (m2.max >= m1.max || m1.max < flags.minSimilarity)) {
        retrievalRows = second.rows;
        usedFallback = true;
        fallbackLang = defaultSourceLang;
        effectiveLang = defaultSourceLang;
      }
    }

    const citedProductIds = [...new Set(retrievalRows.map((r) => r.productId))];

    const tCtx = Date.now();
    const i18nRows = citedProductIds.length
      ? await this.productI18nService.getProductI18nMany(input.shopId, citedProductIds, effectiveLang)
      : [];
    const i18nByProduct = new Map(i18nRows.map((r: any) => [r.product_id, r]));
    const contextItems = retrievalRows.slice(0, 8).map((row, idx) => {
      const i18n = i18nByProduct.get(row.productId);
      const title = i18n?.title || row.productName || row.title || 'Product';
      const desc = stripHtmlToText(i18n?.description_html || row.descriptionText || '');
      return `[${idx + 1}] ${title}\n${desc.slice(0, 1200)}\n(similarity=${row.similarity.toFixed(3)}, lang=${row.lang})`;
    });
    timings.context = Date.now() - tCtx;

    let answerText = '';
    const tGen = Date.now();
    if (isPriceOrStockQuestion(input.question)) {
      const ts = new Date().toISOString();
      const tLive = Date.now();
      const svc = getSupabaseServiceClient();
      const auth = await getShopifyAuthForMerchant(input.shopId);
      let liveAnswer: string | null = null;
      if (auth && citedProductIds.length) {
        try {
          const { data: localProducts } = await svc
            .from('products')
            .select('id,name,external_id')
            .eq('merchant_id', input.shopId)
            .in('id', citedProductIds);
          const localRows = (localProducts || []) as Array<{ id: string; name?: string; external_id?: string | null }>;
          const extIds = localRows.map((p) => String(p.external_id || '').trim()).filter(Boolean);
          if (extIds.length) {
            const quotes = await fetchShopifyLiveProductQuotes(auth.shop, auth.accessToken, extIds);
            const quoteByExtId = new Map(quotes.map((q) => [q.id, q]));
            const rows = localRows.map((p) => {
              const q = p.external_id ? quoteByExtId.get(String(p.external_id)) : undefined;
              if (!q) return null;
              const priceLines = q.variants.length
                ? q.variants.map((v) => `${v.title || 'Default'} = ${v.price}`)
                : [];
              const stockLines = q.variants.length
                ? q.variants.map((v) => `${v.title || 'Default'} = ${v.inventoryQuantity == null ? 'N/A' : String(v.inventoryQuantity)}`)
                : [];
              return {
                name: p.name || q.title || 'Product',
                priceLines,
                stockLines,
              };
            }).filter(Boolean) as Array<{ name: string; priceLines: string[]; stockLines: string[] }>;
            liveAnswer = formatLiveQuoteAnswer(userLang, rows, ts);
          }
        } catch (err) {
          logger.warn({ err, shopId: input.shopId, citedProductIds }, 'multi_lang_rag_live_quote_fetch_failed');
        }
      }
      if (!liveAnswer) {
        liveAnswer = userLang === 'tr'
          ? `Canlı fiyat/stok için eşleşen Shopify ürünü bulamadım. Hangi ürünü kastettiğinizi netleştirir misiniz? Kontrol zamanı: ${ts}`
          : userLang === 'hu'
            ? `Nem találtam egyező Shopify terméket élő ár/készlet ellenőrzéshez. Pontosítaná a terméket? Ellenőrzés ideje: ${ts}`
            : `I couldn't match a Shopify product for live price/stock verification. Could you clarify which product you mean? Checked at: ${ts}`;
      }
      timings.live_fetch = Date.now() - tLive;
      answerText = liveAnswer;
    } else if (contextItems.length === 0) {
      answerText = userLang === 'tr'
        ? 'Ürün içeriklerinde bu soruya dair ilgili bilgi bulamadım. Hangi ürün olduğunu netleştirir misiniz?'
        : userLang === 'hu'
          ? 'Nem találtam ehhez a kérdéshez kapcsolódó információt a termékleírásokban. Pontosítaná, melyik termékről van szó?'
          : `I couldn't find relevant information for this question in the product content. Could you clarify which product you mean?`;
    } else {
      const openai = getOpenAIClient();
      const promptLang = usedFallback ? effectiveLang : userLang;
      const system = [
        'You are a product Q&A assistant.',
        'Answer using only the provided retrieved product snippets.',
        'If unsure, explicitly say the product content does not contain the answer and ask one clarifying question.',
        'Do not invent guarantees, efficacy claims, or missing product facts.',
        promptLang === 'tr' ? 'Answer in Turkish.' : promptLang === 'hu' ? 'Válaszolj magyarul.' : 'Answer in English.',
      ].join(' ');
      const completion = await openai.chat.completions.create({
        model: flags.llmModel,
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Question: ${usedFallback ? translatedQuestion : input.question}\n\nContext:\n${contextItems.join('\n\n---\n\n')}` },
        ],
      });
      answerText = completion.choices[0]?.message?.content?.trim() || '';
      timings.generate_tokens = completion.usage?.total_tokens || 0;
    }
    timings.generate = Date.now() - tGen;

    if (usedFallback && effectiveLang !== userLang && answerText) {
      const tOut = Date.now();
      answerText = await this.translator.translateText(answerText, effectiveLang, userLang);
      timings.translate_answer = Date.now() - tOut;
    }

    const latency_ms = Date.now() - start;
    logger.info({
      shop_id: input.shopId,
      user_lang: userLang,
      fallback_lang: fallbackLang,
      used_fallback: usedFallback,
      top_scores: retrievalRows.slice(0, 5).map((r) => Number(r.similarity.toFixed(4))),
      cited_products: citedProductIds,
      latency_ms,
      timings,
      token_cost_estimate: timings.generate_tokens ? { total_tokens: timings.generate_tokens } : null,
    }, 'multi_lang_rag_answer');

    return {
      answer: answerText,
      lang_detected: userLang,
      used_fallback: usedFallback,
      fallback_lang: fallbackLang,
      cited_products: citedProductIds,
      latency_ms,
    };
  }
}
