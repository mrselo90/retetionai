/**
 * Guardrails for AI responses
 * Safety checks and content filtering
 */

export interface GuardrailResult {
  safe: boolean;
  reason?: 'crisis_keyword' | 'medical_advice' | 'unsafe_content';
  requiresHuman: boolean;
  suggestedResponse?: string;
}

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
  'kill myself',
  'poison',
  'poisoned',
  'allergy',
  'allergic reaction',
  'shock',
  'fainting',
  'fainted',
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
];

/**
 * Check if message contains crisis keywords
 */
function containsCrisisKeywords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return CRISIS_KEYWORDS.some((keyword) => lowerText.includes(keyword));
}

/**
 * Check if message requests medical advice
 */
function requestsMedicalAdvice(text: string): boolean {
  const lowerText = text.toLowerCase();
  return MEDICAL_ADVICE_KEYWORDS.some((keyword) => lowerText.includes(keyword));
}

/**
 * Check guardrails for user message
 */
export function checkUserMessageGuardrails(
  userMessage: string
): GuardrailResult {
  // Check for crisis keywords
  if (containsCrisisKeywords(userMessage)) {
    return {
      safe: false,
      reason: 'crisis_keyword',
      requiresHuman: true,
      suggestedResponse:
        "Anladım, bu ciddi bir durum gibi görünüyor. Lütfen acil durumlar için 112'yi arayın veya en yakın acil servise başvurun. Size daha iyi yardımcı olabilmemiz için lütfen müşteri hizmetlerimizle iletişime geçin.",
    };
  }

  // Check for medical advice requests
  if (requestsMedicalAdvice(userMessage)) {
    return {
      safe: false,
      reason: 'medical_advice',
      requiresHuman: false,
      suggestedResponse:
        'Üzgünüm, tıbbi tavsiye veremem. Sağlık sorunlarınız için lütfen bir sağlık uzmanına danışın. Ürün kullanımı hakkında sorularınız varsa, size yardımcı olabilirim.',
    };
  }

  return {
    safe: true,
    requiresHuman: false,
  };
}

/**
 * Check guardrails for AI-generated response
 */
export function checkAIResponseGuardrails(
  aiResponse: string
): GuardrailResult {
  // Check if AI response contains crisis-related content
  if (containsCrisisKeywords(aiResponse)) {
    return {
      safe: false,
      reason: 'crisis_keyword',
      requiresHuman: true,
      suggestedResponse:
        'Size nasıl yardımcı olabilirim? Sorunuzu daha iyi anlayabilmem için lütfen detay verin.',
    };
  }

  // Check if AI response gives medical advice
  if (requestsMedicalAdvice(aiResponse)) {
    return {
      safe: false,
      reason: 'medical_advice',
      requiresHuman: false,
      suggestedResponse:
        'Ürün kullanımı hakkında sorularınız varsa size yardımcı olabilirim. Sağlık sorunları için lütfen bir sağlık uzmanına danışın.',
    };
  }

  return {
    safe: true,
    requiresHuman: false,
  };
}

/**
 * Escalate to human (log for manual review)
 */
export async function escalateToHuman(
  userId: string,
  conversationId: string,
  reason: string,
  message: string
): Promise<void> {
  // TODO: Implement human escalation
  // - Create escalation record in database
  // - Notify merchant/admin
  // - Flag conversation for review

  console.log('🚨 Human escalation required:', {
    userId,
    conversationId,
    reason,
    message: message.substring(0, 100),
  });

  // For MVP, just log
  // In production, create escalation record and notify merchant
}

/**
 * Get safe response for blocked content
 */
export function getSafeResponse(reason: 'crisis_keyword' | 'medical_advice'): string {
  const responses = {
    crisis_keyword:
      "Anladım, bu ciddi bir durum gibi görünüyor. Lütfen acil durumlar için 112'yi arayın veya en yakın acil servise başvurun. Size daha iyi yardımcı olabilmemiz için lütfen müşteri hizmetlerimizle iletişime geçin.",
    medical_advice:
      'Üzgünüm, tıbbi tavsiye veremem. Sağlık sorunlarınız için lütfen bir sağlık uzmanına danışın. Ürün kullanımı hakkında sorularınız varsa, size yardımcı olabilirim.',
  };

  return responses[reason];
}
