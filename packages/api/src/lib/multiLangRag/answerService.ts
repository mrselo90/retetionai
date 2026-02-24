import { getSupabaseServiceClient, logger } from '@recete/shared';
import { detectLanguage, type SupportedLanguage } from '../i18n.js';
import { getOpenAIClient } from '../openaiClient.js';
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
      // Best-effort placeholder until live commerce fetch is wired for this endpoint.
      const base = userLang === 'tr'
        ? `Canlı fiyat/stok bilgisini bu test endpoint'inden doğrulayamıyorum. Lütfen Shopify canlı verisini kontrol edin. Kontrol zamanı: ${ts}`
        : userLang === 'hu'
          ? `Ezen az endpointen nem tudok élő ár/készlet adatot ellenőrizni. Kérjük, ellenőrizze a Shopify élő adatát. Ellenőrzés ideje: ${ts}`
          : `I can't verify live price/stock from this endpoint. Please check Shopify live data. Checked at: ${ts}`;
      answerText = base;
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

