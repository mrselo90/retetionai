import { getSupabaseServiceClient, logger } from '@recete/shared';

type Pricing = {
  inputPer1M?: number;
  outputPer1M?: number;
  per1M?: number; // embeddings
};

// Keep conservative/static pricing map; easy to update without schema changes.
const OPENAI_PRICING_USD_PER_1M_TOKENS: Record<string, Pricing> = {
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4o': { inputPer1M: 5.0, outputPer1M: 15.0 },
  'gpt-4.1-mini': { inputPer1M: 0.4, outputPer1M: 1.6 },
  'gpt-4.1': { inputPer1M: 2.0, outputPer1M: 8.0 },
  'text-embedding-3-small': { per1M: 0.02 },
  'text-embedding-3-large': { per1M: 0.13 },
};

export function estimateAiCostUsd(input: {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}): number {
  const pricing = OPENAI_PRICING_USD_PER_1M_TOKENS[input.model];
  if (!pricing) return 0;
  if (typeof pricing.per1M === 'number') {
    const total = Math.max(0, input.totalTokens ?? (input.promptTokens ?? 0) + (input.completionTokens ?? 0));
    return Number(((total / 1_000_000) * pricing.per1M).toFixed(8));
  }
  const p = Math.max(0, input.promptTokens ?? 0);
  const c = Math.max(0, input.completionTokens ?? 0);
  const cost = ((p / 1_000_000) * (pricing.inputPer1M || 0)) + ((c / 1_000_000) * (pricing.outputPer1M || 0));
  return Number(cost.toFixed(8));
}

export async function trackAiUsageEvent(input: {
  merchantId: string;
  feature: string;
  model: string;
  requestKind: 'chat_completion' | 'embedding' | 'translation' | 'enrich' | 'other';
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!input.merchantId || !input.model) return;
    const prompt = Math.max(0, Math.floor(input.promptTokens || 0));
    const completion = Math.max(0, Math.floor(input.completionTokens || 0));
    const total = Math.max(0, Math.floor(input.totalTokens || (prompt + completion)));
    const estimated = estimateAiCostUsd({
      model: input.model,
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: total,
    });

    const svc = getSupabaseServiceClient();
    const { error } = await svc.from('ai_usage_events').insert({
      merchant_id: input.merchantId,
      provider: 'openai',
      feature: input.feature,
      model: input.model,
      request_kind: input.requestKind,
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: total,
      estimated_cost_usd: estimated,
      metadata: input.metadata || {},
    });

    if (error) {
      // Migration may not be applied yet.
      if (error.code !== '42P01' && error.code !== '42703') {
        logger.warn({ error, input }, 'trackAiUsageEvent failed');
      }
    }
  } catch (error) {
    logger.warn({ error, input }, 'trackAiUsageEvent exception');
  }
}

