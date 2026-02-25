/**
 * AI Agent utilities
 * Intent classification, RAG retrieval, and LLM generation
 */

import type OpenAI from 'openai';
import { getOpenAIClient } from './openaiClient.js';
import { getConversationMemorySettings, getDefaultLlmModel } from './runtimeModelSettings.js';
import { trackAiUsageEvent } from './aiUsageEvents.js';
import { queryKnowledgeBase, formatRAGResultsForLLM, getOrderProductContextResolved } from './rag.js';
import { getSupabaseServiceClient, logger, getProductInstructionsByProductIds } from '@recete/shared';
import type { ConversationMessage } from './conversation.js';
import {
  checkUserMessageGuardrails,
  checkAIResponseGuardrails,
  checkForHumanHandoffRequest,
  escalateToHuman,
  getSafeResponse,
  type CustomGuardrail,
} from './guardrails.js';
import { processSatisfactionCheck } from './upsell.js';
import { getMerchantBotInfo } from './botInfo.js';
import { isAddonActive, logReturnPreventionAttempt, hasPendingPreventionAttempt, updatePreventionOutcome } from './addons.js';
import {
  detectLanguage,
  getLocalizedHandoffResponse,
  getLocalizedEscalationResponse,
  type SupportedLanguage,
} from './i18n.js';
import { getActiveProductFactsContext, getActiveProductFactsSnapshots } from './productFactsQuery.js';
import { planStructuredFactAnswer } from './productFactsPlanner.js';

export type Intent = 'question' | 'complaint' | 'chat' | 'opt_out' | 'return_intent';

export interface AIResponse {
  intent: Intent;
  response: string;
  ragContext?: string;
  guardrailBlocked?: boolean;
  guardrailReason?: 'crisis_keyword' | 'medical_advice' | 'unsafe_content' | 'custom';
  /** When guardrailReason is 'custom', the name of the custom guardrail that matched */
  guardrailCustomName?: string;
  requiresHuman?: boolean;
  upsellTriggered?: boolean;
  upsellMessage?: string;
}

function getCosmeticRAGConfig(query: string): { profile: string; topK: number; similarityThreshold: number } {
  const q = query.toLowerCase();
  const hasAny = (terms: string[]) => terms.some((t) => q.includes(t));

  if (hasAny(['içerik', 'i̇çerik', 'ingredients', 'inci', 'összetev', 'hatóanyag', 'fragrance', 'parfüm', 'illatanyag'])) {
    return { profile: 'ingredients', topK: 4, similarityThreshold: 0.62 };
  }
  if (hasAny(['nasıl kullan', 'kullanım', 'how to use', 'directions', 'használat', 'alkalmaz'])) {
    return { profile: 'usage', topK: 5, similarityThreshold: 0.58 };
  }
  if (hasAny(['uyarı', 'warning', 'caution', 'figyelmezt', 'allergy', 'alerji', 'allergia', 'eye', 'göz', 'szem'])) {
    return { profile: 'warnings', topK: 5, similarityThreshold: 0.55 };
  }
  if (hasAny(['ml', 'gram', 'g ', 'oz', 'spf', 'ph', '%'])) {
    return { profile: 'specs', topK: 3, similarityThreshold: 0.65 };
  }
  return { profile: 'default', topK: 5, similarityThreshold: 0.6 };
}

function getPreferredSectionsForProfile(profile: string): string[] | undefined {
  switch (profile) {
    case 'ingredients':
      return ['ingredients', 'active_ingredients', 'claims', 'general'];
    case 'usage':
      return ['usage', 'faq', 'general'];
    case 'warnings':
      return ['warnings', 'usage', 'general'];
    case 'specs':
      return ['specs', 'identity', 'general'];
    default:
      return undefined;
  }
}

type PostDeliveryFollowUpType =
  | 'usage_onboarding_no'
  | 'usage_onboarding_yes'
  | 'usage_how'
  | 'usage_frequency'
  | 'warning_signal';

export interface PostDeliveryFollowUpSignal {
  detected: boolean;
  type?: PostDeliveryFollowUpType;
  promoteIntentToQuestion: boolean;
  ragQueryOverride?: string;
  plannerQueryOverride?: string;
  promptHint?: string;
}

function looksLikeUsageOnboardingPrompt(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /kullanmayı biliyor musun|kullanimi biliyor musun|nasıl kullan(acağınızı|acağını|ilir)|uygulama konusunda sorunuz var mı/i.test(t) ||
    /do you know how to use|how are you using your product|questions about usage/i.test(t) ||
    /tudja hogyan kell használni|hogyan használja a terméket|kérdése van a használattal/i.test(t)
  );
}

function buildUsageGuidanceRetrievalQuery(lang: SupportedLanguage): string {
  if (lang === 'tr') return 'Bu ürün nasıl kullanılır, kullanım adımları, kullanım sıklığı ve uyarılar';
  if (lang === 'hu') return 'A termék használata, használati lépések, gyakoriság és figyelmeztetések';
  return 'How to use this product, usage steps, frequency, and warnings';
}

function buildUsageHowRetrievalQuery(lang: SupportedLanguage): string {
  if (lang === 'tr') return 'Bu ürünün kullanım adımları ve nasıl uygulanacağı';
  if (lang === 'hu') return 'A termék használati lépései és alkalmazása';
  return 'Product usage steps and how to apply it';
}

function buildUsageFrequencyRetrievalQuery(lang: SupportedLanguage): string {
  if (lang === 'tr') return 'Bu ürünün kullanım sıklığı, günde kaç kez kullanılır';
  if (lang === 'hu') return 'A termék használatának gyakorisága, naponta hányszor';
  return 'How often to use this product, frequency per day';
}

function buildPostDeliveryAcknowledgementResponse(lang: SupportedLanguage): string {
  if (lang === 'tr') {
    return 'Harika, sevindim. Kullanım sırasında takıldığınız bir nokta olursa yazabilirsiniz; adım adım yardımcı olurum.';
  }
  if (lang === 'hu') {
    return 'Szuper, örülök neki. Ha használat közben kérdése merül fel, írjon nyugodtan, lépésről lépésre segítek.';
  }
  return 'Great, glad to hear that. If anything is unclear while using it, message me and I can help step by step.';
}

export function detectPostDeliveryFollowUpSignal(
  message: string,
  conversationHistory: ConversationMessage[] = []
): PostDeliveryFollowUpSignal {
  const lang = detectLanguage(message);
  const msg = message.trim().toLowerCase();
  const recentAssistantMessages = conversationHistory
    .slice(-6)
    .filter((m) => m.role === 'assistant' || m.role === 'merchant')
    .map((m) => m.content || '');
  const inOnboardingUsageContext = recentAssistantMessages.some(looksLikeUsageOnboardingPrompt);

  if (!inOnboardingUsageContext) {
    return { detected: false, promoteIntentToQuestion: false };
  }

  const isNo =
    /^(hayır|hayir|yok|bilmiyorum|no|not really|not yet|nem|még nem|nem tudom)[.!?]*$/i.test(msg);
  if (isNo) {
    return {
      detected: true,
      type: 'usage_onboarding_no',
      promoteIntentToQuestion: true,
      ragQueryOverride: buildUsageGuidanceRetrievalQuery(lang),
      plannerQueryOverride: buildUsageGuidanceRetrievalQuery(lang),
      promptHint:
        lang === 'tr'
          ? 'Kullanıcı teslim sonrası kullanım desteği istiyor. Önce temel kullanım adımlarını ve sıklığı açıkla, sonra önemli uyarıları belirt.'
          : lang === 'hu'
            ? 'A felhasználó szállítás után használati segítséget kér. Először alap használati lépések és gyakoriság, majd fontos figyelmeztetések.'
            : 'The user is asking for post-delivery usage guidance. Start with basic usage steps and frequency, then key warnings.',
    };
  }

  const isYes =
    /^(evet|olur|tamam|yes|yeah|yep|igen|rendben|ok[ée]?)[:.!? ]*$/i.test(msg);
  if (isYes) {
    return {
      detected: true,
      type: 'usage_onboarding_yes',
      promoteIntentToQuestion: false,
      promptHint:
        lang === 'tr'
          ? 'Kullanıcı kullanım bildiğini söylüyor; kısa onay ver ve gerekirse soru sorabileceğini belirt.'
          : lang === 'hu'
            ? 'A felhasználó azt jelzi, hogy tudja a használatot; röviden erősítsd meg, és jelezd, hogy kérdezhet.'
            : 'The user says they know how to use it; briefly acknowledge and mention they can ask follow-up questions.',
    };
  }

  if (/^(nasıl|nasil|how|hogyan)\b/i.test(msg) || /uygula|apply|alkalmaz/i.test(msg)) {
    return {
      detected: true,
      type: 'usage_how',
      promoteIntentToQuestion: true,
      ragQueryOverride: buildUsageHowRetrievalQuery(lang),
      plannerQueryOverride: buildUsageHowRetrievalQuery(lang),
      promptHint:
        lang === 'tr'
          ? 'Bu, kullanım adımı sorusu olarak ele alınmalı. Adımları net ve sıralı ver.'
          : lang === 'hu'
            ? 'Ezt használati lépés kérdésként kezeld. A lépéseket világosan és sorrendben add meg.'
            : 'Treat this as a usage-steps question. Give clear ordered steps.',
    };
  }

  if (
    /kaç kez|ne sıklıkla|günde|sabah.*akşam|how often|twice daily|daily|hányszor|milyen gyakran|naponta/i.test(msg)
  ) {
    return {
      detected: true,
      type: 'usage_frequency',
      promoteIntentToQuestion: true,
      ragQueryOverride: buildUsageFrequencyRetrievalQuery(lang),
      plannerQueryOverride: buildUsageFrequencyRetrievalQuery(lang),
      promptHint:
        lang === 'tr'
          ? 'Bu, kullanım sıklığı sorusu olarak ele alınmalı. Sıklık bilgisi yoksa açıkça belirt.'
          : lang === 'hu'
            ? 'Ezt használati gyakoriság kérdésként kezeld. Ha nincs adat, mondd ki egyértelműen.'
            : 'Treat this as a usage-frequency question. If frequency is not available, say so clearly.',
    };
  }

  if (/göz|eye|szem|yanma|burn|burning|kızar|irrit|piros/i.test(msg)) {
    return {
      detected: true,
      type: 'warning_signal',
      promoteIntentToQuestion: true,
      ragQueryOverride: message,
      plannerQueryOverride: message,
      promptHint:
        lang === 'tr'
          ? 'Bu bir kullanım sonrası uyarı/reaksiyon sorusu olabilir; güvenli ve ürün uyarılarına dayalı yanıt ver.'
          : lang === 'hu'
            ? 'Ez használat utáni figyelmeztetés/reakció kérdés lehet; biztonságosan, a termék figyelmeztetéseire támaszkodva válaszolj.'
            : 'This may be a post-use warning/reaction question; answer safely and rely on product warnings.',
    };
  }

  return { detected: false, promoteIntentToQuestion: false };
}

/**
 * Classify message intent
 */
export async function classifyIntent(message: string, merchantId?: string): Promise<Intent> {
  try {
    const openai = getOpenAIClient();
    const model = await getDefaultLlmModel();
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an intent classifier for a multilingual customer service chatbot.
Classify the user's message into one of these categories regardless of the language used:
- question: User is asking about product usage, features, or how to use something
- complaint: User is reporting a problem, issue, or dissatisfaction (shipping, packaging, general issues)
- return_intent: User wants to return the product, says they didn't like it, it doesn't work, wants a refund, or expresses dissatisfaction signaling a potential return. Examples include but are not limited to:
  Turkish: "iade", "beğenmedim", "çalışmıyor", "geri göndermek istiyorum"
  English: "return", "refund", "doesn't work", "send it back"
  Hungarian: "visszaküldés", "nem tetszik", "nem működik", "visszaadni", "pénzvisszatérítés"
- chat: General conversation, greetings, or casual messages
- opt_out: User wants to stop receiving messages or unsubscribe

Respond with ONLY the category name.`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      temperature: 0.1, // Low temperature for consistent classification
      max_tokens: 10,
    });
    void trackAiUsageEvent({
      merchantId: merchantId || '',
      feature: 'ai_agent_intent_classification',
      model,
      requestKind: 'chat_completion',
      promptTokens: (response as any).usage?.prompt_tokens || 0,
      completionTokens: (response as any).usage?.completion_tokens || 0,
      totalTokens: (response as any).usage?.total_tokens || 0,
      metadata: { internal: true },
    });

    const intent = response.choices[0]?.message?.content?.trim().toLowerCase();

    if (
      intent === 'question' ||
      intent === 'complaint' ||
      intent === 'chat' ||
      intent === 'opt_out' ||
      intent === 'return_intent'
    ) {
      return intent;
    }

    // Default to chat if classification fails
    return 'chat';
  } catch (error) {
    console.error('Intent classification error:', error);
    return 'chat'; // Default fallback
  }
}

/**
 * Generate AI response using RAG and conversation history
 */
export async function generateAIResponse(
  message: string,
  merchantId: string,
  userId: string,
  conversationId: string,
  orderId?: string,
  conversationHistory: ConversationMessage[] = [],
  personaSettings?: any
): Promise<AIResponse> {
  const openai = getOpenAIClient();
  const llmModel = await getDefaultLlmModel();

  // Step 0: Get merchant (persona + guardrails) so we can run user guardrails with custom rules
  const { data: merchant } = await getSupabaseServiceClient()
    .from('merchants')
    .select('name, persona_settings, guardrail_settings')
    .eq('id', merchantId)
    .single();

  const guardrailSettings = (merchant?.guardrail_settings as { custom_guardrails?: unknown[] }) ?? {};
  const customGuardrails: CustomGuardrail[] = Array.isArray(guardrailSettings.custom_guardrails)
    ? (guardrailSettings.custom_guardrails as CustomGuardrail[])
    : [];

  // Step 1: Check guardrails for user message (system + custom)
  const userGuardrail = checkUserMessageGuardrails(message, { customGuardrails });

  if (!userGuardrail.safe) {
    if (userGuardrail.requiresHuman) {
      await escalateToHuman(userId, conversationId, userGuardrail.reason ?? 'custom', message);
    }

    return {
      intent: 'chat',
      response: userGuardrail.suggestedResponse || getSafeResponse(userGuardrail.reason ?? 'custom'),
      guardrailBlocked: true,
      guardrailReason: userGuardrail.reason,
      guardrailCustomName: userGuardrail.customReason,
      requiresHuman: userGuardrail.requiresHuman,
    };
  }

  // Step 0.5: Check if the customer is explicitly requesting a human agent
  if (checkForHumanHandoffRequest(message)) {
    await escalateToHuman(userId, conversationId, 'human_request', message);
    const lang = detectLanguage(message);
    return {
      intent: 'chat',
      response: getLocalizedHandoffResponse(lang),
      requiresHuman: true,
    };
  }

  // Step 2: Classify intent
  let intent = await classifyIntent(message, merchantId);
  const postDeliveryFollowUp = detectPostDeliveryFollowUpSignal(message, conversationHistory);
  if (postDeliveryFollowUp.detected && postDeliveryFollowUp.promoteIntentToQuestion && intent === 'chat') {
    intent = 'question';
  }

  const persona = merchant?.persona_settings || {};
  const merchantName = merchant?.name || 'Biz';
  const botInfo = await getMerchantBotInfo(merchantId);
  const userLang = detectLanguage(message);

  if (postDeliveryFollowUp.detected && postDeliveryFollowUp.type === 'usage_onboarding_yes') {
    const ack = buildPostDeliveryAcknowledgementResponse(userLang);
    return {
      intent,
      response: ack,
      requiresHuman: false,
    };
  }

  // Return Prevention: if return_intent detected, check if module is active
  let returnPreventionActive = false;
  if (intent === 'return_intent') {
    returnPreventionActive = await isAddonActive(merchantId, 'return_prevention');
    if (!returnPreventionActive) {
      intent = 'complaint'; // fallback to normal complaint flow
    } else {
      // Check if customer is insisting (already had a prevention attempt in this conversation)
      const alreadyAttempted = await hasPendingPreventionAttempt(conversationId);
      if (alreadyAttempted) {
        await updatePreventionOutcome(conversationId, 'escalated');
        await escalateToHuman(userId, conversationId, 'return_intent_insistence', message);
        const lang = detectLanguage(message);
        return {
          intent,
          response: getLocalizedEscalationResponse(lang),
          requiresHuman: true,
        };
      }
    }
  }

  // If the previous state was return_intent but now user is positive, mark as prevented
  if (intent === 'chat' || intent === 'question') {
    try {
      const hasAttempt = await hasPendingPreventionAttempt(conversationId);
      if (hasAttempt) {
        const positiveSignals = [
          // English
          'thank', 'thanks', 'ok', 'okay', 'i\'ll try', 'got it',
          // Turkish
          'teşekkür', 'sağol', 'anladım', 'deneyeceğim', 'tamam',
          // Hungarian
          'köszönöm', 'rendben', 'értem', 'megpróbálom', 'oké',
        ];
        const msgLower = message.toLowerCase();
        if (positiveSignals.some((s) => msgLower.includes(s))) {
          await updatePreventionOutcome(conversationId, 'prevented');
        }
      }
    } catch { /* non-critical */ }
  }

  // product_instructions_scope: 'order_only' | 'rag_products_too' (required from settings)
  const productInstructionsScope = (persona?.product_instructions_scope === 'rag_products_too' ? 'rag_products_too' : 'order_only') as 'order_only' | 'rag_products_too';

  // Step 3: Get RAG context if it's a question OR return_intent (knowledge_chunks + product_instructions)
  let ragContext = '';
  if (intent === 'question' || (intent === 'return_intent' && returnPreventionActive)) {
    try {
      const ragQuery = postDeliveryFollowUp.ragQueryOverride || message;
      let orderProductIds: string[] | undefined;
      let orderScopeSource: string | undefined;
      if (orderId) {
        const orderScope = await getOrderProductContextResolved(orderId, merchantId);
        orderProductIds = orderScope.productIds;
        orderScopeSource = orderScope.source;
      }
      // RAG: semantic search (order products if any).
      // Safety: when an order exists but we cannot resolve products, do NOT broaden to all merchant products.
      const ragConfig = getCosmeticRAGConfig(ragQuery);
      const queryLang = userLang;
      const ragResult =
        orderId && (!orderProductIds || orderProductIds.length === 0)
          ? {
              query: ragQuery,
              results: [],
              totalResults: 0,
              executionTime: 0,
            }
          : await queryKnowledgeBase({
              merchantId,
              query: ragQuery,
              productIds: orderProductIds?.length ? orderProductIds : undefined,
              topK: ragConfig.topK,
              similarityThreshold: ragConfig.similarityThreshold,
              preferredSectionTypes: getPreferredSectionsForProfile(ragConfig.profile),
              preferredLanguage: queryLang,
            });

      logger.info(
        {
          merchantId,
          conversationId,
          orderId,
          intent,
          queryLang,
          postDeliveryFollowUp: postDeliveryFollowUp.detected ? postDeliveryFollowUp.type : null,
          ragQueryOverridden: ragQuery !== message,
          orderScopeSource: orderScopeSource || (orderId ? 'none' : 'not_applicable'),
          ragProfile: ragConfig.profile,
          orderProductIdsCount: orderProductIds?.length || 0,
          ragTotalResults: ragResult.totalResults,
          ragTop: ragResult.results.slice(0, 5).map((r) => ({
            chunkId: r.chunkId,
            productId: r.productId,
            similarity: Number(r.similarity.toFixed(3)),
          })),
          ragExecutionTimeMs: ragResult.executionTime,
        },
        'AI response RAG trace'
      );

      if (ragResult.results.length > 0) {
        ragContext = formatRAGResultsForLLM(ragResult.results);
      }

      // Product IDs to fetch usage instructions for (depends on setting)
      let instructionProductIds: string[] = [];
      if (productInstructionsScope === 'order_only') {
        if (orderId && orderProductIds && orderProductIds.length > 0) {
          instructionProductIds = orderProductIds;
        }
      } else {
        // rag_products_too: include order products and/or products that appeared in RAG results
        const ragProductIds = [...new Set(ragResult.results.map((r) => r.productId))];
        if (orderId && orderProductIds && orderProductIds.length > 0) {
          instructionProductIds = [...new Set([...orderProductIds, ...ragProductIds])];
        } else {
          instructionProductIds = ragProductIds;
        }
      }

      const factsProductIds =
        instructionProductIds.length > 0
          ? instructionProductIds
          : [...new Set(ragResult.results.map((r) => r.productId))];
      let factsSnapshots: Awaited<ReturnType<typeof getActiveProductFactsSnapshots>> = [];
      if (factsProductIds.length > 0) {
        const factsContext = await getActiveProductFactsContext(merchantId, factsProductIds);
        factsSnapshots = await getActiveProductFactsSnapshots(merchantId, factsProductIds);
        if (factsContext.text) {
          ragContext = ragContext
            ? `${factsContext.text}\n\n${ragContext}`
            : factsContext.text;
        }
        logger.info(
          {
            merchantId,
            conversationId,
            orderId,
            factsProductIdsCount: factsProductIds.length,
            factsSnapshotsFound: factsContext.factCount,
          },
          'AI response facts context trace'
        );
      }

      // Deterministic facts-first short-circuit for narrow factual cosmetics queries.
      if (intent === 'question' && factsSnapshots.length > 0) {
        const queryLang = userLang;
        const plannerQuery = postDeliveryFollowUp.plannerQueryOverride || message;
        const planned = planStructuredFactAnswer(plannerQuery, queryLang, factsSnapshots, {
          responseLength: persona?.response_length,
          includeEvidenceQuote: true,
        });
        if (planned) {
          const guard = checkAIResponseGuardrails(planned.answer, {
            customGuardrails,
            languageHint: queryLang,
          });
          const finalAnswer = guard.safe
            ? planned.answer
            : (guard.suggestedResponse || getSafeResponse(guard.reason ?? 'custom'));

          logger.info(
            {
              merchantId,
              conversationId,
              orderId,
              planner: planned.queryType,
              plannerQueryOverridden: plannerQuery !== message,
              postDeliveryFollowUp: postDeliveryFollowUp.detected ? postDeliveryFollowUp.type : null,
              usedProductId: planned.usedProductId,
              usedFactKeys: planned.usedFactKeys,
              evidenceQuotesUsed: planned.evidenceQuotesUsed?.length || 0,
              guardrailBlocked: !guard.safe,
            },
            'AI response deterministic facts-first answer'
          );

          return {
            intent,
            response: finalAnswer,
            ragContext: ragContext || undefined,
            guardrailBlocked: !guard.safe,
            guardrailReason: guard.safe ? undefined : guard.reason,
            guardrailCustomName: guard.safe ? undefined : guard.customReason,
            requiresHuman: guard.safe ? false : guard.requiresHuman,
          };
        }
      }

      if (instructionProductIds.length > 0) {
        const instructions = await getProductInstructionsByProductIds(merchantId, instructionProductIds);
        if (instructions.length > 0) {
          const recipeBlocks = instructions.map((r: any) => {
            let block = `[${r.product_name ?? 'Product'}]\nUsage / Recipe: ${r.usage_instructions}`;
            if (r.recipe_summary) block += `\nSummary: ${r.recipe_summary}`;
            if (r.video_url) block += `\nTutorial Video: ${r.video_url}`;
            if (r.prevention_tips) block += `\nReturn Prevention Tips: ${r.prevention_tips}`;
            return block;
          });
          ragContext += (ragContext ? '\n\n' : '') + '--- Product usage instructions (recipes) ---\n' + recipeBlocks.join('\n\n');
        }
      }
    } catch (error) {
      logger.error({ error }, 'RAG retrieval error');
    }
  }

  // Step 4: Build system prompt (persona + bot info + RAG context)
  const systemPrompt = buildSystemPrompt(
    merchantName,
    persona,
    intent,
    ragContext,
    botInfo
  );
  const runtimeHint = postDeliveryFollowUp.promptHint;
  const finalSystemPrompt = runtimeHint
    ? `${systemPrompt}\nRUNTIME CONVERSATION HINT:\n- ${runtimeHint}\n`
    : systemPrompt;

  // Step 5: Build conversation messages
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: finalSystemPrompt,
    },
  ];

  // Add conversation history (last 10 messages)
  const memorySettings = await getConversationMemorySettings();
  const recentHistory = memorySettings.mode === 'full'
    ? conversationHistory
    : conversationHistory.slice(-Math.max(1, memorySettings.count));
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: message,
  });

  // Step 6: Generate response
  try {
    const response = await openai.chat.completions.create({
      model: llmModel,
      messages,
      temperature: persona.temperature || 0.7,
      max_tokens: 500,
    });
    void trackAiUsageEvent({
      merchantId,
      feature: 'ai_agent_response',
      model: llmModel,
      requestKind: 'chat_completion',
      promptTokens: (response as any).usage?.prompt_tokens || 0,
      completionTokens: (response as any).usage?.completion_tokens || 0,
      totalTokens: (response as any).usage?.total_tokens || 0,
      metadata: {
        conversationId,
        orderId: orderId || null,
        intent,
        ragUsed: Boolean(ragContext),
      },
    });

    let aiResponse = response.choices[0]?.message?.content || '';

    // Step 7: Check guardrails for AI response (system + custom)
    const responseGuardrail = checkAIResponseGuardrails(aiResponse, {
      customGuardrails,
      languageHint: userLang,
    });

    if (!responseGuardrail.safe) {
      aiResponse = responseGuardrail.suggestedResponse || getSafeResponse(responseGuardrail.reason ?? 'custom');

      if (responseGuardrail.requiresHuman) {
        await escalateToHuman(userId, conversationId, responseGuardrail.reason ?? 'custom', aiResponse);
      }

      return {
        intent,
        response: aiResponse,
        ragContext: ragContext || undefined,
        guardrailBlocked: true,
        guardrailReason: responseGuardrail.reason,
        guardrailCustomName: responseGuardrail.customReason,
        requiresHuman: responseGuardrail.requiresHuman,
      };
    }

    // Step 8a: Log return prevention attempt if applicable
    if (intent === 'return_intent' && returnPreventionActive) {
      try {
        await logReturnPreventionAttempt({
          merchantId,
          conversationId,
          userId,
          orderId,
          triggerMessage: message,
          preventionResponse: aiResponse,
        });
      } catch (err) {
        logger.error({ err }, 'Failed to log return prevention attempt');
      }
    }

    // Step 8b: Check for satisfaction and trigger upsell if appropriate
    let upsellResult = null;
    if (intent === 'chat' && orderId) {
      // Check if user is satisfied (positive sentiment in chat)
      try {
        upsellResult = await processSatisfactionCheck(
          userId,
          orderId,
          merchantId,
          message
        );
      } catch (error) {
        console.error('Upsell check error:', error);
        // Continue without upsell
      }
    }

    logger.info(
      {
        merchantId,
        conversationId,
        orderId,
        intent,
        userLang: detectLanguage(message),
        postDeliveryFollowUp: postDeliveryFollowUp.detected ? postDeliveryFollowUp.type : null,
        responseLang: detectLanguage(aiResponse),
        guardrailBlocked: false,
        ragUsed: Boolean(ragContext),
        promptTokens: (response as any).usage?.prompt_tokens,
        completionTokens: (response as any).usage?.completion_tokens,
        totalTokens: (response as any).usage?.total_tokens,
      },
      'AI response generated'
    );

    return {
      intent,
      response: aiResponse,
      ragContext: ragContext || undefined,
      guardrailBlocked: false,
      upsellTriggered: upsellResult?.upsellTriggered || false,
      upsellMessage: upsellResult?.upsellMessage,
    };
  } catch (error) {
    console.error('LLM generation error:', error);
    throw new Error('Failed to generate response');
  }
}

/**
 * Build system prompt with persona, bot info (guidelines/boundaries/recipes), and RAG context
 */
function buildSystemPrompt(
  merchantName: string,
  persona: any,
  intent: Intent,
  ragContext?: string,
  botInfo?: Record<string, string>
): string {
  const botName = persona?.bot_name || 'Recete Asistan';

  let prompt = `You are ${botName}, a professional and helpful customer service assistant for ${merchantName}.\n\n`;

  prompt += `IMPORTANT RULES:
- Always be logical, clear, and helpful in your responses
- Use the provided product information and context to give accurate answers
- If you don't have information, admit it clearly and suggest alternatives
- Be concise but complete - explain things step by step when needed
- Show empathy and understanding in complaints
- Never make up facts or product details\n\n`;

  // Merchant-defined bot info (brand guidelines, boundaries, recipe overview)
  if (botInfo && Object.keys(botInfo).length > 0) {
    const labels: Record<string, string> = {
      brand_guidelines: 'Brand & guidelines',
      bot_boundaries: 'How you should behave / boundaries',
      recipe_overview: 'Recipes & usage overview',
      custom_instructions: 'Additional instructions',
    };
    prompt += '--- Merchant instructions for this bot ---\n';
    for (const [key, value] of Object.entries(botInfo)) {
      if (value?.trim()) {
        prompt += `${labels[key] || key}:\n${value.trim()}\n\n`;
      }
    }
    prompt += '---\n\n';
  }

  // Persona settings
  const toneMap: Record<string, string> = {
    friendly: 'friendly and warm',
    professional: 'professional and courteous',
    casual: 'casual and relaxed',
    formal: 'formal and respectful'
  };

  if (persona.tone) {
    prompt += `Communication style: Be ${toneMap[persona.tone] || persona.tone}.\n`;
  }

  if (persona.emoji === true) {
    prompt += `Use appropriate emojis to make messages more engaging.\n`;
  } else if (persona.emoji === false) {
    prompt += `Do not use emojis in responses.\n`;
  }

  const lengthMap: Record<string, string> = {
    short: 'Keep responses brief (1-2 sentences when possible)',
    medium: 'Keep responses moderate (2-4 sentences typically)',
    long: 'Provide detailed responses (3-6 sentences with full explanations)'
  };

  if (persona.response_length) {
    prompt += `Response length: ${lengthMap[persona.response_length] || 'medium'}.\n`;
  }

  prompt += '\n';

  // Intent-specific instructions
  switch (intent) {
    case 'question':
      prompt +=
        'USER INTENT: The user is asking a question.\n' +
        '- Answer based on the product information provided below\n' +
        '- Be clear and specific with step-by-step instructions when appropriate\n' +
        '- If information is missing, explain what you cannot answer and suggest alternatives\n\n';
      break;
    case 'complaint':
      prompt +=
        'USER INTENT: The user has a complaint or problem.\n' +
        '- Show empathy and acknowledge their concern first\n' +
        '- Apologize if appropriate\n' +
        '- Offer practical solutions or next steps\n' +
        '- Be professional and solution-focused\n\n';
      break;
    case 'chat':
      prompt +=
        'USER INTENT: The user is having a casual conversation.\n' +
        '- Be friendly and engaging\n' +
        '- Keep the conversation natural and helpful\n' +
        '- Look for opportunities to assist\n\n';
      break;
    case 'opt_out':
      prompt +=
        'USER INTENT: The user wants to opt out or stop receiving messages.\n' +
        '- Respect their choice immediately\n' +
        '- Confirm the opt-out clearly\n' +
        '- Thank them politely\n\n';
      break;
    case 'return_intent':
      prompt +=
        'USER INTENT: The user wants to return the product or is dissatisfied.\n' +
        'YOUR GOAL: Prevent the return by helping them get value from the product.\n' +
        '- Acknowledge frustration with empathy first\n' +
        '- Ask how they used it (dosage, frequency, duration)\n' +
        '- If a video URL is available in the product info, suggest it naturally\n' +
        '- Share usage tips from product instructions\n' +
        '- Do NOT accept the return or give return instructions\n' +
        '- If they insist, offer to connect with a team member\n\n';
      break;
  }

  // RAG context (knowledge_chunks + product_instructions)
  if (ragContext) {
    prompt += `--- PRODUCT INFORMATION (Use this to answer) ---\n${ragContext}\n\n`;
    prompt +=
      'IMPORTANT: If structured product facts are present, treat them as highest-priority source of truth. ' +
      'Use retrieved text chunks as supporting evidence/details.\n' +
      'IMPORTANT: Base your answer ONLY on the information above. ' +
      'If the answer is not in the context, clearly say "I don\'t have specific information about that" and offer to help in another way.\n\n';
  } else if (intent === 'question' || intent === 'return_intent') {
    prompt +=
      '--- NO PRODUCT INFORMATION AVAILABLE ---\n' +
      'The product information is not in the knowledge base yet. ' +
      'Acknowledge their concern politely, explain you don\'t have specific details, ' +
      'and suggest alternatives (check packaging, contact support, etc.). ' +
      'NEVER invent product details, ingredients, or usage instructions.\n\n';
  }

  prompt +=
    'RESPONSE FORMAT:\n' +
    '- ALWAYS respond in the SAME language the user writes in. If the user writes in Hungarian, respond in Hungarian. If in Turkish, respond in Turkish. If in English, respond in English. Match the user\'s language exactly.\n' +
    '- Be natural and conversational\n' +
    '- Focus on being helpful and solving the customer\'s need\n';

  return prompt;
}
