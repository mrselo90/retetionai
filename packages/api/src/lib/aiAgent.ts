/**
 * AI Agent utilities
 * Intent classification, RAG retrieval, and LLM generation
 */

import type OpenAI from 'openai';
import { getOpenAIClient } from './openaiClient.js';
import { getConversationMemorySettings, getDefaultLlmModel } from './runtimeModelSettings.js';
import { trackAiUsageEvent } from './aiUsageEvents.js';
import { formatRAGResultsForLLM, getOrderProductContextResolved } from './rag.js';
import { getSupabaseServiceClient, logger, getProductInstructionsByProductIds } from '@recete/shared';
import {
  getConversationStructuredState,
  updateConversationStructuredState,
  type ConversationMessage,
  type ConversationStructuredState,
} from './conversation.js';
import {
  checkUserMessageGuardrailsWithoutCrisis,
  checkAIResponseGuardrails,
  checkForHumanHandoffRequest,
  evaluateCrisisEscalation,
  escalateToHuman,
  getSafeResponse,
  type CustomGuardrail,
} from './guardrails.js';
import { processSatisfactionCheck } from './upsell.js';
import { getMerchantBotInfo } from './botInfo.js';
import { isAddonActive, logReturnPreventionAttempt, hasPendingPreventionAttempt, updatePreventionOutcome } from './addons.js';
import {
  buildUnsupportedLanguageNotice,
  detectLanguage,
  getLocalizedHandoffResponse,
  getLocalizedEscalationResponse,
  resolveMerchantReplyLanguage,
  type SupportedLanguage,
} from './i18n.js';
import crypto from 'node:crypto';
import { getActiveProductFactsContext, getActiveProductFactsSnapshots } from './productFactsQuery.js';
import { generateGroundedProductAnswer } from './groundedAnswer.js';
import { buildGroundedEvidenceContext } from './groundingAssembler.js';
import { UnifiedRetrievalService } from './unifiedRetrieval.js';
import { getCosmeticRagPolicy } from './ragRetrievalPolicy.js';
import { ShopSettingsService } from './multiLangRag/shopSettingsService.js';
import {
  bestEffortRoutineUsedCount,
  clarificationAskedCount,
  contextualContinuationResolvedCount,
  crisisConfirmedCount,
  crisisPrecheckCount,
  crisisRejectedCount,
  fallbackTriggeredCount,
  humanHandoffRequestedCount,
  routineIntentDetectedCount,
  routineQualityRegeneratedCount,
} from './metrics.js';
import { captureAssistantPilotDiagnostic } from './assistantPilotDiagnostics.js';

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

type OrderProductMeta = {
  id: string;
  name: string;
};

type RoutineBuckets = {
  morning: string[];
  evening: string[];
  anytime: string[];
  excluded: string[];
};

type UserGoal =
  | 'build_routine'
  | 'understand_product'
  | 'troubleshoot'
  | 'return_request'
  | 'unsubscribe'
  | 'human_handoff'
  | 'smalltalk'
  | 'unknown';

type ConversationQuestionType =
  | 'product_selection'
  | 'routine_builder'
  | 'usage_how'
  | 'usage_frequency'
  | 'none';

type ConversationFlowState = {
  current_intent: Intent;
  selected_products: 'all' | string[];
  last_question_type: ConversationQuestionType;
  for_whom: 'self' | 'wife' | 'husband' | 'partner' | 'other' | 'unknown';
  preferred_routine_scope: 'morning' | 'evening' | 'both' | 'unknown';
  simplicity_preference: 'simple' | 'detailed' | 'unknown';
  routine_format_preference: 'step_order' | 'sections' | 'unknown';
  unresolved_clarification_need: boolean;
};

type RoutineProductCategory = 'skincare' | 'hygiene' | 'irrelevant';

type RoutineProductClassification = {
  productId: string;
  name: string;
  category: RoutineProductCategory;
  slot: 'morning' | 'evening' | 'anytime' | 'exclude';
  exclusionReason?: string;
};

type PersonaSettings = {
  bot_name?: string;
  tone?: 'friendly' | 'professional' | 'casual' | 'formal' | string;
  emoji?: boolean;
  response_length?: 'short' | 'medium' | 'long' | string;
  temperature?: number;
};

type StructuredStateConstraints = NonNullable<ConversationStructuredState['constraints']>;

function toStructuredConstraints(state: ConversationFlowState): StructuredStateConstraints {
  return {
    routine_scope: state.preferred_routine_scope,
    simplicity: state.simplicity_preference,
    for_whom: state.for_whom,
    routine_format: state.routine_format_preference,
  };
}

function mergeFlowStateWithStructuredState(
  derived: ConversationFlowState,
  structured: ConversationStructuredState,
): ConversationFlowState {
  const selectedProducts =
    derived.selected_products === 'all'
      ? 'all'
      : derived.selected_products.length > 0
        ? derived.selected_products
        : structured.selected_products;
  const constraints = structured.constraints || {};
  return {
    current_intent: derived.current_intent || structured.current_intent || 'chat',
    selected_products: selectedProducts,
    last_question_type:
      derived.last_question_type !== 'none'
        ? derived.last_question_type
        : ((structured.last_question_type as ConversationQuestionType) || 'none'),
    for_whom: derived.for_whom !== 'unknown' ? derived.for_whom : (constraints.for_whom || 'unknown'),
    preferred_routine_scope:
      derived.preferred_routine_scope !== 'unknown'
        ? derived.preferred_routine_scope
        : (constraints.routine_scope || 'unknown'),
    simplicity_preference:
      derived.simplicity_preference !== 'unknown'
        ? derived.simplicity_preference
        : (constraints.simplicity || 'unknown'),
    routine_format_preference:
      derived.routine_format_preference !== 'unknown'
        ? derived.routine_format_preference
        : (constraints.routine_format || 'unknown'),
    unresolved_clarification_need:
      derived.unresolved_clarification_need || Boolean(structured.unresolved_clarification_need),
  };
}

function buildModelHistory(
  history: ConversationMessage[],
  memorySettings: { mode: 'last_n' | 'full'; count: number },
): { history: ConversationMessage[]; truncated: boolean } {
  if (memorySettings.mode !== 'full') {
    return { history: history.slice(-Math.max(1, memorySettings.count)), truncated: false };
  }

  // Full mode must include complete usable history. We only truncate when payload is too large.
  const maxChars = 50_000;
  let total = 0;
  const selected: ConversationMessage[] = [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i];
    const cost = String(item.content || '').length + 80;
    if (selected.length > 0 && total + cost > maxChars) break;
    selected.push(item);
    total += cost;
  }
  selected.reverse();
  const truncated = selected.length < history.length;
  return { history: selected, truncated };
}

function asksForPurchasedProductInfo(answer: string): boolean {
  const normalized = normalizeForMatch(answer);
  return (
    /which products did you buy/.test(normalized) ||
    /what products did you buy/.test(normalized) ||
    /which product are you referring to/.test(normalized) ||
    /which product are you using or your order number/.test(normalized) ||
    /which product are you using/.test(normalized) ||
    /share exact product names/.test(normalized) ||
    /urun adlarini paylas/.test(normalized) ||
    /hangi urunu kullandigini/.test(normalized)
  );
}

function buildKnownProductsRecoveryResponse(
  lang: SupportedLanguage,
  products: OrderProductMeta[],
): string {
  const names = products.map((item) => item.name).filter(Boolean).slice(0, 6);
  if (lang === 'tr') {
    return `Siparisinizdeki urunleri bu sohbette hatirliyorum: ${names.join(', ')}. Isterseniz hepsi icin birlikte kullanim sirasi verebilirim.`;
  }
  return `I still have your order products in this chat: ${names.join(', ')}. I can give one combined routine for all of them right away.`;
}

function buildUnknownProductSafeFallback(
  lang: SupportedLanguage,
  products: OrderProductMeta[],
): string {
  const lines = products.slice(0, 8).map((item, idx) => `${idx + 1}. ${item.name}`).join('\n');
  if (lang === 'tr') {
    return `Bu ürün için yeterli bilgiye sahip degilim. Siparisinizdeki urunler:\n${lines}\n\nBir urun numarasi (1,2,3) yazabilir ya da "hepsi" diyebilirsiniz.`;
  }
  return `I do not have enough info about this product. Products in your order:\n${lines}\n\nReply with a product number (1,2,3) or say "all of them".`;
}

function buildStructuredStatePromptContext(state: ConversationStructuredState): string {
  const productNames = (state.known_order_products || [])
    .map((item) => String(item.name || '').trim())
    .filter(Boolean)
    .slice(0, 15);
  const selected =
    state.selected_products === 'all'
      ? 'all'
      : Array.isArray(state.selected_products)
        ? state.selected_products.join(',')
        : '';
  return [
    '--- CONVERSATION STATE (authoritative, do not ignore) ---',
    `order_id: ${state.order_id || 'none'}`,
    `known_order_products: ${productNames.length > 0 ? productNames.join(' | ') : 'none'}`,
    `selected_products: ${selected || 'none'}`,
    `last_question_type: ${state.last_question_type || 'none'}`,
    `language_preference: ${state.language_preference || 'unknown'}`,
    `current_goal: ${state.current_goal || 'unknown'}`,
    `current_intent: ${state.current_intent || 'unknown'}`,
    `unresolved_clarification_need: ${state.unresolved_clarification_need ? 'yes' : 'no'}`,
    '---------------------------------------------------------',
  ].join('\n');
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeForMatch(value: string) {
  return normalizeForMatch(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function buildTrigrams(value: string): Set<string> {
  const source = normalizeForMatch(value).replace(/\s+/g, ' ').trim();
  if (source.length < 3) return new Set(source ? [source] : []);
  const grams = new Set<string>();
  for (let i = 0; i <= source.length - 3; i += 1) {
    grams.add(source.slice(i, i + 3));
  }
  return grams;
}

function diceSimilarity(a: string, b: string): number {
  const ag = buildTrigrams(a);
  const bg = buildTrigrams(b);
  if (ag.size === 0 || bg.size === 0) return 0;
  let overlap = 0;
  for (const item of ag) {
    if (bg.has(item)) overlap += 1;
  }
  return (2 * overlap) / (ag.size + bg.size);
}

function looksLikeAllProductsReference(text: string): boolean {
  const normalized = normalizeForMatch(text);
  return (
    /\b(all products|all my products|all of them|for all of them|everything i bought|all together|my products)\b/i.test(normalized) ||
    /\b(these|them)\b/i.test(normalized)
  );
}

function removeEmojis(value: string): string {
  return value.replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').replace(/\s{2,}/g, ' ').trim();
}

function applyPersonaResponsePolicy(
  response: string,
  persona: PersonaSettings,
  responseLang: SupportedLanguage,
): string {
  let value = String(response || '').trim();
  if (!value) return value;

  if (persona?.emoji === false) {
    value = removeEmojis(value);
  }

  const lengthSetting = String(persona?.response_length || '').toLowerCase();
  if (lengthSetting === 'short') {
    const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length > 7) {
      value = lines.slice(0, 7).join('\n');
    }
    if (value.length > 480) value = `${value.slice(0, 477).trim()}...`;
  } else if (lengthSetting === 'medium' && value.length > 900) {
    value = `${value.slice(0, 897).trim()}...`;
  }

  const tone = String(persona?.tone || '').toLowerCase();
  if (tone === 'formal') {
    value = value.replace(/\b(I'm|I’m)\b/g, 'I am').replace(/\b(can't|can’t)\b/g, 'cannot');
  } else if (tone === 'casual' && responseLang === 'en') {
    value = value.replace(/^Great,/i, 'Sure,');
  }

  return value;
}

function parseIndexedSelection(message: string): number | null {
  const trimmed = message.trim();
  const match = trimmed.match(/^(?:#\s*)?(\d{1,2})[.)]?\s*$/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function parseOrdinalSelection(message: string): number | null {
  const normalized = normalizeForMatch(message);
  if (!normalized) return null;
  const patterns: Array<{ re: RegExp; index: number }> = [
    { re: /\b(first|1st|birinci|elso|elso)\b/i, index: 1 },
    { re: /\b(second|2nd|ikinci|masodik|második)\b/i, index: 2 },
    { re: /\b(third|3rd|ucuncu|üçüncü|harmadik)\b/i, index: 3 },
    { re: /\b(fourth|4th|dorduncu|dördüncü|negyedik)\b/i, index: 4 },
  ];
  for (const item of patterns) {
    if (item.re.test(normalized)) return item.index;
  }
  return null;
}

function parseRecentAssistantProductList(conversationHistory: ConversationMessage[]): string[] {
  const recentAssistantMessages = conversationHistory
    .slice(-8)
    .filter((m) => m.role === 'assistant' || m.role === 'merchant')
    .map((m) => String(m.content || ''));

  for (let idx = recentAssistantMessages.length - 1; idx >= 0; idx -= 1) {
    const message = recentAssistantMessages[idx];
    const lines = message.split(/\r?\n/).map((line) => line.trim());
    const numbered = lines
      .map((line) => {
        const m = line.match(/^(\d{1,2})[.)]\s+(.+)$/);
        if (!m) return null;
        const order = Number.parseInt(m[1], 10);
        if (!Number.isFinite(order) || order <= 0) return null;
        return { order, name: m[2].trim() };
      })
      .filter(Boolean) as Array<{ order: number; name: string }>;

    if (numbered.length === 0) continue;
    return numbered
      .sort((a, b) => a.order - b.order)
      .map((item) => item.name);
  }

  return [];
}

async function fetchOrderProductsByIds(
  merchantId: string,
  productIds: string[]
): Promise<OrderProductMeta[]> {
  if (!Array.isArray(productIds) || productIds.length === 0) return [];
  const serviceClient = getSupabaseServiceClient();
  const uniqueIds = [...new Set(productIds.map((id) => String(id).trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const { data, error } = await serviceClient
    .from('products')
    .select('id, name')
    .eq('merchant_id', merchantId)
    .in('id', uniqueIds);

  if (error || !data) return [];

  return data.map((item: any) => ({
    id: String(item.id),
    name: String(item.name || '').trim(),
  }));
}

function resolveMentionedOrderProduct(input: {
  message: string;
  conversationHistory: ConversationMessage[];
  orderProducts: OrderProductMeta[];
  lang: SupportedLanguage;
}): {
  productId?: string;
  reason?: 'index' | 'exact_name' | 'token_focus';
  uncertain?: boolean;
  unknownReference?: boolean;
} {
  const { message, conversationHistory, orderProducts } = input;
  if (!orderProducts.length) return {};

  if (looksLikeAllProductsReference(message)) {
    return { reason: 'token_focus' };
  }

  const indexedSelection = parseIndexedSelection(message) || parseOrdinalSelection(message);
  if (indexedSelection) {
    const listedNames = parseRecentAssistantProductList(conversationHistory);
    if (listedNames.length >= indexedSelection) {
      const chosenName = listedNames[indexedSelection - 1];
      const chosenNorm = normalizeForMatch(chosenName);
      const matched = orderProducts.find((p) => normalizeForMatch(p.name) === chosenNorm)
        || orderProducts.find((p) => normalizeForMatch(p.name).includes(chosenNorm) || chosenNorm.includes(normalizeForMatch(p.name)));
      if (matched) {
        return { productId: matched.id, reason: 'index' };
      }
    }
    if (orderProducts[indexedSelection - 1]) {
      return { productId: orderProducts[indexedSelection - 1].id, reason: 'index' };
    }
  }

  const msgNorm = normalizeForMatch(message);
  const msgTokens = new Set(tokenizeForMatch(message));
  if (!msgNorm) return {};

  let exact: OrderProductMeta | null = null;
  const fuzzyScored: Array<{ product: OrderProductMeta; score: number }> = [];

  for (const product of orderProducts) {
    const nameNorm = normalizeForMatch(product.name);
    if (!nameNorm) continue;
    if (msgNorm === nameNorm || msgNorm.includes(nameNorm) || nameNorm.includes(msgNorm)) {
      exact = product;
      break;
    }
    const score = diceSimilarity(msgNorm, product.name);
    if (score > 0) {
      fuzzyScored.push({ product, score });
    }
  }

  if (exact) return { productId: exact.id, reason: 'exact_name' };
  if (fuzzyScored.length > 0) {
    fuzzyScored.sort((a, b) => b.score - a.score);
    const best = fuzzyScored[0];
    const second = fuzzyScored[1];
    if (best.score >= 0.9 && (!second || best.score - second.score >= 0.08)) {
      return { productId: best.product.id, reason: 'token_focus' };
    }
    if (best.score >= 0.75) {
      return { uncertain: true, reason: 'token_focus' };
    }
  }

  const unknownTokenHint =
    /\b[a-z0-9]+-[a-z0-9]+\b/i.test(message) ||
    /\b(product|urun|ürün)\b/i.test(message);
  if (msgTokens.size > 0 || unknownTokenHint) {
    return { unknownReference: true, reason: 'token_focus' };
  }

  return {};
}

function buildRagCacheKey(input: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

type PostDeliveryFollowUpType =
  | 'usage_onboarding_no'
  | 'usage_onboarding_yes'
  | 'usage_product_pick'
  | 'usage_routine_request'
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
  if (lang === 'de') return 'Wie dieses Produkt verwendet wird, Anwendungsschritte, Häufigkeit und Warnhinweise';
  if (lang === 'el') return 'Πώς χρησιμοποιείται αυτό το προϊόν, βήματα χρήσης, συχνότητα και προειδοποιήσεις';
  return 'How to use this product, usage steps, frequency, and warnings';
}

function looksLikeRoutineRequest(text: string): boolean {
  return /(routine|rutin|rutini|regimen|program|daily routine|skincare routine|use together|together|all my products|all the products|everything i bought|all products)/i.test(
    text,
  );
}

function looksLikeProductSelectionPrompt(text: string): boolean {
  return /which product|which products|hangi urun|hangi ürün|hangi urunleri|hangi ürünleri|pick a product|select a product|urun sec|ürün seç|secmek istedigin/i.test(
    text,
  );
}

function isAllProductsContinuationReply(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return /^(for all of them|all of them|all|all products|all my products|everything|everything i bought|all together|for everything|hepsi|hepsini|hepsi icin|hepsi için|tum urunler|tüm ürünler|tamami|tamamı)$/i.test(
    trimmed,
  );
}

function buildUsageHowRetrievalQuery(lang: SupportedLanguage): string {
  if (lang === 'tr') return 'Bu ürünün kullanım adımları ve nasıl uygulanacağı';
  if (lang === 'hu') return 'A termék használati lépései és alkalmazása';
  if (lang === 'de') return 'Anwendungsschritte und wie dieses Produkt aufgetragen wird';
  if (lang === 'el') return 'Βήματα χρήσης και πώς εφαρμόζεται αυτό το προϊόν';
  return 'Product usage steps and how to apply it';
}

function buildUsageFrequencyRetrievalQuery(lang: SupportedLanguage): string {
  if (lang === 'tr') return 'Bu ürünün kullanım sıklığı, günde kaç kez kullanılır';
  if (lang === 'hu') return 'A termék használatának gyakorisága, naponta hányszor';
  if (lang === 'de') return 'Wie oft dieses Produkt verwendet wird, wie oft pro Tag';
  if (lang === 'el') return 'Πόσο συχνά χρησιμοποιείται αυτό το προϊόν, πόσες φορές την ημέρα';
  return 'How often to use this product, frequency per day';
}

function buildPostDeliveryAcknowledgementResponse(lang: SupportedLanguage): string {
  if (lang === 'tr') {
    return 'Harika, sevindim. Kullanım sırasında takıldığınız bir nokta olursa yazabilirsiniz; adım adım yardımcı olurum.';
  }
  if (lang === 'hu') {
    return 'Szuper, örülök neki. Ha használat közben kérdése merül fel, írjon nyugodtan, lépésről lépésre segítek.';
  }
  if (lang === 'de') {
    return 'Perfekt, das freut mich. Wenn bei der Anwendung etwas unklar ist, schreiben Sie mir gern, dann helfe ich Schritt für Schritt.';
  }
  if (lang === 'el') {
    return 'Τέλεια, χαίρομαι. Αν κάτι δεν είναι ξεκάθαρο κατά τη χρήση, γράψτε μου και θα βοηθήσω βήμα βήμα.';
  }
  return 'Great, glad to hear that. If anything is unclear while using it, message me and I can help step by step.';
}

function applyLanguageFallbackNotice(
  response: string,
  options: { usedFallback: boolean; responseLanguage: SupportedLanguage; supportedLanguages: SupportedLanguage[] },
) {
  if (!options.usedFallback) return response;
  return `${buildUnsupportedLanguageNotice(options.responseLanguage, options.supportedLanguages)}\n\n${response}`.trim();
}

function finalizeConfiguredResponse(input: {
  response: string;
  persona: PersonaSettings;
  responseLang: SupportedLanguage;
  replyLanguageDecision: { usedFallback: boolean; supportedLanguages: SupportedLanguage[] };
}): string {
  const withFallback = applyLanguageFallbackNotice(input.response, {
    usedFallback: input.replyLanguageDecision.usedFallback,
    responseLanguage: input.responseLang,
    supportedLanguages: input.replyLanguageDecision.supportedLanguages,
  });
  return applyPersonaResponsePolicy(withFallback, input.persona, input.responseLang);
}

function detectLastQuestionType(conversationHistory: ConversationMessage[]): ConversationQuestionType {
  const recentAssistantMessages = conversationHistory
    .slice(-8)
    .filter((m) => m.role === 'assistant' || m.role === 'merchant')
    .map((m) => String(m.content || ''));

  for (let idx = recentAssistantMessages.length - 1; idx >= 0; idx -= 1) {
    const message = recentAssistantMessages[idx];
    if (looksLikeProductSelectionPrompt(message)) return 'product_selection';
    if (looksLikeRoutineRequest(message)) return 'routine_builder';
    if (/how to use|nasıl kullan|hogyan használ|uygulama adımları/i.test(message)) return 'usage_how';
    if (/how often|kaç kez|sıklık|gyakoriság/i.test(message)) return 'usage_frequency';
  }
  return 'none';
}

function buildConversationFlowState(input: {
  message: string;
  intent: Intent;
  conversationHistory: ConversationMessage[];
  orderProducts: OrderProductMeta[];
}): ConversationFlowState {
  const { message, intent, conversationHistory, orderProducts } = input;
  const normalizedMessage = normalizeForMatch(message);
  const allReply = isAllProductsContinuationReply(message) || looksLikeAllProductsReference(message);
  const lastQuestionType = detectLastQuestionType(conversationHistory);

  let selectedProducts: 'all' | string[] = [];
  if (allReply && (lastQuestionType === 'product_selection' || lastQuestionType === 'routine_builder')) {
    selectedProducts = 'all';
  } else {
    const picked = resolveMentionedOrderProduct({
      message,
      conversationHistory,
      orderProducts,
      lang: detectLanguage(message),
    });
    if (picked.productId) selectedProducts = [picked.productId];
  }

  let forWhom: ConversationFlowState['for_whom'] = 'unknown';
  if (/\b(for my wife|my wife|esim icin|eşim için|felesegemnek)\b/i.test(normalizedMessage)) forWhom = 'wife';
  else if (/\b(for my husband|my husband|kocam icin|férjemnek)\b/i.test(normalizedMessage)) forWhom = 'husband';
  else if (/\b(for me|myself|benim icin|kendim icin)\b/i.test(normalizedMessage)) forWhom = 'self';

  let preferredRoutineScope: ConversationFlowState['preferred_routine_scope'] = 'unknown';
  if (/\b(morning only|only morning|sadece sabah|reggel)\b/i.test(normalizedMessage)) preferredRoutineScope = 'morning';
  else if (/\b(evening only|only evening|sadece aksam|sadece akşam|este)\b/i.test(normalizedMessage)) preferredRoutineScope = 'evening';
  else if (/\b(both|morning and evening|sabah aksam|sabah akşam)\b/i.test(normalizedMessage)) preferredRoutineScope = 'both';

  let simplicityPreference: ConversationFlowState['simplicity_preference'] = 'unknown';
  if (/\b(simple|keep it simple|kisa|kısa|short version|egyszeruen|egyszerűen)\b/i.test(normalizedMessage)) {
    simplicityPreference = 'simple';
  } else if (/\b(detailed|more detail|ayrintili|ayrıntılı|reszletes|részletes)\b/i.test(normalizedMessage)) {
    simplicityPreference = 'detailed';
  }

  let routineFormatPreference: ConversationFlowState['routine_format_preference'] = 'unknown';
  if (/\b(just tell me the order|order only|just the order|sadece sirayi|sadece sırayı|sırayla yaz|sirayla yaz|only order)\b/i.test(normalizedMessage)) {
    routineFormatPreference = 'step_order';
  } else if (/\b(morning|evening|sabah|aksam|akşam)\b/i.test(normalizedMessage)) {
    routineFormatPreference = 'sections';
  }

  return {
    current_intent: intent,
    selected_products: selectedProducts,
    last_question_type: lastQuestionType,
    for_whom: forWhom,
    preferred_routine_scope: preferredRoutineScope,
    simplicity_preference: simplicityPreference,
    routine_format_preference: routineFormatPreference,
    unresolved_clarification_need: false,
  };
}

function inferUserGoalHeuristic(input: {
  message: string;
  intentHint: Intent;
  state: ConversationFlowState;
}): UserGoal {
  const msg = normalizeForMatch(input.message);
  if (input.intentHint === 'return_intent') return 'return_request';
  if (input.intentHint === 'opt_out') return 'unsubscribe';
  if (checkForHumanHandoffRequest(input.message)) return 'human_handoff';
  if (
    input.state.selected_products === 'all' ||
    looksLikeRoutineRequest(msg) ||
    /use.*together|all products|everything i bought|daily routine|rutin/i.test(msg)
  ) {
    return 'build_routine';
  }
  if (/problem|issue|does not work|çalışmıyor|sorun|error|hata/i.test(msg)) return 'troubleshoot';
  if (input.intentHint === 'question' || /\?/.test(input.message)) return 'understand_product';
  if (input.intentHint === 'chat') return 'smalltalk';
  return 'unknown';
}

function looksLikeContextualRoutineContinuation(message: string, state: ConversationFlowState): boolean {
  const normalized = normalizeForMatch(message);
  const continuationLike =
    /\b(all|all of them|all together|together|both|same routine|yes)\b/i.test(normalized) ||
    /\b(morning only|evening only|for all of them|all my products|everything i bought|keep it simple|for my wife|for my husband|just tell me the order|order only)\b/i.test(
      normalized,
    );
  if (!continuationLike) return false;
  return state.last_question_type === 'product_selection' || state.last_question_type === 'routine_builder';
}

async function inferUserGoal(input: {
  openai: OpenAI;
  model: string;
  message: string;
  intentHint: Intent;
  state: ConversationFlowState;
}): Promise<UserGoal> {
  const fallback = inferUserGoalHeuristic({
    message: input.message,
    intentHint: input.intentHint,
    state: input.state,
  });
  try {
    const response = await input.openai.chat.completions.create({
      model: input.model,
      temperature: 0,
      max_tokens: 20,
      messages: [
        {
          role: 'system',
          content:
            'Infer customer goal. Return one token only: build_routine, understand_product, troubleshoot, return_request, unsubscribe, human_handoff, smalltalk, unknown.\n' +
            'Use context fields strongly, especially when user says short continuation like "for all of them".',
        },
        {
          role: 'user',
          content: JSON.stringify({
            message: input.message,
            intent_hint: input.intentHint,
            last_question_type: input.state.last_question_type,
            selected_products: input.state.selected_products === 'all' ? 'all' : input.state.selected_products.length,
          }),
        },
      ],
    });
    const raw = String(response?.choices?.[0]?.message?.content || '').trim().toLowerCase();
    if (
      raw === 'build_routine' ||
      raw === 'understand_product' ||
      raw === 'troubleshoot' ||
      raw === 'return_request' ||
      raw === 'unsubscribe' ||
      raw === 'human_handoff' ||
      raw === 'smalltalk' ||
      raw === 'unknown'
    ) {
      return raw;
    }
    return fallback;
  } catch {
    return fallback;
  }
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
  const inRoutineContext =
    recentAssistantMessages.some((candidate) => looksLikeRoutineRequest(String(candidate || ''))) ||
    recentAssistantMessages.some((candidate) => looksLikeProductSelectionPrompt(String(candidate || '')));
  const messageIsStandaloneRoutineRequest = looksLikeRoutineRequest(msg);

  if (!inOnboardingUsageContext && !inRoutineContext && !messageIsStandaloneRoutineRequest) {
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

  const isProductIndexSelection = /^(?:#\s*)?\d{1,2}[.)]?\s*$/.test(msg);
  if (isProductIndexSelection) {
    const selectedIndex = Number.parseInt(msg.replace(/[^\d]/g, ''), 10);
    return {
      detected: true,
      type: 'usage_product_pick',
      promoteIntentToQuestion: true,
      ragQueryOverride: buildUsageGuidanceRetrievalQuery(lang),
      plannerQueryOverride: buildUsageGuidanceRetrievalQuery(lang),
      promptHint:
        lang === 'tr'
          ? `Kullanıcı önceki listeden ürün numarası seçti (${selectedIndex || 1}). Bunu geçerli ürün seçimi olarak kabul et; mesajın eksik olduğunu söyleme ve listeyi tekrar isteme. Seçilen ürün için doğrudan kullanım/rutin önerisi ver.`
          : lang === 'hu'
            ? `A felhasználó egy termékszámot választott az előző listából (${selectedIndex || 1}). Kezeld ezt érvényes választásként; ne mondd, hogy hiányos az üzenet, és ne kérd újra a listát. Adj közvetlen használati/rutin javaslatot a kiválasztott termékhez.`
            : `The user selected a product number from the previous list (${selectedIndex || 1}). Treat this as a valid product selection; do not say the message is incomplete and do not ask for the list again. Give direct usage/routine guidance for the selected product.`,
    };
  }

  const isRoutineRequest =
    looksLikeRoutineRequest(msg) ||
    /(in this order|this order|bu sırayla|bu sirayla|sırayla|sirayla)/i.test(msg);
  if (isRoutineRequest) {
    return {
      detected: true,
      type: 'usage_routine_request',
      promoteIntentToQuestion: true,
      ragQueryOverride: buildUsageGuidanceRetrievalQuery(lang),
      plannerQueryOverride: buildUsageGuidanceRetrievalQuery(lang),
      promptHint:
        lang === 'tr'
          ? 'Kullanıcı siparişindeki ürünlerle bir rutin istiyor. Siparişteki mevcut ürün bağlamını kullan; ürün listesini tekrar isteme. Mümkünse ürün sırasına göre kısa ve uygulanabilir bir rutin öner.'
          : lang === 'hu'
            ? 'A felhasználó rutint kér a rendelésben lévő termékekkel. Használd a meglévő rendelési termék kontextust; ne kérd újra a terméklistát. Ha lehet, adj rövid, végrehajtható rutint terméksorrenddel.'
            : 'The user wants a routine with products in their order. Use the existing order product context; do not ask for the product list again. If possible, provide a short actionable routine in product order.',
    };
  }

  if (isAllProductsContinuationReply(msg)) {
    return {
      detected: true,
      type: 'usage_routine_request',
      promoteIntentToQuestion: true,
      ragQueryOverride: buildUsageGuidanceRetrievalQuery(lang),
      plannerQueryOverride: buildUsageGuidanceRetrievalQuery(lang),
      promptHint:
        lang === 'tr'
          ? 'Kullanici "hepsi" diyerek onceki urun secim sorusuna cevap verdi. Bunu tum siparis urunleri olarak yorumla ve dogrudan kisa bir rutin ver. Gereksiz netlestirme sorma.'
          : lang === 'hu'
            ? 'A felhasznalo "mindegyik" valaszt adott az elozo termekvalasztasi kerdesre. Ertelmezd ezt ugy, hogy a rendeles osszes termeke szerepeljen, es adj kozvetlen rovid rutint.'
            : 'The user answered with an all-products continuation reply. Interpret this as using all order products and provide a direct short routine without unnecessary clarification.',
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

function classifyRoutineProductHeuristic(product: OrderProductMeta): RoutineProductClassification {
  const normalized = normalizeForMatch(product.name);
  if (
    /(deodorant|parfum|perfume|body spray|shampoo|conditioner|body wash|sabun|soap|dis macunu|dis fircasi|toothpaste|toothbrush)/i.test(
      normalized,
    )
  ) {
    return {
      productId: product.id,
      name: product.name,
      category: 'hygiene',
      slot: 'exclude',
      exclusionReason: 'Not part of a facial skincare routine',
    };
  }
  if (/(placeholder|test product|sample|dummy)/i.test(normalized)) {
    return {
      productId: product.id,
      name: product.name,
      category: 'irrelevant',
      slot: 'exclude',
      exclusionReason: 'Not a real routine item',
    };
  }
  if (/(sunscreen|sun screen|spf|gunes kremi|güneş kremi)/i.test(normalized)) {
    return { productId: product.id, name: product.name, category: 'skincare', slot: 'morning' };
  }
  if (/(retinol|peeling|acid|aha|bha|salicylic|night cream|gece kremi)/i.test(normalized)) {
    return { productId: product.id, name: product.name, category: 'skincare', slot: 'evening' };
  }
  return { productId: product.id, name: product.name, category: 'skincare', slot: 'anytime' };
}

async function classifyRoutineProducts(
  openai: OpenAI,
  model: string,
  orderProducts: OrderProductMeta[],
): Promise<RoutineProductClassification[]> {
  if (orderProducts.length === 0) return [];
  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content:
            'Classify products for a practical skincare routine.\n' +
            'Return ONLY JSON array of objects: { "name": string, "category": "skincare|hygiene|irrelevant", "slot": "morning|evening|anytime|exclude", "exclusionReason": string|null }.\n' +
            'Exclude hygiene/irrelevant products from skincare routine.',
        },
        {
          role: 'user',
          content: JSON.stringify(orderProducts.map((p) => ({ id: p.id, name: p.name }))),
        },
      ],
    });
    const raw = String(response?.choices?.[0]?.message?.content || '').trim();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('not-array');
    const byName = new Map(orderProducts.map((product) => [normalizeForMatch(product.name), product]));
    const normalized = parsed
      .map((item: any) => {
        const product = byName.get(normalizeForMatch(String(item?.name || '')));
        if (!product) return null;
        const category: RoutineProductCategory =
          item?.category === 'hygiene' || item?.category === 'irrelevant' ? item.category : 'skincare';
        const slot: RoutineProductClassification['slot'] =
          item?.slot === 'morning' || item?.slot === 'evening' || item?.slot === 'exclude' ? item.slot : 'anytime';
        return {
          productId: product.id,
          name: product.name,
          category,
          slot,
          exclusionReason: slot === 'exclude' ? String(item?.exclusionReason || 'Not compatible with skincare routine') : undefined,
        } as RoutineProductClassification;
      })
      .filter(Boolean) as RoutineProductClassification[];
    if (normalized.length === orderProducts.length) return normalized;
  } catch {
    // fallback to deterministic classification
  }
  return orderProducts.map(classifyRoutineProductHeuristic);
}

function bucketRoutineProducts(classifications: RoutineProductClassification[]): RoutineBuckets {
  return classifications.reduce<RoutineBuckets>(
    (acc, product) => {
      if (product.slot === 'exclude') {
        acc.excluded.push(product.name);
      } else {
        acc[product.slot].push(product.name);
      }
      return acc;
    },
    { morning: [], evening: [], anytime: [], excluded: [] },
  );
}

function listToLine(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function buildBestEffortRoutineResponse(
  lang: SupportedLanguage,
  classifications: RoutineProductClassification[],
  persona: PersonaSettings,
  state: ConversationFlowState,
): string {
  const buckets = bucketRoutineProducts(classifications);
  const usableProducts = [...buckets.morning, ...buckets.anytime, ...buckets.evening];

  if (usableProducts.length === 0) {
    if (lang === 'tr') {
      return 'Siparisinizde rutin formatina uygun urunleri net ayiramadim. En guvenli baslangic olarak temizleme + nemlendirme adimi uygulayin; urun adlarini paylasirsaniz daha net bir sabah/aksam rutin olusturabilirim.';
    }
    return 'I could not clearly map your products to a routine format. Safe baseline: cleanser + moisturizer. Share exact product names and I can build a sharper morning/evening routine.';
  }

  const morningItems = [...buckets.anytime, ...buckets.morning];
  const eveningItems = [...buckets.anytime, ...buckets.evening];
  const scope = state.preferred_routine_scope;
  const includeMorning = scope === 'unknown' || scope === 'both' || scope === 'morning';
  const includeEvening = scope === 'unknown' || scope === 'both' || scope === 'evening';
  const concise = String(persona?.response_length || '').toLowerCase() === 'short' || state.simplicity_preference === 'simple';
  const orderOnly = state.routine_format_preference === 'step_order';

  const introTarget =
    state.for_whom === 'wife' ? (lang === 'tr' ? 'Esiniz icin ' : 'For your wife, ')
      : state.for_whom === 'husband' ? (lang === 'tr' ? 'Esiniz icin ' : 'For your husband, ')
        : '';

  if (lang === 'tr') {
    const intro = persona?.tone === 'formal'
      ? `${introTarget}siparisinizdeki uyumlu urunlere gore pratik bir rutin hazirladim.`
      : `${introTarget}uyumlu urunlerinizle pratik bir rutin hazirladim.`;
    const excludedNote = buckets.excluded.length > 0
      ? `\n\nRutin disinda biraktigim urunler:\n${listToLine(buckets.excluded)}`
      : '';
    if (orderOnly) {
      const ordered = [...(includeMorning ? morningItems : []), ...(includeEvening ? eveningItems : [])];
      const deduped = [...new Set(ordered)];
      const steps = deduped.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
      return `${intro}\n\nSadece uygulama sirasi:\n${steps}${excludedNote}`.trim();
    }
    const body = [
      intro,
      includeMorning ? `\nSabah:\n${listToLine(morningItems)}` : '',
      includeEvening ? `\nAksam:\n${listToLine(eveningItems)}` : '',
      excludedNote,
      concise ? '' : '\n\nCiltte hassasiyet olursa kullanim sikligini azaltin.',
    ].join('');
    return body.trim();
  }

  const excludedNote = buckets.excluded.length > 0
    ? `\n\nSkipped from routine:\n${listToLine(buckets.excluded)}`
    : '';
  const intro = persona?.tone === 'formal'
    ? `${introTarget}Here is a practical routine using the compatible products in your order.`
    : `${introTarget}Here is a practical routine using your compatible products.`;
  if (orderOnly) {
    const ordered = [...(includeMorning ? morningItems : []), ...(includeEvening ? eveningItems : [])];
    const deduped = [...new Set(ordered)];
    const steps = deduped.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
    return `${intro}\n\nJust the order:\n${steps}${excludedNote}`.trim();
  }
  const body = [
    intro,
    includeMorning ? `\n\nMorning:\n${listToLine(morningItems)}` : '',
    includeEvening ? `\n\nEvening:\n${listToLine(eveningItems)}` : '',
    excludedNote,
    concise ? '' : '\n\nIf your skin feels sensitive, reduce frequency.',
  ].join('');
  return body.trim();
}

function buildRoutineExclusionNote(lang: SupportedLanguage, classifications: RoutineProductClassification[]): string {
  const excluded = classifications.filter((item) => item.slot === 'exclude');
  if (excluded.length === 0) return '';
  if (lang === 'tr') {
    return `\n\nRutin disinda biraktigim urunler:\n${excluded
      .map((item) => `- ${item.name}: ${item.exclusionReason || 'Rutinle uyumlu degil'}`)
      .join('\n')}`;
  }
  return `\n\nSkipped from routine:\n${excluded
    .map((item) => `- ${item.name}: ${item.exclusionReason || 'Not routine-compatible'}`)
    .join('\n')}`;
}

function validateRoutineAnswerQuality(answer: string, includedProducts: RoutineProductClassification[]): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const normalized = normalizeForMatch(answer);
  const hasStructuredSections =
    /(morning|evening|sabah|aksam)/i.test(answer) ||
    /^(\s*[-*]\s+.+|\s*\d+[.)]\s+.+)$/m.test(answer);
  if (!hasStructuredSections) reasons.push('missing_structure');

  const includedNames = includedProducts
    .filter((item) => item.slot !== 'exclude')
    .map((item) => normalizeForMatch(item.name));
  const hasAnyProduct = includedNames.some((name) => name.length > 0 && normalized.includes(name));
  if (!hasAnyProduct) reasons.push('no_real_product');

  if (
    looksLikeEvidenceClarificationAnswer(answer) ||
    /share more detail|could you clarify|which product/i.test(answer)
  ) {
    reasons.push('generic_or_clarifying');
  }
  return { ok: reasons.length === 0, reasons };
}

function looksLikeEvidenceClarificationAnswer(answer: string): boolean {
  const normalized = answer.toLowerCase();
  return (
    normalized.includes('clear product evidence') ||
    normalized.includes('hangi ürünü') ||
    normalized.includes('hangi urunu') ||
    normalized.includes('which product or variant') ||
    normalized.includes('welches produkt')
  );
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
  const persona = (personaSettings || merchant?.persona_settings || {}) as PersonaSettings;
  const userLang = detectLanguage(message);
  const languageSettings = await new ShopSettingsService().getOrCreate(merchantId, message);
  const replyLanguageDecision = resolveMerchantReplyLanguage(userLang, languageSettings.enabled_langs);
  const responseLang = replyLanguageDecision.responseLanguage;
  const memorySettings = await getConversationMemorySettings();
  const modelHistory = buildModelHistory(conversationHistory, memorySettings);
  const stateHistory = memorySettings.mode === 'full'
    ? conversationHistory
    : conversationHistory.slice(-Math.max(6, memorySettings.count));
  if (memorySettings.mode === 'full' && modelHistory.truncated) {
    logger.info(
      { merchantId, conversationId, totalHistory: conversationHistory.length, usedHistory: modelHistory.history.length },
      'Full conversation mode required explicit truncation for model context window',
    );
  }
  let structuredState = await getConversationStructuredState(conversationId);
  const effectiveOrderId = orderId || structuredState.order_id || undefined;
  const persistStructuredState = async (patch: Partial<ConversationStructuredState>) => {
    try {
      structuredState = await updateConversationStructuredState(conversationId, {
        order_id: effectiveOrderId || null,
        ...patch,
      });
    } catch (error) {
      logger.warn({ error, conversationId, merchantId }, 'Failed to persist conversation structured state');
    }
  };
  let pilotInferredGoal: UserGoal = 'unknown';
  let pilotSelectedProducts: 'all' | string[] = [];
  let pilotExcludedProducts: Array<{ name: string; reason?: string }> = [];
  let pilotGenerationMode: 'generated' | 'regenerated' | 'fallback' = 'generated';
  let pilotRegenerated = false;
  let pilotFallbackReason: string | null = null;
  let pilotEscalationDecision: { escalated: boolean; reason?: string } = { escalated: false };
  let pilotContextualContinuationResolved = false;
  let pilotRoutineIntentDetected = false;
  let routineIntentMetricIncremented = false;
  let pilotClarificationAsked = false;
  let pilotBestEffortRoutineUsed = false;
  let stickyOrderProducts: OrderProductMeta[] = Array.isArray(structuredState.known_order_products)
    ? structuredState.known_order_products
        .map((item) => ({
          id: String(item.id || '').trim(),
          name: String(item.name || '').trim(),
        }))
        .filter((item) => item.id.length > 0 && item.name.length > 0)
    : [];

  const capturePilot = async (responseText: string) => {
    await captureAssistantPilotDiagnostic({
      merchantId,
      conversationId,
      orderId: effectiveOrderId,
      model: llmModel,
      userMessage: message,
      assistantResponse: responseText,
      diagnostics: {
        inferredGoal: pilotInferredGoal,
        selectedProducts: pilotSelectedProducts,
        excludedProducts: pilotExcludedProducts,
        merchantSettings: {
          bot_name: persona?.bot_name || null,
          tone: persona?.tone || null,
          response_length: persona?.response_length || null,
          emoji: typeof persona?.emoji === 'boolean' ? persona.emoji : null,
          supported_reply_languages: replyLanguageDecision.supportedLanguages,
        },
        memoryMode: memorySettings.mode,
        memoryCount: memorySettings.count,
        memoryHistoryTruncated: modelHistory.truncated,
        generationMode: pilotGenerationMode,
        regenerated: pilotRegenerated,
        fallbackReason: pilotFallbackReason,
        escalationDecision: pilotEscalationDecision,
        routineIntentDetected: pilotRoutineIntentDetected,
        contextualContinuationResolved: pilotContextualContinuationResolved,
        clarificationAsked: pilotClarificationAsked,
        bestEffortRoutineUsed: pilotBestEffortRoutineUsed,
      },
    });
  };

  // Step 1: Layered crisis evaluation (fast pre-check + LLM confirm)
  const crisisDecision = await evaluateCrisisEscalation({
    userMessage: message,
    model: llmModel,
    llmClient: openai as any,
  });
  if (crisisDecision.precheckMatched) {
    crisisPrecheckCount.inc();
  }

  if (crisisDecision.shouldEscalate) {
    crisisConfirmedCount.inc();
    pilotEscalationDecision = { escalated: true, reason: crisisDecision.reason || 'crisis_keyword' };
    logger.warn(
      {
        merchantId,
        conversationId,
        precheckMatched: crisisDecision.precheckMatched,
        llmConfirmed: crisisDecision.llmConfirmed,
        severity: crisisDecision.severity,
        reason: crisisDecision.reason,
      },
      'Escalation triggered by layered crisis detection',
    );
    await escalateToHuman(userId, conversationId, 'crisis_keyword', message);
    const crisisResponse = finalizeConfiguredResponse({
      response: crisisDecision.suggestedResponse || getSafeResponse('crisis_keyword'),
      persona,
      responseLang,
      replyLanguageDecision: {
        usedFallback: replyLanguageDecision.usedFallback,
        supportedLanguages: replyLanguageDecision.supportedLanguages,
      },
    });
    await persistStructuredState({
      current_intent: 'chat',
      language_preference: responseLang,
      selected_products: structuredState.selected_products,
      last_question_type: structuredState.last_question_type || 'none',
      known_order_products: structuredState.known_order_products,
      constraints: structuredState.constraints,
    });
    await capturePilot(crisisResponse);
    return {
      intent: 'chat',
      response: crisisResponse,
      guardrailBlocked: true,
      guardrailReason: 'crisis_keyword',
      requiresHuman: true,
    };
  }

  if (crisisDecision.precheckMatched && !crisisDecision.shouldEscalate) {
    crisisRejectedCount.inc();
    logger.info(
      {
        merchantId,
        conversationId,
        reason: crisisDecision.reason,
        llmConfirmed: crisisDecision.llmConfirmed,
      },
      'Crisis precheck matched but escalation skipped by layered classifier',
    );
  }

  // Step 1b: Non-crisis guardrails (medical/custom)
  const userGuardrail = checkUserMessageGuardrailsWithoutCrisis(message, { customGuardrails });

  if (!userGuardrail.safe) {
    fallbackTriggeredCount.inc({ reason: `guardrail_${userGuardrail.reason || 'custom'}` });
    pilotGenerationMode = 'fallback';
    pilotFallbackReason = `guardrail_${userGuardrail.reason || 'custom'}`;
    if (userGuardrail.requiresHuman) {
      pilotEscalationDecision = { escalated: true, reason: userGuardrail.reason || 'custom' };
      logger.warn(
        { merchantId, conversationId, reason: userGuardrail.reason ?? 'custom' },
        'Escalation triggered by user guardrail',
      );
      await escalateToHuman(userId, conversationId, userGuardrail.reason ?? 'custom', message);
    }

    const blockedResponse = finalizeConfiguredResponse({
      response: userGuardrail.suggestedResponse || getSafeResponse(userGuardrail.reason ?? 'custom'),
      persona,
      responseLang,
      replyLanguageDecision: {
        usedFallback: replyLanguageDecision.usedFallback,
        supportedLanguages: replyLanguageDecision.supportedLanguages,
      },
    });
    await persistStructuredState({
      current_intent: 'chat',
      language_preference: responseLang,
      selected_products: structuredState.selected_products,
      last_question_type: structuredState.last_question_type || 'none',
      known_order_products: structuredState.known_order_products,
      constraints: structuredState.constraints,
    });
    await capturePilot(blockedResponse);
    return {
      intent: 'chat',
      response: blockedResponse,
      guardrailBlocked: true,
      guardrailReason: userGuardrail.reason,
      guardrailCustomName: userGuardrail.customReason,
      requiresHuman: userGuardrail.requiresHuman,
    };
  }

  // Step 0.5: Check if the customer is explicitly requesting a human agent
  if (checkForHumanHandoffRequest(message)) {
    humanHandoffRequestedCount.inc();
    pilotEscalationDecision = { escalated: true, reason: 'human_request' };
    await escalateToHuman(userId, conversationId, 'human_request', message);
    const lang = responseLang;
    const handoffResponse = finalizeConfiguredResponse({
      response: getLocalizedHandoffResponse(lang),
      persona,
      responseLang,
      replyLanguageDecision: {
        usedFallback: replyLanguageDecision.usedFallback,
        supportedLanguages: replyLanguageDecision.supportedLanguages,
      },
    });
    await persistStructuredState({
      current_intent: 'chat',
      language_preference: responseLang,
      selected_products: structuredState.selected_products,
      last_question_type: structuredState.last_question_type || 'none',
      known_order_products: structuredState.known_order_products,
      constraints: structuredState.constraints,
    });
    await capturePilot(handoffResponse);
    return {
      intent: 'chat',
      response: handoffResponse,
      requiresHuman: true,
    };
  }

  // Step 2: Classify intent
  let intent = await classifyIntent(message, merchantId);
  let postDeliveryFollowUp = detectPostDeliveryFollowUpSignal(message, stateHistory);
  if (postDeliveryFollowUp.detected && postDeliveryFollowUp.promoteIntentToQuestion && intent === 'chat') {
    intent = 'question';
  }

  const derivedState = buildConversationFlowState({
    message,
    intent,
    conversationHistory: stateHistory,
    orderProducts: stickyOrderProducts,
  });
  const flowState = mergeFlowStateWithStructuredState(derivedState, structuredState);
  pilotSelectedProducts = flowState.selected_products === 'all' ? 'all' : flowState.selected_products;
  const userGoal = await inferUserGoal({
    openai,
    model: llmModel,
    message,
    intentHint: intent,
    state: flowState,
  });
  pilotInferredGoal = userGoal;
  if (userGoal === 'build_routine') {
    if (!routineIntentMetricIncremented) {
      routineIntentDetectedCount.inc();
      routineIntentMetricIncremented = true;
    }
    pilotRoutineIntentDetected = true;
    postDeliveryFollowUp = postDeliveryFollowUp.detected
      ? postDeliveryFollowUp
      : {
          detected: true,
          type: 'usage_routine_request',
          promoteIntentToQuestion: true,
          ragQueryOverride: buildUsageGuidanceRetrievalQuery(responseLang),
          plannerQueryOverride: buildUsageGuidanceRetrievalQuery(responseLang),
          promptHint:
            responseLang === 'tr'
              ? 'Kullanici amaci rutin olusturmak. Uygun tum siparis urunleri ile direkt sabah/aksam rutin ver, gereksiz netlestirme sorma.'
              : 'User goal is routine-building. Use compatible products and provide a direct morning/evening routine.',
        };
    if (intent !== 'question') intent = 'question';
  }

  if (looksLikeContextualRoutineContinuation(message, flowState)) {
    contextualContinuationResolvedCount.inc();
    if (!routineIntentMetricIncremented) {
      routineIntentDetectedCount.inc();
      routineIntentMetricIncremented = true;
    }
    pilotContextualContinuationResolved = true;
    pilotRoutineIntentDetected = true;
    postDeliveryFollowUp = {
      detected: true,
      type: 'usage_routine_request',
      promoteIntentToQuestion: true,
      ragQueryOverride: buildUsageGuidanceRetrievalQuery(responseLang),
      plannerQueryOverride: buildUsageGuidanceRetrievalQuery(responseLang),
      promptHint:
        responseLang === 'tr'
          ? 'Kisa baglamsal cevap, onceki urun secim sorusunun devami. Tum uygun urunleri kullanip dogrudan rutin ver.'
          : 'Short contextual continuation of prior product-selection question. Use all compatible products and provide routine directly.',
    };
    intent = 'question';
  }

  await persistStructuredState({
    current_intent: intent,
    current_goal: userGoal,
    language_preference: responseLang,
    selected_products: flowState.selected_products,
    last_question_type: flowState.last_question_type,
    unresolved_clarification_need: flowState.unresolved_clarification_need,
    constraints: toStructuredConstraints(flowState),
    known_order_products: structuredState.known_order_products,
  });

  const merchantName = merchant?.name || 'Biz';
  const botInfo = await getMerchantBotInfo(merchantId);

  if (postDeliveryFollowUp.detected && postDeliveryFollowUp.type === 'usage_onboarding_yes') {
    const ack = finalizeConfiguredResponse({
      response: buildPostDeliveryAcknowledgementResponse(responseLang),
      persona,
      responseLang,
      replyLanguageDecision: {
        usedFallback: replyLanguageDecision.usedFallback,
        supportedLanguages: replyLanguageDecision.supportedLanguages,
      },
    });
    await persistStructuredState({
      current_intent: intent,
      language_preference: responseLang,
      selected_products: flowState.selected_products,
      last_question_type: flowState.last_question_type,
      known_order_products: stickyOrderProducts,
      constraints: toStructuredConstraints(flowState),
    });
    await capturePilot(ack);
    return {
      intent,
      response: ack,
      requiresHuman: false,
    };
  }

  // Question answering is handled by the shared grounded-answer path.
  if (intent === 'question') {
    try {
      const structuredStateRuntimeHint = buildStructuredStatePromptContext(structuredState);
      const ragQuery = postDeliveryFollowUp.ragQueryOverride || message;
      const ragConfig = getCosmeticRagPolicy(ragQuery);
      const preferredSections = ragConfig.preferredSectionTypes;
      const orderScope = effectiveOrderId
        ? await getOrderProductContextResolved(effectiveOrderId, merchantId)
        : null;
      let orderProductIds = orderScope?.productIds?.length ? [...orderScope.productIds] : null;
      let resolvedOrderProducts: OrderProductMeta[] = [];
      let routineClassifications: RoutineProductClassification[] = [];
      let resolvedState: ConversationFlowState = flowState;
      const isRoutineFlow = postDeliveryFollowUp.detected && postDeliveryFollowUp.type === 'usage_routine_request';

      if ((!orderProductIds || orderProductIds.length === 0) && stickyOrderProducts.length > 0) {
        orderProductIds = stickyOrderProducts.map((item) => item.id);
      }

      if (orderProductIds && orderProductIds.length > 0) {
        const orderProducts = await fetchOrderProductsByIds(merchantId, orderProductIds);
        resolvedOrderProducts = orderProducts.length > 0 ? orderProducts : stickyOrderProducts;
        if (orderProducts.length > 0) {
          stickyOrderProducts = orderProducts;
          await persistStructuredState({
            known_order_products: orderProducts.map((item) => ({ id: item.id, name: item.name })),
          });
        }
        resolvedState = buildConversationFlowState({
          message,
          intent,
          conversationHistory: stateHistory,
          orderProducts: resolvedOrderProducts,
        });
        resolvedState = mergeFlowStateWithStructuredState(resolvedState, structuredState);
        pilotSelectedProducts = resolvedState.selected_products === 'all' ? 'all' : resolvedState.selected_products;
        const productResolution = resolveMentionedOrderProduct({
          message,
          conversationHistory: stateHistory,
          orderProducts: resolvedOrderProducts,
          lang: responseLang,
        });

        if (isRoutineFlow) {
          routineClassifications = await classifyRoutineProducts(openai, llmModel, orderProducts);
          const compatibleProductIds = routineClassifications
            .filter((product) => product.slot !== 'exclude')
            .map((product) => product.productId);
          if (compatibleProductIds.length > 0) {
            if (resolvedState.selected_products === 'all' || userGoal === 'build_routine') {
              orderProductIds = compatibleProductIds;
            } else if (Array.isArray(resolvedState.selected_products) && resolvedState.selected_products.length > 0) {
              orderProductIds = compatibleProductIds.filter((id) => resolvedState.selected_products.includes(id));
            } else {
              orderProductIds = compatibleProductIds;
            }
          }
        }

        if (productResolution.unknownReference && !isRoutineFlow) {
          clarificationAskedCount.inc();
          fallbackTriggeredCount.inc({ reason: 'unknown_product_safe_fallback' });
          pilotClarificationAsked = true;
          pilotGenerationMode = 'fallback';
          pilotFallbackReason = 'unknown_product_safe_fallback';
          logger.info(
            { merchantId, conversationId, reason: 'unknown_product_reference' },
            'Fallback triggered: unknown product reference',
          );
          const clarificationResponse = finalizeConfiguredResponse({
            response: buildUnknownProductSafeFallback(responseLang, resolvedOrderProducts),
            persona,
            responseLang,
            replyLanguageDecision: {
              usedFallback: replyLanguageDecision.usedFallback,
              supportedLanguages: replyLanguageDecision.supportedLanguages,
            },
          });
          await persistStructuredState({
            current_intent: intent,
            current_goal: userGoal,
            language_preference: responseLang,
            selected_products: resolvedState.selected_products,
            last_question_type: 'product_selection',
            unresolved_clarification_need: true,
            known_order_products: stickyOrderProducts.map((item) => ({ id: item.id, name: item.name })),
            constraints: {
              ...toStructuredConstraints(resolvedState),
            },
          });
          await capturePilot(clarificationResponse);
          return {
            intent: 'question',
            response: clarificationResponse,
            requiresHuman: false,
          };
        }

        if (productResolution.uncertain && !isRoutineFlow) {
          clarificationAskedCount.inc();
          fallbackTriggeredCount.inc({ reason: 'product_selection_uncertain' });
          pilotClarificationAsked = true;
          pilotGenerationMode = 'fallback';
          pilotFallbackReason = 'product_selection_uncertain';
          const clarificationResponse = finalizeConfiguredResponse({
            response: buildUnknownProductSafeFallback(responseLang, resolvedOrderProducts),
            persona,
            responseLang,
            replyLanguageDecision: {
              usedFallback: replyLanguageDecision.usedFallback,
              supportedLanguages: replyLanguageDecision.supportedLanguages,
            },
          });
          await persistStructuredState({
            current_intent: intent,
            current_goal: userGoal,
            language_preference: responseLang,
            selected_products: resolvedState.selected_products,
            last_question_type: 'product_selection',
            unresolved_clarification_need: true,
            known_order_products: stickyOrderProducts.map((item) => ({ id: item.id, name: item.name })),
            constraints: {
              ...toStructuredConstraints(resolvedState),
            },
          });
          await capturePilot(clarificationResponse);
          return {
            intent: 'question',
            response: clarificationResponse,
            requiresHuman: false,
          };
        }

        if (productResolution.productId && !isRoutineFlow) {
          orderProductIds = [productResolution.productId];
        }
      }

      const ragCacheKey = buildRagCacheKey({
        merchantId,
        query: ragQuery,
        productIds: orderProductIds,
        topK: ragConfig.topK,
        similarityThreshold: ragConfig.similarityThreshold,
        preferredSectionTypes: preferredSections || null,
        preferredLanguage: userLang,
      });

      let grounded = await generateGroundedProductAnswer({
        merchantId,
        question: message,
        userLang,
        channel: 'whatsapp',
        intent: 'question',
        orderId: effectiveOrderId,
        conversationId,
        conversationHistory: modelHistory.history,
        merchantName,
        persona,
        botInfo,
        retrievalQuery: ragQuery,
        plannerQuery: postDeliveryFollowUp.plannerQueryOverride || message,
        runtimeHint: isRoutineFlow
          ? `${postDeliveryFollowUp.promptHint || ''}\n${structuredStateRuntimeHint}\nOutput format: brief intro + Morning + Evening. Use real product names. Avoid clarification questions unless truly blocked.`
          : `${postDeliveryFollowUp.promptHint || ''}\n${structuredStateRuntimeHint}`.trim(),
        productIds: orderProductIds || undefined,
        instructionScope: 'order_only',
        topK: ragConfig.topK,
        similarityThreshold: ragConfig.similarityThreshold,
        preferredSectionTypes: preferredSections,
        cacheKey: ragCacheKey,
        cacheTtlSeconds: 900,
      });

      let answer = grounded.answer;
      if (isRoutineFlow && resolvedOrderProducts.length > 0) {
        if (routineClassifications.length === 0) {
          routineClassifications = await classifyRoutineProducts(openai, llmModel, resolvedOrderProducts);
        }

        let routineQuality = validateRoutineAnswerQuality(answer, routineClassifications);
        if (!routineQuality.ok) {
          routineQualityRegeneratedCount.inc();
          pilotRegenerated = true;
          pilotGenerationMode = 'regenerated';
          logger.info(
            { merchantId, conversationId, reasons: routineQuality.reasons },
            'Routine response quality validation failed, retrying with stricter instructions',
          );
          grounded = await generateGroundedProductAnswer({
            merchantId,
            question: message,
            userLang,
            channel: 'whatsapp',
            intent: 'question',
            orderId: effectiveOrderId,
            conversationId,
            conversationHistory: modelHistory.history,
            merchantName,
            persona,
            botInfo,
            retrievalQuery: ragQuery,
            plannerQuery: postDeliveryFollowUp.plannerQueryOverride || message,
            runtimeHint:
              `Return ONLY a practical routine with real product names from available context. Format: Morning then Evening. No generic clarification.\n${structuredStateRuntimeHint}`,
            productIds: orderProductIds || undefined,
            instructionScope: 'order_only',
            topK: ragConfig.topK,
            similarityThreshold: ragConfig.similarityThreshold,
            preferredSectionTypes: preferredSections,
            cacheKey: ragCacheKey,
            cacheTtlSeconds: 900,
          });
          answer = grounded.answer;
          routineQuality = validateRoutineAnswerQuality(answer, routineClassifications);
        }

        if (!routineQuality.ok || grounded.citedProducts.length === 0 || looksLikeEvidenceClarificationAnswer(answer)) {
          bestEffortRoutineUsedCount.inc();
          fallbackTriggeredCount.inc({ reason: 'routine_best_effort' });
          pilotBestEffortRoutineUsed = true;
          pilotGenerationMode = 'fallback';
          pilotFallbackReason = 'routine_best_effort';
          pilotExcludedProducts = routineClassifications
            .filter((product) => product.slot === 'exclude')
            .map((product) => ({ name: product.name, reason: product.exclusionReason }));
          logger.info(
            {
              merchantId,
              conversationId,
              reason: 'routine_best_effort_fallback',
              qualityReasons: routineQuality.reasons,
            },
            'Fallback triggered: best-effort routine builder',
          );
          const routineFallbackResponse = finalizeConfiguredResponse({
            response: buildBestEffortRoutineResponse(responseLang, routineClassifications, persona, resolvedState),
            persona,
            responseLang,
            replyLanguageDecision: {
              usedFallback: replyLanguageDecision.usedFallback,
              supportedLanguages: replyLanguageDecision.supportedLanguages,
            },
          });
          await persistStructuredState({
            current_intent: intent,
            current_goal: userGoal,
            language_preference: responseLang,
            selected_products: resolvedState.selected_products === 'all'
              ? 'all'
              : (orderProductIds || resolvedOrderProducts.map((item) => item.id)),
            last_question_type: 'routine_builder',
            unresolved_clarification_need: false,
            known_order_products: stickyOrderProducts.map((item) => ({ id: item.id, name: item.name })),
            constraints: toStructuredConstraints(resolvedState),
          });
          await capturePilot(routineFallbackResponse);
          return {
            intent,
            response: routineFallbackResponse,
            ragContext: grounded.ragContext,
            guardrailBlocked: false,
            requiresHuman: false,
          };
        }

        answer = `${answer.trim()}${buildRoutineExclusionNote(responseLang, routineClassifications)}`.trim();
        logger.info(
          {
            merchantId,
            conversationId,
            includedProducts: routineClassifications.filter((product) => product.slot !== 'exclude').map((product) => product.name),
            excludedProducts: routineClassifications.filter((product) => product.slot === 'exclude').map((product) => ({
              name: product.name,
              reason: product.exclusionReason || 'Not routine-compatible',
            })),
          },
          'Routine builder used with compatibility filtering',
        );
        pilotExcludedProducts = routineClassifications
          .filter((product) => product.slot === 'exclude')
          .map((product) => ({ name: product.name, reason: product.exclusionReason }));
      }

      const responseGuardrail = checkAIResponseGuardrails(answer, {
        customGuardrails,
        languageHint: responseLang,
      });

      let finalAnswer = answer;
      if (!responseGuardrail.safe) {
        fallbackTriggeredCount.inc({ reason: `ai_response_guardrail_${responseGuardrail.reason || 'custom'}` });
        pilotGenerationMode = 'fallback';
        pilotFallbackReason = `ai_response_guardrail_${responseGuardrail.reason || 'custom'}`;
        finalAnswer = responseGuardrail.suggestedResponse || getSafeResponse(responseGuardrail.reason ?? 'custom');

        if (responseGuardrail.requiresHuman) {
          pilotEscalationDecision = { escalated: true, reason: responseGuardrail.reason || 'custom' };
          logger.warn(
            { merchantId, conversationId, reason: responseGuardrail.reason ?? 'custom' },
            'Escalation triggered by AI response guardrail',
          );
          await escalateToHuman(userId, conversationId, responseGuardrail.reason ?? 'custom', finalAnswer);
        }
      }
      finalAnswer = finalizeConfiguredResponse({
        response: finalAnswer,
        persona,
        responseLang,
        replyLanguageDecision: {
          usedFallback: replyLanguageDecision.usedFallback,
          supportedLanguages: replyLanguageDecision.supportedLanguages,
        },
      });
      if (stickyOrderProducts.length > 0 && asksForPurchasedProductInfo(finalAnswer)) {
        const recovered = isRoutineFlow
          ? buildBestEffortRoutineResponse(
            responseLang,
            routineClassifications.length > 0
              ? routineClassifications
              : stickyOrderProducts.map(classifyRoutineProductHeuristic),
            persona,
            resolvedState,
          )
          : buildKnownProductsRecoveryResponse(responseLang, stickyOrderProducts);
        finalAnswer = finalizeConfiguredResponse({
          response: recovered,
          persona,
          responseLang,
          replyLanguageDecision: {
            usedFallback: replyLanguageDecision.usedFallback,
            supportedLanguages: replyLanguageDecision.supportedLanguages,
          },
        });
      }
      if (looksLikeEvidenceClarificationAnswer(finalAnswer)) {
        clarificationAskedCount.inc();
        pilotClarificationAsked = true;
      }
      await capturePilot(finalAnswer);

      await persistStructuredState({
        current_intent: intent,
        current_goal: userGoal,
        language_preference: responseLang,
        selected_products: resolvedState.selected_products === 'all'
          ? 'all'
          : (orderProductIds || resolvedOrderProducts.map((item) => item.id)),
        last_question_type: isRoutineFlow ? 'routine_builder' : 'usage_how',
        unresolved_clarification_need: false,
        known_order_products: stickyOrderProducts.map((item) => ({ id: item.id, name: item.name })),
        constraints: toStructuredConstraints(resolvedState),
      });

      logger.info(
        {
          merchantId,
          conversationId,
          orderId: effectiveOrderId,
          intent,
          userGoal,
          conversationState: flowState,
          userLang,
          postDeliveryFollowUp: postDeliveryFollowUp.detected ? postDeliveryFollowUp.type : null,
          responseLang: detectLanguage(finalAnswer),
          guardrailBlocked: !responseGuardrail.safe,
          ragUsed: Boolean(grounded.ragContext),
          citedProducts: grounded.citedProducts,
          usedDeterministicFacts: grounded.usedDeterministicFacts,
          orderScopeSource: grounded.orderScopeSource || (effectiveOrderId ? 'none' : 'not_applicable'),
        },
        'AI response generated via grounded answer service'
      );

      return {
        intent,
        response: finalAnswer,
        ragContext: grounded.ragContext,
        guardrailBlocked: !responseGuardrail.safe,
        guardrailReason: responseGuardrail.safe ? undefined : responseGuardrail.reason,
        guardrailCustomName: responseGuardrail.safe ? undefined : responseGuardrail.customReason,
        requiresHuman: responseGuardrail.safe ? false : responseGuardrail.requiresHuman,
      };
    } catch (error) {
      logger.error({ error, merchantId, conversationId, orderId: effectiveOrderId }, 'Shared grounded answer service failed');
      fallbackTriggeredCount.inc({ reason: 'grounded_answer_error' });
      pilotGenerationMode = 'fallback';
      pilotFallbackReason = 'grounded_answer_error';
      logger.info(
        { merchantId, conversationId, reason: 'grounded_answer_error' },
        'Fallback triggered: grounded answer unavailable',
      );
      const fallbackAnswer = stickyOrderProducts.length > 0
        ? buildKnownProductsRecoveryResponse(responseLang, stickyOrderProducts)
        : responseLang === 'tr'
          ? 'Sorunu güvenilir şekilde yanitlamak icin yeterli urun bilgisine simdi erisemiyorum. Siparis numaranizi paylasir misiniz?'
          : responseLang === 'hu'
            ? 'Most nem erek el eleg megbizhato termekinformaciot a valaszhoz. Megirna a rendelesszamat?'
            : responseLang === 'de'
              ? 'Ich kann im Moment nicht zuverlässig genug auf Produktinformationen zugreifen, um sicher zu antworten. Können Sie mir Ihre Bestellnummer senden?'
              : responseLang === 'el'
                ? 'Δεν μπορώ να αποκτήσω αρκετά αξιόπιστες πληροφορίες προϊόντος αυτή τη στιγμή για να απαντήσω με ασφάλεια. Μπορείτε να μοιραστείτε τον αριθμό παραγγελίας σας;'
                : 'I cannot access enough reliable product information right now to answer safely. Could you share your order number?';
      return {
        intent,
        response: await (async () => {
          const v = finalizeConfiguredResponse({
          response: fallbackAnswer,
          persona,
          responseLang,
          replyLanguageDecision: {
            usedFallback: replyLanguageDecision.usedFallback,
            supportedLanguages: replyLanguageDecision.supportedLanguages,
          },
          });
          await persistStructuredState({
            current_intent: intent,
            language_preference: responseLang,
            selected_products: flowState.selected_products,
            last_question_type: flowState.last_question_type,
            known_order_products: stickyOrderProducts.map((item) => ({ id: item.id, name: item.name })),
            constraints: toStructuredConstraints(flowState),
          });
          await capturePilot(v);
          return v;
        })(),
        guardrailBlocked: false,
        requiresHuman: false,
      };
    }
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
        pilotEscalationDecision = { escalated: true, reason: 'return_intent_insistence' };
        await escalateToHuman(userId, conversationId, 'return_intent_insistence', message);
        const lang = responseLang;
        const escalationResponse = finalizeConfiguredResponse({
          response: getLocalizedEscalationResponse(lang),
          persona,
          responseLang,
          replyLanguageDecision: {
            usedFallback: replyLanguageDecision.usedFallback,
            supportedLanguages: replyLanguageDecision.supportedLanguages,
          },
        });
        await persistStructuredState({
          current_intent: intent,
          language_preference: responseLang,
          selected_products: flowState.selected_products,
          last_question_type: flowState.last_question_type,
          known_order_products: stickyOrderProducts.map((item) => ({ id: item.id, name: item.name })),
          constraints: toStructuredConstraints(flowState),
        });
        await capturePilot(escalationResponse);
        return {
          intent,
          response: escalationResponse,
          requiresHuman: true,
        };
      }
    }
  }

  // If the previous state was return_intent but now user is positive, mark as prevented
  if (intent === 'chat') {
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

  // Step 3: Get RAG context for return prevention flows.
  let ragContext = '';
  let factsEvidenceText = '';
  if (intent === 'return_intent' && returnPreventionActive) {
    try {
      const ragQuery = postDeliveryFollowUp.ragQueryOverride || message;
      let orderProductIds: string[] | undefined;
      let orderScopeSource: string | undefined;
      if (effectiveOrderId) {
        const orderScope = await getOrderProductContextResolved(effectiveOrderId, merchantId);
        orderProductIds = orderScope.productIds;
        orderScopeSource = orderScope.source;
        if (orderProductIds && orderProductIds.length > 0) {
          const knownProducts = await fetchOrderProductsByIds(merchantId, orderProductIds);
          if (knownProducts.length > 0) {
            stickyOrderProducts = knownProducts;
            await persistStructuredState({
              known_order_products: knownProducts.map((item) => ({ id: item.id, name: item.name })),
            });
          }
        }
      }
      // RAG: semantic search (order products if any).
      // Safety: when an order exists but we cannot resolve products, do NOT broaden to all merchant products.
      const ragConfig = getCosmeticRagPolicy(ragQuery);
      const queryLang = userLang;
      const preferredSections = ragConfig.preferredSectionTypes;
      const ragCacheKey = buildRagCacheKey({
        merchantId,
        query: ragQuery,
        productIds: orderProductIds?.length ? orderProductIds : null,
        topK: ragConfig.topK,
        similarityThreshold: ragConfig.similarityThreshold,
        preferredSectionTypes: preferredSections || null,
        preferredLanguage: queryLang,
      });
      const ragResult =
        effectiveOrderId && (!orderProductIds || orderProductIds.length === 0)
          ? {
              query: ragQuery,
              results: [],
              totalResults: 0,
              executionTime: 0,
              effectiveLanguage: queryLang,
              usedFallback: false,
              fallbackLanguage: null,
            }
          : await new UnifiedRetrievalService().retrieve({
              merchantId,
              question: ragQuery,
              userLang: queryLang,
              productIds: orderProductIds?.length ? orderProductIds : undefined,
              topK: ragConfig.topK,
              similarityThreshold: ragConfig.similarityThreshold,
              preferredSectionTypes: preferredSections,
              cacheKey: ragCacheKey,
              cacheTtlSeconds: 900,
            });

      logger.info(
        {
          merchantId,
          conversationId,
          orderId: effectiveOrderId,
          intent,
          queryLang,
          postDeliveryFollowUp: postDeliveryFollowUp.detected ? postDeliveryFollowUp.type : null,
          ragQueryOverridden: ragQuery !== message,
          orderScopeSource: orderScopeSource || (effectiveOrderId ? 'none' : 'not_applicable'),
          ragProfile: ragConfig.profile,
          retrievalLanguage: ragResult.effectiveLanguage,
          retrievalUsedFallback: ragResult.usedFallback,
          retrievalFallbackLanguage: ragResult.fallbackLanguage,
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

      // Policy: usage instructions are only included for products in the customer's own order.
      let instructionProductIds: string[] = [];
      if (effectiveOrderId && orderProductIds && orderProductIds.length > 0) {
        instructionProductIds = orderProductIds;
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
          factsEvidenceText = factsContext.text;
          ragContext = buildGroundedEvidenceContext({
            factsText: factsEvidenceText,
            ragResults: ragResult.results,
          });
        }
        logger.info(
          {
            merchantId,
            conversationId,
            orderId: effectiveOrderId,
            factsProductIdsCount: factsProductIds.length,
            factsSnapshotsFound: factsContext.factCount,
          },
          'AI response facts context trace'
        );
      }

      if (instructionProductIds.length > 0) {
        const instructions = await getProductInstructionsByProductIds(merchantId, instructionProductIds);
        if (instructions.length > 0) {
          ragContext = buildGroundedEvidenceContext({
            factsText: factsEvidenceText,
            instructions,
            ragResults: ragResult.results,
          });
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
    botInfo,
    responseLang,
    replyLanguageDecision.usedFallback ? userLang : undefined,
    replyLanguageDecision.supportedLanguages,
  );
  const runtimeHint = postDeliveryFollowUp.promptHint;
  const structuredStatePrompt = buildStructuredStatePromptContext(structuredState);
  const finalSystemPrompt = runtimeHint
    ? `${systemPrompt}\n${structuredStatePrompt}\nRUNTIME CONVERSATION HINT:\n- ${runtimeHint}\n`
    : `${systemPrompt}\n${structuredStatePrompt}\n`;

  // Step 5: Build conversation messages
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: finalSystemPrompt,
    },
  ];

  // Add conversation history (last 10 messages)
  const recentHistory = modelHistory.history;
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
        orderId: effectiveOrderId || null,
        intent,
        ragUsed: Boolean(ragContext),
      },
    });

    let aiResponse = response.choices[0]?.message?.content || '';

    // Step 7: Check guardrails for AI response (system + custom)
    const responseGuardrail = checkAIResponseGuardrails(aiResponse, {
      customGuardrails,
      languageHint: responseLang,
    });

    if (!responseGuardrail.safe) {
      fallbackTriggeredCount.inc({ reason: `ai_response_guardrail_${responseGuardrail.reason || 'custom'}` });
      pilotGenerationMode = 'fallback';
      pilotFallbackReason = `ai_response_guardrail_${responseGuardrail.reason || 'custom'}`;
      aiResponse = responseGuardrail.suggestedResponse || getSafeResponse(responseGuardrail.reason ?? 'custom');

      if (responseGuardrail.requiresHuman) {
        pilotEscalationDecision = { escalated: true, reason: responseGuardrail.reason || 'custom' };
        logger.warn(
          { merchantId, conversationId, reason: responseGuardrail.reason ?? 'custom' },
          'Escalation triggered by AI response guardrail',
        );
        await escalateToHuman(userId, conversationId, responseGuardrail.reason ?? 'custom', aiResponse);
      }

      const guardedResponse = finalizeConfiguredResponse({
        response: aiResponse,
        persona,
        responseLang,
        replyLanguageDecision: {
          usedFallback: replyLanguageDecision.usedFallback,
          supportedLanguages: replyLanguageDecision.supportedLanguages,
        },
      });
      await persistStructuredState({
        current_intent: intent,
        current_goal: pilotInferredGoal,
        language_preference: responseLang,
        selected_products: flowState.selected_products,
        last_question_type: flowState.last_question_type,
        unresolved_clarification_need: flowState.unresolved_clarification_need,
        known_order_products: stickyOrderProducts.map((item) => ({ id: item.id, name: item.name })),
        constraints: toStructuredConstraints(flowState),
      });
      await capturePilot(guardedResponse);
      return {
        intent,
        response: guardedResponse,
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
          orderId: effectiveOrderId,
          triggerMessage: message,
          preventionResponse: aiResponse,
        });
      } catch (err) {
        logger.error({ err }, 'Failed to log return prevention attempt');
      }
    }

    // Step 8b: Check for satisfaction and trigger upsell if appropriate
    let upsellResult = null;
    if (intent === 'chat' && effectiveOrderId) {
      // Check if user is satisfied (positive sentiment in chat)
      try {
        upsellResult = await processSatisfactionCheck(
          userId,
          effectiveOrderId,
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
        orderId: effectiveOrderId,
        intent,
        userLang,
        responseLanguage: responseLang,
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

    let finalConfiguredResponse = finalizeConfiguredResponse({
      response: aiResponse,
      persona,
      responseLang,
      replyLanguageDecision: {
        usedFallback: replyLanguageDecision.usedFallback,
        supportedLanguages: replyLanguageDecision.supportedLanguages,
      },
    });
    if (stickyOrderProducts.length > 0 && asksForPurchasedProductInfo(finalConfiguredResponse)) {
      finalConfiguredResponse = finalizeConfiguredResponse({
        response: buildKnownProductsRecoveryResponse(responseLang, stickyOrderProducts),
        persona,
        responseLang,
        replyLanguageDecision: {
          usedFallback: replyLanguageDecision.usedFallback,
          supportedLanguages: replyLanguageDecision.supportedLanguages,
        },
      });
    }
    await persistStructuredState({
      current_intent: intent,
      current_goal: pilotInferredGoal,
      language_preference: responseLang,
      selected_products: flowState.selected_products,
      last_question_type: flowState.last_question_type,
      unresolved_clarification_need: flowState.unresolved_clarification_need,
      known_order_products: stickyOrderProducts.map((item) => ({ id: item.id, name: item.name })),
      constraints: toStructuredConstraints(flowState),
    });
    await capturePilot(finalConfiguredResponse);
    return {
      intent,
      response: finalConfiguredResponse,
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
  botInfo?: Record<string, string>,
  responseLang: SupportedLanguage = 'en',
  requestedLang?: SupportedLanguage,
  supportedLanguages: SupportedLanguage[] = ['en'],
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
    `- Always respond in ${responseLang}\n` +
    (
      requestedLang && requestedLang !== responseLang
        ? `- The user wrote in ${requestedLang}, but this merchant currently replies only in: ${supportedLanguages.join(', ')}. Do not switch back to ${requestedLang}.\n`
        : ''
    ) +
    '- Be natural and conversational\n' +
    '- Focus on being helpful and solving the customer\'s need\n';

  return prompt;
}
