import { getOpenAIClient } from '../openaiClient.js';
import { logger } from '@recete/shared';
import { getDefaultLlmModel } from '../runtimeModelSettings.js';
import { trackAiUsageEvent } from '../aiUsageEvents.js';
import {
  type EnrichProductResult,
  formatProductFactsForRAG,
  type ProductFacts,
  tryParseProductFacts,
  validateProductFactsBusinessRules,
} from './productFacts.js';

interface EnrichContext {
  rawSections?: Record<string, string | undefined>;
  merchantId?: string;
  productId?: string;
  sourceType?: string;
}

/**
 * Enriches raw scraped product text to be more search-friendly for RAG.
 * Uses OpenAI to synthesize a structured, keyword-rich summary.
 */
export async function enrichProductData(
  rawText: string,
  productTitle: string,
  context?: EnrichContext
): Promise<string> {
  const result = await enrichProductDataDetailed(rawText, productTitle, context);
  return result.enrichedText;
}

export async function enrichProductDataDetailed(
  rawText: string,
  productTitle: string,
  context?: EnrichContext
): Promise<EnrichProductResult> {
  if (!rawText || rawText.trim().length === 0) {
    return {
      enrichedText: rawText,
      facts: null,
      enrichmentMode: 'raw_fallback',
    };
  }

  try {
    const openai = getOpenAIClient();
    const model = await getDefaultLlmModel();
    const sectionHints = context?.rawSections
      ? Object.entries(context.rawSections)
          .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
          .map(([k, v]) => `${k}: ${String(v).slice(0, 1200)}`)
          .join('\n')
      : '';

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            "You are an expert cosmetics product data extraction AI for RAG systems.\n" +
            "Extract factual product information from noisy scraped content and return ONLY valid JSON.\n\n" +
            "Rules:\n" +
            "1. Preserve source language in values (TR/EN/HU). Do NOT translate.\n" +
            "2. Do not invent facts. If unknown, leave null/empty arrays and add to unknowns.\n" +
            "3. Prioritize cosmetics-relevant fields: ingredients, active ingredients, usage, warnings, skin type, volume.\n" +
            "4. Include short evidence quotes copied from source text when possible.\n" +
            "5. No markdown, no explanation, JSON only.\n\n" +
            "Return this schema exactly:\n" +
            "{\n" +
            '  "schema_version": 1,\n' +
            '  "detected_language": "tr|en|hu",\n' +
            '  "product_identity": {"title": string, "brand": string|null, "product_type": string|null, "variant": string|null, "volume_value": number|null, "volume_unit": string|null},\n' +
            '  "target_skin_types": string[],\n' +
            '  "ingredients": string[],\n' +
            '  "active_ingredients": string[],\n' +
            '  "benefits": string[],\n' +
            '  "usage_steps": string[],\n' +
            '  "frequency": string|null,\n' +
            '  "warnings": string[],\n' +
            '  "claims": string[],\n' +
            '  "unknowns": string[],\n' +
            '  "evidence_quotes": string[]\n' +
            "}"
        },
        {
          role: 'user',
          content:
            `Product Title: ${productTitle}\n\n` +
            (sectionHints ? `Extracted Sections (high confidence hints):\n${sectionHints}\n\n` : '') +
            `Raw Scraped Text:\n${rawText.slice(0, 15000)}`
        }
      ],
      temperature: 0.1,
      max_tokens: 1500,
    });
    if (context?.merchantId) {
      void trackAiUsageEvent({
        merchantId: context.merchantId,
        feature: 'product_enrich_structured',
        model,
        requestKind: 'enrich',
        promptTokens: (response as any).usage?.prompt_tokens || 0,
        completionTokens: (response as any).usage?.completion_tokens || 0,
        totalTokens: (response as any).usage?.total_tokens || 0,
        metadata: {
          productId: context.productId || null,
          sourceType: context.sourceType || null,
          stage: 'structured_extract',
        },
      });
    }

    const modelText = response.choices[0]?.message?.content?.trim() || '';
    const facts = tryParseProductFacts(modelText);
    if (facts) {
      const ruleErrors = validateProductFactsBusinessRules(facts);
      if (ruleErrors.length === 0) {
        return {
          enrichedText: formatProductFactsForRAG(facts),
          facts,
          enrichmentMode: 'structured_facts',
        };
      }
      logger.warn({ productTitle, ruleErrors }, 'Product facts extraction failed business validation; falling back to summary enrichment');
      return await fallbackSummaryEnrichment(openai, rawText, productTitle, facts, ruleErrors, model, context);
    } else {
      logger.warn({ productTitle }, 'Product facts extraction JSON parse/validation failed; falling back to summary enrichment');
    }
    return await fallbackSummaryEnrichment(openai, rawText, productTitle, null, ['JSON parse/validation failed'], model, context);
  } catch (error) {
    logger.error({ error, productTitle }, 'Failed to enrich product data');
    // Fallback to raw text if LLM call fails
    return {
      enrichedText: rawText,
      facts: null,
      enrichmentMode: 'raw_fallback',
    };
  }
}

async function fallbackSummaryEnrichment(
  openai: ReturnType<typeof getOpenAIClient>,
  rawText: string,
  productTitle: string,
  facts: ProductFacts | null,
  factsValidationErrors: string[],
  model: string,
  context?: EnrichContext
): Promise<EnrichProductResult> {
  const fallback = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: "You are an expert e-commerce data enrichment AI. Convert noisy product page text into a clean, structured, keyword-rich summary for retrieval. Preserve original language. Do not invent facts. Output only enriched text.",
      },
      {
        role: 'user',
        content: `Product Title: ${productTitle}\n\nRaw Scraped Text:\n${rawText.slice(0, 15000)}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 1200,
  });
  if (context?.merchantId) {
    void trackAiUsageEvent({
      merchantId: context.merchantId,
      feature: 'product_enrich_summary_fallback',
      model,
      requestKind: 'enrich',
      promptTokens: (fallback as any).usage?.prompt_tokens || 0,
      completionTokens: (fallback as any).usage?.completion_tokens || 0,
      totalTokens: (fallback as any).usage?.total_tokens || 0,
      metadata: {
        productId: context.productId || null,
        sourceType: context.sourceType || null,
        stage: 'summary_fallback',
      },
    });
  }

  return {
    enrichedText: fallback.choices[0]?.message?.content?.trim() || rawText,
    facts,
    factsValidationErrors,
    enrichmentMode: 'summary_fallback',
  };
}
