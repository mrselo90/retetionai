import { getOpenAIClient } from '../openaiClient.js';
import { getDefaultLlmModel } from '../runtimeModelSettings.js';
import { normalizeWhitespace } from './utils.js';
import { trackAiUsageEvent } from '../aiUsageEvents.js';
import type { ProductI18nSnapshot } from './types.js';

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

export class TranslationService {
  async translateProductSnapshot(
    snapshot: ProductI18nSnapshot,
    sourceLang: string,
    targetLang: string,
    usageContext?: { merchantId?: string; productId?: string; feature?: string }
  ): Promise<ProductI18nSnapshot> {
    if (sourceLang === targetLang) return snapshot;

    const openai = getOpenAIClient();

    const system = [
      'You translate e-commerce product content into a target language and return strict JSON only.',
      'Do not translate brand names, SKU, model numbers, measurements (cm/mm/kg/ml), numbers, URLs, emails, or code blocks.',
      'Preserve HTML tags in description_html and translate only text nodes.',
      'In specs_json, preserve keys; translate values only.',
      'Return exactly this JSON shape: {"title":"","description_html":"","specs_json":{},"faq_json":[]}',
    ].join(' ');

    const userPayload = {
      source_lang: sourceLang,
      target_lang: targetLang,
      snapshot,
    };

    const model = await getDefaultLlmModel();
    const resp = await openai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 1800,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    });

    const raw = resp.choices[0]?.message?.content?.trim() || '';
    if (usageContext?.merchantId) {
      void trackAiUsageEvent({
        merchantId: usageContext.merchantId,
        feature: usageContext.feature || 'multi_lang_translate_product_snapshot',
        model,
        requestKind: 'translation',
        promptTokens: (resp as any).usage?.prompt_tokens || 0,
        completionTokens: (resp as any).usage?.completion_tokens || 0,
        totalTokens: (resp as any).usage?.total_tokens || 0,
        metadata: {
          sourceLang,
          targetLang,
          productId: usageContext.productId || null,
        },
      });
    }
    const parsed = JSON.parse(stripFences(raw));

    return {
      title: typeof parsed.title === 'string' ? parsed.title : snapshot.title,
      description_html: typeof parsed.description_html === 'string' ? parsed.description_html : snapshot.description_html,
      specs_json: parsed.specs_json && typeof parsed.specs_json === 'object' ? parsed.specs_json : snapshot.specs_json,
      faq_json: Array.isArray(parsed.faq_json) ? parsed.faq_json : snapshot.faq_json,
    };
  }

  async translateText(
    text: string,
    sourceLang: string,
    targetLang: string,
    usageContext?: { merchantId?: string; feature?: string; metadata?: Record<string, unknown> }
  ): Promise<string> {
    if (!text.trim() || sourceLang === targetLang) return text;
    const openai = getOpenAIClient();
    const model = await getDefaultLlmModel();
    const resp = await openai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: 'Translate the text to the target language. Preserve product names, SKUs, codes, measurements, URLs, and numbers. Return plain text only.',
        },
        {
          role: 'user',
          content: JSON.stringify({ source_lang: sourceLang, target_lang: targetLang, text: normalizeWhitespace(text) }),
        },
      ],
    });
    if (usageContext?.merchantId) {
      void trackAiUsageEvent({
        merchantId: usageContext.merchantId,
        feature: usageContext.feature || 'multi_lang_translate_text',
        model,
        requestKind: 'translation',
        promptTokens: (resp as any).usage?.prompt_tokens || 0,
        completionTokens: (resp as any).usage?.completion_tokens || 0,
        totalTokens: (resp as any).usage?.total_tokens || 0,
        metadata: {
          sourceLang,
          targetLang,
          ...(usageContext.metadata || {}),
        },
      });
    }
    return (resp.choices[0]?.message?.content || text).trim();
  }
}
