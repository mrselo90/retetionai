import { getOpenAIClient } from '../openaiClient.js';
import { logger } from '@recete/shared';
import { getDefaultLlmModel } from '../runtimeModelSettings.js';
import { trackAiUsageEvent } from '../aiUsageEvents.js';

/**
 * Drafts the post-delivery customer guidance for products from what the store
 * already wrote about them (title, description, type).
 *
 * Writing guidance for every product by hand was the step merchants stalled on:
 * a store opens the app with a dozen or more products all marked "Needs setup".
 * A draft the merchant can accept or edit turns that into a review.
 */

export interface InstructionDraftInput {
  /** Caller's key for matching the answer back (e.g. the Shopify product id). */
  key: string;
  title: string;
  description?: string;
  productType?: string;
  vendor?: string;
}

export interface InstructionDraft {
  key: string;
  usage_instructions: string;
  prevention_tips: string;
  recipe_summary: string;
}

export const MAX_DRAFTS_PER_REQUEST = 10;
const MAX_DESCRIPTION_CHARS = 2500;

const SYSTEM_PROMPT = `You write short post-purchase guidance that a store's WhatsApp assistant sends to customers after delivery.

For each product, return:
- usage_instructions: 2-4 short sentences on how to start using, set up, or apply the product, and how to care for it. Plain text, no bullet symbols, no markdown.
- prevention_tips: 1-2 short sentences on what to avoid or safety notes. Empty string if nothing relevant.
- recipe_summary: one sentence saying what the product is.

Rules:
- Use only what the title, type and description support, plus common-sense handling for that kind of product. Never invent specifications, ingredients, dosages, sizes or warranty terms.
- No medical, legal or safety-critical instructions beyond general care. For gift cards and other non-physical items, explain how to redeem or use them.
- Write in the same language as the product description; if there is no description, use English.
- Return JSON: {"drafts":[{"key": "...", "usage_instructions": "...", "prevention_tips": "...", "recipe_summary": "..."}]} with one entry per input product, same keys.`;

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(value: unknown, max = 1200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function draftProductInstructions(
  merchantId: string,
  products: InstructionDraftInput[]
): Promise<InstructionDraft[]> {
  const batch = products.slice(0, MAX_DRAFTS_PER_REQUEST).map((p) => ({
    key: String(p.key),
    title: p.title.trim().slice(0, 200),
    type: (p.productType || '').trim().slice(0, 100) || undefined,
    vendor: (p.vendor || '').trim().slice(0, 100) || undefined,
    description: stripHtml(p.description || '').slice(0, MAX_DESCRIPTION_CHARS) || undefined,
  }));
  if (batch.length === 0) return [];

  const model = await getDefaultLlmModel();
  const completion = await getOpenAIClient().chat.completions.create({
    model,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify({ products: batch }) },
    ],
  });

  void trackAiUsageEvent({
    merchantId,
    feature: 'product_instruction_draft',
    model,
    requestKind: 'chat_completion',
    promptTokens: completion.usage?.prompt_tokens || 0,
    completionTokens: completion.usage?.completion_tokens || 0,
    totalTokens: completion.usage?.total_tokens || 0,
    metadata: { products: batch.length },
  }).catch(() => {});

  let parsed: { drafts?: unknown } = {};
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
  } catch (error) {
    logger.warn({ error, merchantId }, 'Instruction draft: model returned invalid JSON');
    return [];
  }

  const wanted = new Set(batch.map((p) => p.key));
  const drafts: InstructionDraft[] = [];
  for (const item of Array.isArray(parsed.drafts) ? parsed.drafts : []) {
    const key = String((item as { key?: unknown })?.key ?? '');
    const usage = clean((item as { usage_instructions?: unknown }).usage_instructions);
    if (!wanted.has(key) || !usage) continue;
    wanted.delete(key);
    drafts.push({
      key,
      usage_instructions: usage,
      prevention_tips: clean((item as { prevention_tips?: unknown }).prevention_tips, 600),
      recipe_summary: clean((item as { recipe_summary?: unknown }).recipe_summary, 300),
    });
  }
  return drafts;
}
