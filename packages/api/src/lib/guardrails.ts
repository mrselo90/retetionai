/**
 * Guardrails for AI responses
 * Safety checks and content filtering.
 * System guardrails (crisis, medical) are read-only; merchants can add custom guardrails via settings.
 */

import { getSupabaseServiceClient } from '@recete/shared';
import { notifyMerchantOfEscalation } from './notifications.js';
import { decryptPhone } from './encryption.js';
import {
  detectLanguage,
  getLocalizedClarificationResponse,
  getLocalizedCrisisResponse,
  getLocalizedMedicalResponse,
  type SupportedLanguage,
} from './i18n.js';

export interface GuardrailResult {
  safe: boolean;
  reason?: 'crisis_keyword' | 'medical_advice' | 'unsafe_content' | 'custom';
  /** Set when reason is 'custom' (name of the custom guardrail that matched) */
  customReason?: string;
  requiresHuman: boolean;
  suggestedResponse?: string;
}

/** Custom guardrail rule (stored per merchant, editable in settings) */
export interface CustomGuardrail {
  id: string;
  name: string;
  /** Optional description shown in UI */
  description?: string;
  /** When to apply: user message, AI response, or both */
  apply_to: 'user_message' | 'ai_response' | 'both';
  /** Match by keywords (any of) or single phrase (contains) */
  match_type: 'keywords' | 'phrase';
  /** Keywords array or single phrase string */
  value: string[] | string;
  /** block = replace with suggested response; escalate = same + flag for human */
  action: 'block' | 'escalate';
  suggested_response?: string;
}

/** Read-only system guardrail (shown in UI, cannot be edited/deleted) */
export interface SystemGuardrailDefinition {
  id: string;
  name: string;
  name_tr?: string;
  description: string;
  description_tr?: string;
  apply_to: 'user_message' | 'ai_response' | 'both';
  action: 'block' | 'escalate';
  editable: false;
}

export const SYSTEM_GUARDRAILS: SystemGuardrailDefinition[] = [
  {
    id: 'crisis_keyword',
    name: 'Crisis / emergency',
    name_tr: 'Kriz / acil durum',
    description: 'Triggers when the message contains crisis-related keywords (e.g. emergency, suicide, hospital, lawsuit). Conversation is escalated to human.',
    description_tr: 'Mesajda kriz veya acil durum ifadeleri (acil, intihar, hastane, dava vb.) geçtiğinde tetiklenir. Konuşma insan temsilciye yönlendirilir.',
    apply_to: 'both',
    action: 'escalate',
    editable: false,
  },
  {
    id: 'medical_advice',
    name: 'Medical advice',
    name_tr: 'Tıbbi tavsiye',
    description: 'Blocks requests for medical advice (e.g. treatment, diagnosis). Bot responds with a safe message and does not give health advice.',
    description_tr: 'Tıbbi tavsiye taleplerini engeller (tedavi, teşhis vb.). Bot güvenli bir yanıt verir, sağlık tavsiyesi vermez.',
    apply_to: 'both',
    action: 'block',
    editable: false,
  },
];

/**
 * Crisis keywords (Turkish and English)
 * These trigger human escalation
 */
const CRISIS_KEYWORDS = [
  // Turkish
  'yanık',
  'yanıklar',
  'acı',
  'ağrı',
  'ağrıyor',
  'acıyor',
  'dava',
  'dava açacağım',
  'avukat',
  'hukuki',
  'tazminat',
  'zarar',
  'hastane',
  'acil',
  'acil servis',
  'ambulans',
  'ölüm',
  'ölüyorum',
  'intihar',
  'kendimi öldüreceğim',
  'zehir',
  'zehirlendim',
  'alerji',
  'alerjik reaksiyon',
  'şok',
  'bayılma',
  'bayıldım',
  // English
  'burn',
  'burns',
  'pain',
  'hurts',
  'lawsuit',
  'sue',
  'lawyer',
  'legal',
  'compensation',
  'damage',
  'hospital',
  'emergency',
  'ambulance',
  'death',
  'dying',
  'suicide',
  'end my life',
  'kill myself',
  'kill yourself',
  'poison',
  'poisoned',
  'allergy',
  'allergic reaction',
  'shock',
  'fainting',
  'fainted',
  // Hungarian
  'égés',
  'fáj',
  'fájdalom',
  'kórház',
  'mentő',
  'sürgős',
  'sürgősségi',
  'allergia',
  'allergiás reakció',
  'ügyvéd',
  'kártérítés',
  'per',
  'halál',
  'méreg',
  'mérgezés',
  'öngyilkosság',
  'ájulás',
  'sokk',
];

/**
 * Human handoff request phrases (Turkish + English)
 * These trigger immediate escalation to a human agent even when the bot is otherwise functional.
 */
const HUMAN_HANDOFF_PHRASES = [
  // Turkish
  'insan temsilci',
  'insanla konuşmak',
  'insanla görüşmek',
  'gerçek biri',
  'insan ile bağlan',
  'canlı destek',
  'canlı yardım',
  'müşteri hizmetleri',
  'müşteri temsilcisi',
  'yetkili',
  'yönetici',
  'ekibinizle',
  'sizi aramak',
  'sizi arayabilir miyim',
  'beni arasın',
  'beni ararsın',
  'telefon numarası',
  'bot değil',
  'robot değil',
  'insanla bağlan',
  // English
  'speak to a human',
  'speak to a person',
  'talk to a person',
  'talk to a human',
  'talk to someone',
  'real person',
  'real agent',
  'customer service',
  'customer support',
  'representative',
  'human agent',
  'live agent',
  'live support',
  'live chat',
  'call me',
  'phone number',
  'not a bot',
  'not a robot',
  'connect me',
  // Hungarian
  'élő személy',
  'valódi ember',
  'ügyfélszolgálat',
  'emberi segítség',
  'beszélni szeretnék',
  'képviselő',
  'nem robot',
  'nem bot',
  'hívjon vissza',
];

/**
 * Medical advice keywords
 * These should block medical advice responses
 */
const MEDICAL_ADVICE_KEYWORDS = [
  // Turkish
  'tedavi',
  'ilaç',
  'hastane',
  'doktor',
  'doktora git',
  'tedavi et',
  'nasıl iyileşir',
  'iyileştir',
  'tıbbi',
  'tıbbi tavsiye',
  'teşhis',
  'hastalık',
  'hasta',
  'semptom',
  'belirti',
  // English
  'treatment',
  'medicine',
  'medication',
  'hospital',
  'doctor',
  'see a doctor',
  'cure',
  'heal',
  'medical',
  'medical advice',
  'diagnosis',
  'diagnose',
  'disease',
  'sick',
  'symptom',
  // Hungarian
  'kezelés',
  'gyógyszer',
  'orvos',
  'orvoshoz',
  'tünet',
  'diagnózis',
  'betegség',
  'beteg',
  'gyógyít',
  'orvosi tanács',
];

/**
 * Check if message contains crisis keywords
 */
function containsCrisisKeywords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return CRISIS_KEYWORDS.some((keyword) => {
    // Use word boundary for exact word matching to avoid false positives (e.g. "acı" in "yardımcı")
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(lowerText);
  });
}

/**
 * Check if message requests medical advice
 */
function requestsMedicalAdvice(text: string): boolean {
  const lowerText = text.toLowerCase();
  return MEDICAL_ADVICE_KEYWORDS.some((keyword) => {
    // Use word boundary for exact word matching
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    return regex.test(lowerText);
  });
}

export interface GuardrailCheckOptions {
  customGuardrails?: CustomGuardrail[];
  languageHint?: SupportedLanguage;
}

/**
 * Check custom guardrail rules against text.
 * Returns first matching rule (if any); applies_to must include applyTo.
 */
function checkCustomGuardrails(
  text: string,
  customGuardrails: CustomGuardrail[],
  applyTo: 'user_message' | 'ai_response'
): GuardrailResult | null {
  const lowerText = text.toLowerCase();
  for (const rule of customGuardrails) {
    if (rule.apply_to !== applyTo && rule.apply_to !== 'both') continue;
    let matched = false;
    if (rule.match_type === 'keywords') {
      const keywords = Array.isArray(rule.value) ? rule.value : [rule.value];
      matched = keywords.some((k) => typeof k === 'string' && lowerText.includes((k as string).toLowerCase()));
    } else {
      const phrase = typeof rule.value === 'string' ? rule.value : (Array.isArray(rule.value) ? rule.value[0] : '');
      matched = typeof phrase === 'string' && phrase.length > 0 && lowerText.includes(phrase.toLowerCase());
    }
    if (matched) {
      return {
        safe: false,
        reason: 'custom',
        customReason: rule.name,
        requiresHuman: rule.action === 'escalate',
        suggestedResponse:
          rule.suggested_response?.trim() ||
          'Bu konuda yardımcı olamam. Başka bir sorunuz varsa yanıtlamaktan mutluluk duyarım.',
      };
    }
  }
  return null;
}

/**
 * Check guardrails for user message (system + optional custom)
 */
export function checkUserMessageGuardrails(
  userMessage: string,
  options?: GuardrailCheckOptions
): GuardrailResult {
  // Detect language for localized responses
  const lang = detectLanguage(userMessage);

  // 1. System: crisis keywords
  if (containsCrisisKeywords(userMessage)) {
    return {
      safe: false,
      reason: 'crisis_keyword',
      requiresHuman: true,
      suggestedResponse: getLocalizedCrisisResponse(lang),
    };
  }

  // 2. System: medical advice requests
  if (requestsMedicalAdvice(userMessage)) {
    return {
      safe: false,
      reason: 'medical_advice',
      requiresHuman: false,
      suggestedResponse: getLocalizedMedicalResponse(lang),
    };
  }

  // 3. Custom guardrails (user message)
  const custom = options?.customGuardrails;
  if (custom?.length) {
    const result = checkCustomGuardrails(userMessage, custom, 'user_message');
    if (result) return result;
  }

  return {
    safe: true,
    requiresHuman: false,
  };
}

/**
 * Check guardrails for AI-generated response (system + optional custom)
 */
export function checkAIResponseGuardrails(
  aiResponse: string,
  options?: GuardrailCheckOptions
): GuardrailResult {
  const lang = options?.languageHint ?? detectLanguage(aiResponse);

  // 1. System: crisis-related content in AI response
  if (containsCrisisKeywords(aiResponse)) {
    return {
      safe: false,
      reason: 'crisis_keyword',
      requiresHuman: true,
      suggestedResponse: getLocalizedClarificationResponse(lang),
    };
  }

  // 2. System: medical advice in AI response
  if (requestsMedicalAdvice(aiResponse)) {
    return {
      safe: false,
      reason: 'medical_advice',
      requiresHuman: false,
      suggestedResponse: getLocalizedMedicalResponse(lang),
    };
  }

  // 3. Custom guardrails (AI response)
  const custom = options?.customGuardrails;
  if (custom?.length) {
    const result = checkCustomGuardrails(aiResponse, custom, 'ai_response');
    if (result) return result;
  }

  return {
    safe: true,
    requiresHuman: false,
  };
}

/**
 * Check if message is explicitly requesting a human agent handoff.
 * Returns true when user wants a human to take over, regardless of other guardrails.
 */
export function checkForHumanHandoffRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return HUMAN_HANDOFF_PHRASES.some((phrase) => lower.includes(phrase));
}

/**
 * Escalate to human — marks conversation in DB, notifies merchant, logs the event
 */
export async function escalateToHuman(
  userId: string,
  conversationId: string,
  reason: string,
  message: string
): Promise<void> {
  console.log('🚨 Human escalation required:', {
    userId,
    conversationId,
    reason,
    message: message.substring(0, 100),
  });

  try {
    const supabase = getSupabaseServiceClient();

    // 1. Update conversation status → 'human'
    await supabase
      .from('conversations')
      .update({
        conversation_status: 'human',
        escalated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    // 2. Fetch user info for notification
    const { data: user } = await supabase
      .from('users')
      .select('name, phone, merchant_id')
      .eq('id', userId)
      .single();

    if (!user) {
      console.warn('[Escalation] User not found, skipping merchant notification');
      return;
    }

    // 3. Decrypt customer phone for display
    let customerPhone = 'N/A';
    try {
      customerPhone = decryptPhone(user.phone);
    } catch {
      customerPhone = '***';
    }

    // 4. Notify merchant (non-blocking — failure should not break the conversation flow)
    await notifyMerchantOfEscalation({
      merchantId: user.merchant_id,
      customerName: user.name || 'Bilinmeyen Müşteri',
      customerPhone,
      conversationId,
      triggerMessage: message,
      reason,
    });

    console.log(`[Escalation] ✅ Conversation ${conversationId} marked as human, merchant notified`);
  } catch (error) {
    // Don't block the bot — log the error but continue
    console.error('[Escalation] DB update or notification failed:', error);
  }
}

/**
 * Get safe response for blocked content (used when no suggestedResponse is provided)
 */
export function getSafeResponse(
  reason: 'crisis_keyword' | 'medical_advice' | 'unsafe_content' | 'custom'
): string {
  const responses: Record<string, string> = {
    crisis_keyword:
      "Anladım, bu ciddi bir durum gibi görünüyor. Lütfen acil durumlar için 112'yi arayın veya en yakın acil servise başvurun. Size daha iyi yardımcı olabilmemiz için lütfen müşteri hizmetlerimizle iletişime geçin.",
    medical_advice:
      'Üzgünüm, tıbbi tavsiye veremem. Sağlık sorunlarınız için lütfen bir sağlık uzmanına danışın. Ürün kullanımı hakkında sorularınız varsa, size yardımcı olabilirim.',
    unsafe_content:
      'Bu konuda yardımcı olamam. Ürün kullanımı, siparişiniz veya genel sorularınızla ilgili başka bir sorunuz varsa memnuniyetle yardımcı olurum.',
    custom:
      'Bu konuda yardımcı olamam. Başka bir sorunuz varsa yanıtlamaktan mutluluk duyarım.',
  };

  return responses[reason] ?? responses.custom;
}
