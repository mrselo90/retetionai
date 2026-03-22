import {
  getSupabaseServiceClient,
  logger,
} from '@recete/shared';
import { detectLanguage, type SupportedLanguage } from './i18n.js';
import { getMerchantBotInfo } from './botInfo.js';
import { getOpenAIClient } from './openaiClient.js';
import { getConversationMemorySettings, getDefaultLlmModel } from './runtimeModelSettings.js';
import { trackAiUsageEvent } from './aiUsageEvents.js';
import { assembleGroundingEvidence } from './groundingAssembler.js';
import { estimateTokenCount } from './embeddings.js';
import {
  buildGroundedMessages,
  buildGroundedPrompt,
  type HistoryMessage,
  type PersonaSettings,
} from './groundedPromptBuilder.js';

export interface GroundedAnswerInput {
  merchantId: string;
  question: string;
  userLang?: string;
  channel: 'api' | 'whatsapp';
  intent?: 'question' | 'return_intent';
  orderId?: string;
  conversationId?: string;
  conversationHistory?: HistoryMessage[];
  merchantName?: string;
  persona?: PersonaSettings;
  botInfo?: Record<string, string>;
  productIds?: string[];
  retrievalQuery?: string;
  plannerQuery?: string;
  runtimeHint?: string;
  topK?: number;
  similarityThreshold?: number;
  preferredSectionTypes?: string[];
  cacheKey?: string;
  cacheTtlSeconds?: number;
  instructionScope?: 'order_only' | 'facts_products';
}

export interface GroundedAnswerOutput {
  answer: string;
  langDetected: string;
  citedProducts: string[];
  latencyMs: number;
  ragContext?: string;
  usedDeterministicFacts: boolean;
  orderScopeSource?: string;
  retrievalLanguage: string;
  retrievalUsedFallback: boolean;
  retrievalFallbackLanguage: string | null;
}

async function loadMerchantPresentation(
  merchantId: string,
  merchantName?: string,
  persona?: PersonaSettings,
  botInfo?: Record<string, string>,
): Promise<{ merchantName: string; persona: PersonaSettings; botInfo: Record<string, string> }> {
  if (merchantName && persona && botInfo) {
    return { merchantName, persona, botInfo };
  }

  const serviceClient = getSupabaseServiceClient();
  const { data: merchant } = await serviceClient
    .from('merchants')
    .select('name, persona_settings')
    .eq('id', merchantId)
    .maybeSingle();

  return {
    merchantName: merchantName || merchant?.name || 'Biz',
    persona: persona || (merchant?.persona_settings as PersonaSettings) || {},
    botInfo: botInfo || await getMerchantBotInfo(merchantId),
  };
}

export async function generateGroundedProductAnswer(
  input: GroundedAnswerInput,
): Promise<GroundedAnswerOutput> {
  const start = Date.now();
  const userLang = (input.userLang || detectLanguage(input.question)) as SupportedLanguage;
  const {
    merchantName,
    persona,
    botInfo,
  } = await loadMerchantPresentation(input.merchantId, input.merchantName, input.persona, input.botInfo);
  const grounding = await assembleGroundingEvidence({
    merchantId: input.merchantId,
    question: input.question,
    userLang,
    orderId: input.orderId,
    productIds: input.productIds,
    retrievalQuery: input.retrievalQuery,
    plannerQuery: input.plannerQuery,
    topK: input.topK,
    similarityThreshold: input.similarityThreshold,
    preferredSectionTypes: input.preferredSectionTypes,
    cacheKey: input.cacheKey,
    cacheTtlSeconds: input.cacheTtlSeconds,
    instructionScope: input.instructionScope,
    responseLength: persona?.response_length,
  });

  if (grounding.usedDeterministicFacts && grounding.deterministicAnswer) {
    return {
      answer: grounding.deterministicAnswer,
      langDetected: userLang,
      citedProducts: grounding.citedProducts,
      latencyMs: Date.now() - start,
      ragContext: grounding.context,
      usedDeterministicFacts: true,
      orderScopeSource: grounding.orderScopeSource,
      retrievalLanguage: grounding.retrievalLanguage,
      retrievalUsedFallback: grounding.retrievalUsedFallback,
      retrievalFallbackLanguage: grounding.retrievalFallbackLanguage,
    };
  }

  const systemPrompt = buildGroundedPrompt({
    merchantName,
    persona,
    intent: input.intent || 'question',
    ragContext: grounding.context,
    botInfo,
    lang: userLang,
    channel: input.channel,
    runtimeHint: input.runtimeHint,
  });

  const memorySettings = await getConversationMemorySettings();
  const recentHistory = input.conversationHistory
    ? (
        memorySettings.mode === 'full'
      ? input.conversationHistory
          : input.conversationHistory.slice(-Math.max(1, memorySettings.count))
      )
    : [];

  // Model context limits (conservative, leaving room for overhead)
  const MODEL_CONTEXT_LIMITS: Record<string, number> = {
    'gpt-4o-mini': 128_000,
    'gpt-4o': 128_000,
    'gpt-4.1-mini': 1_000_000,
    'gpt-4.1': 1_000_000,
  };
  const MAX_RESPONSE_TOKENS = 500; // matches max_tokens below
  const OVERHEAD_TOKENS = 200; // for message framing, role tokens, etc.

  const client = getOpenAIClient();
  const model = await getDefaultLlmModel();
  const contextLimit = MODEL_CONTEXT_LIMITS[model] ?? 128_000;
  const tokenBudget = contextLimit - MAX_RESPONSE_TOKENS - OVERHEAD_TOKENS;

  let effectiveSystemPrompt = systemPrompt;
  let effectiveHistory = recentHistory;

  const totalEstimate = () =>
    estimateTokenCount(effectiveSystemPrompt) +
    effectiveHistory.reduce((sum, m) => sum + estimateTokenCount(m.content || ''), 0) +
    estimateTokenCount(input.question);

  // Step 1: Trim conversation history (oldest first) if over budget
  while (effectiveHistory.length > 0 && totalEstimate() > tokenBudget) {
    effectiveHistory = effectiveHistory.slice(1);
  }

  // Step 2: If still over budget, truncate RAG context within the system prompt
  if (totalEstimate() > tokenBudget && grounding.context) {
    const overageChars = Math.ceil((totalEstimate() - tokenBudget) * 3);
    const truncatedContext = grounding.context.slice(0, Math.max(200, grounding.context.length - overageChars));
    effectiveSystemPrompt = buildGroundedPrompt({
      merchantName,
      persona,
      intent: input.intent || 'question',
      ragContext: truncatedContext + '\n[... truncated for length]',
      botInfo,
      lang: userLang,
      channel: input.channel,
      runtimeHint: input.runtimeHint,
    });
    logger.warn(
      { merchantId: input.merchantId, originalTokens: estimateTokenCount(systemPrompt), truncatedTokens: estimateTokenCount(effectiveSystemPrompt) },
      'token_budget_guard_truncated_context',
    );
  }

  const messages = buildGroundedMessages(effectiveSystemPrompt, input.question, effectiveHistory);

  const completion = await client.chat.completions.create({
    model,
    temperature: persona?.temperature || 0.2,
    max_tokens: MAX_RESPONSE_TOKENS,
    messages,
  });

  void trackAiUsageEvent({
    merchantId: input.merchantId,
    feature: 'grounded_answer',
    model,
    requestKind: 'chat_completion',
    promptTokens: (completion as any).usage?.prompt_tokens || 0,
    completionTokens: (completion as any).usage?.completion_tokens || 0,
    totalTokens: (completion as any).usage?.total_tokens || 0,
    metadata: {
      channel: input.channel,
      intent: input.intent || 'question',
      conversationId: input.conversationId || null,
      orderId: input.orderId || null,
      citedProducts: grounding.citedProducts,
      usedDeterministicFacts: false,
      orderScopeSource: grounding.orderScopeSource || null,
      retrievalLanguage: grounding.retrievalLanguage,
      retrievalUsedFallback: grounding.retrievalUsedFallback,
      retrievalFallbackLanguage: grounding.retrievalFallbackLanguage,
    },
  });

  const answer = completion.choices[0]?.message?.content?.trim()
    || (
      userLang === 'tr'
        ? 'Bu soruya güvenilir şekilde cevap verecek kadar ürün bilgisi bulamadım. Hangi ürünü kastettiğinizi netleştirir misiniz?'
        : userLang === 'hu'
          ? 'Nem találtam elég megbízható termékinformációt a válaszhoz. Pontosítaná, melyik termékről van szó?'
          : 'I could not find enough reliable product information to answer that safely. Could you clarify which product you mean?'
    );

  logger.info(
    {
      merchantId: input.merchantId,
      channel: input.channel,
      conversationId: input.conversationId || null,
      orderId: input.orderId || null,
      userLang,
      citedProducts: grounding.citedProducts,
      usedDeterministicFacts: false,
      orderScopeSource: grounding.orderScopeSource || null,
      retrievalLanguage: grounding.retrievalLanguage,
      retrievalUsedFallback: grounding.retrievalUsedFallback,
      retrievalFallbackLanguage: grounding.retrievalFallbackLanguage,
    },
    'grounded_answer_generated',
  );

  return {
    answer,
    langDetected: userLang,
    citedProducts: grounding.citedProducts,
    latencyMs: Date.now() - start,
    ragContext: grounding.context,
    usedDeterministicFacts: false,
    orderScopeSource: grounding.orderScopeSource,
    retrievalLanguage: grounding.retrievalLanguage,
    retrievalUsedFallback: grounding.retrievalUsedFallback,
    retrievalFallbackLanguage: grounding.retrievalFallbackLanguage,
  };
}
