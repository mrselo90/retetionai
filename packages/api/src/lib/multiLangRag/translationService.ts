import { getOpenAIClient } from '../openaiClient.js';
import { getMultiLangRagFlags } from './config.js';
import { normalizeWhitespace } from './utils.js';
import type { ProductI18nSnapshot } from './types.js';

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

export class TranslationService {
  async translateProductSnapshot(
    snapshot: ProductI18nSnapshot,
    sourceLang: string,
    targetLang: string
  ): Promise<ProductI18nSnapshot> {
    if (sourceLang === targetLang) return snapshot;

    const flags = getMultiLangRagFlags();
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

    const resp = await openai.chat.completions.create({
      model: flags.llmModel,
      temperature: 0,
      max_tokens: 1800,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    });

    const raw = resp.choices[0]?.message?.content?.trim() || '';
    const parsed = JSON.parse(stripFences(raw));

    return {
      title: typeof parsed.title === 'string' ? parsed.title : snapshot.title,
      description_html: typeof parsed.description_html === 'string' ? parsed.description_html : snapshot.description_html,
      specs_json: parsed.specs_json && typeof parsed.specs_json === 'object' ? parsed.specs_json : snapshot.specs_json,
      faq_json: Array.isArray(parsed.faq_json) ? parsed.faq_json : snapshot.faq_json,
    };
  }

  async translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
    if (!text.trim() || sourceLang === targetLang) return text;
    const flags = getMultiLangRagFlags();
    const openai = getOpenAIClient();
    const resp = await openai.chat.completions.create({
      model: flags.llmModel,
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
    return (resp.choices[0]?.message?.content || text).trim();
  }
}

