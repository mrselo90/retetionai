/**
 * Internationalization helpers
 * Language detection and localized response templates
 */

export type SupportedLanguage = 'tr' | 'en' | 'hu';

/**
 * Detect language from text using character patterns and common words.
 * Fast heuristic — no external API call.
 */
export function detectLanguage(text: string): SupportedLanguage {
  const lower = text.toLowerCase();

  // Hungarian indicators (unique characters and common words)
  const huPatterns = [
    /[őűŐŰ]/, // Hungarian-specific characters
    /\b(igen|nem|köszönöm|szia|kérem|rendben|értem|visszaküldés|termék|hogyan|miért|szeretném|tudnám)\b/,
  ];
  for (const pattern of huPatterns) {
    if (pattern.test(lower)) return 'hu';
  }

  // Turkish indicators (unique characters and common words)
  const trPatterns = [
    /[şŞğĞıİçÇöÖüÜ]/, // Turkish-specific characters
    /\b(merhaba|teşekkür|evet|hayır|nasıl|neden|ürün|kullanım|sipariş|iade|lütfen|yardım)\b/,
  ];
  for (const pattern of trPatterns) {
    if (pattern.test(lower)) return 'tr';
  }

  // Default to English
  return 'en';
}

/**
 * Human handoff response — localized
 */
export function getLocalizedHandoffResponse(lang: SupportedLanguage): string {
  const responses: Record<SupportedLanguage, string> = {
    tr: 'Anladım, sizi ekibimize yönlendiriyorum. En kısa sürede bir temsilci sizinle iletişime geçecek. 🙏',
    en: 'Understood, I\'m connecting you with our team. A representative will reach out to you shortly. 🙏',
    hu: 'Megértettem, átirányítom Önt a csapatunkhoz. Egy képviselő hamarosan felveszi Önnel a kapcsolatot. 🙏',
  };
  return responses[lang];
}

/**
 * Return intent escalation response — localized
 */
export function getLocalizedEscalationResponse(lang: SupportedLanguage): string {
  const responses: Record<SupportedLanguage, string> = {
    tr: 'Anlıyorum, bu sizin için önemli. Sizi kişisel olarak yardımcı olabilecek bir ekip arkadaşımıza bağlayayım.',
    en: 'I understand this is important to you. Let me connect you with a team member who can personally assist you.',
    hu: 'Megértem, hogy ez fontos Önnek. Hadd kapcsoljam össze egy csapattaggal, aki személyesen tud segíteni.',
  };
  return responses[lang];
}

/**
 * Crisis guardrail response — localized
 */
export function getLocalizedCrisisResponse(lang: SupportedLanguage): string {
  const responses: Record<SupportedLanguage, string> = {
    tr: "Anladım, bu ciddi bir durum gibi görünüyor. Lütfen acil durumlar için 112'yi arayın veya en yakın acil servise başvurun. Size daha iyi yardımcı olabilmemiz için lütfen müşteri hizmetlerimizle iletişime geçin.",
    en: 'I understand this seems like a serious situation. Please call emergency services (112) or visit your nearest emergency room. For further assistance, please contact our customer support team.',
    hu: 'Megértem, ez komoly helyzetnek tűnik. Kérjük, hívja a 112-t sürgős esetben, vagy keresse fel a legközelebbi sürgősségi osztályt. További segítségért kérjük, forduljon ügyfélszolgálatunkhoz.',
  };
  return responses[lang];
}

/**
 * Medical advice guardrail response — localized
 */
export function getLocalizedMedicalResponse(lang: SupportedLanguage): string {
  const responses: Record<SupportedLanguage, string> = {
    tr: 'Üzgünüm, tıbbi tavsiye veremem. Sağlık sorunlarınız için lütfen bir sağlık uzmanına danışın. Ürün kullanımı hakkında sorularınız varsa, size yardımcı olabilirim.',
    en: 'I\'m sorry, I cannot provide medical advice. Please consult a healthcare professional for health concerns. If you have questions about product usage, I\'m happy to help.',
    hu: 'Sajnálom, nem adhatok orvosi tanácsot. Egészségügyi problémák esetén kérjük, forduljon orvoshoz. Ha a termék használatával kapcsolatos kérdése van, szívesen segítek.',
  };
  return responses[lang];
}

/**
 * Generic clarification response (localized)
 * Used when AI output is blocked and we want to safely continue the conversation.
 */
export function getLocalizedClarificationResponse(lang: SupportedLanguage): string {
  const responses: Record<SupportedLanguage, string> = {
    tr: 'Size yardımcı olmak isterim. Sorunuzu daha net anlayabilmem için lütfen biraz daha detay paylaşır mısınız?',
    en: 'I want to help. Could you share a bit more detail so I can better understand your question?',
    hu: 'Szeretnék segíteni. Kérem, írjon egy kicsit több részletet, hogy jobban megértsem a kérdését.',
  };
  return responses[lang];
}

/**
 * Worker message templates — localized
 */
export function getWorkerTemplates(lang: SupportedLanguage): Record<string, string> {
  const templates: Record<SupportedLanguage, Record<string, string>> = {
    tr: {
      welcome: 'Merhaba! Siparişiniz için teşekkür ederiz. Size nasıl yardımcı olabilirim?',
      checkin_t3: 'Merhaba! Ürününüzü nasıl kullanıyorsunuz? Herhangi bir sorunuz var mı?',
      checkin_t14: 'Merhaba! Ürününüzden memnun musunuz? Size özel yeni ürünlerimiz var!',
      upsell: 'Size özel indirimli ürünlerimizi keşfetmek ister misiniz?',
      welcome_with_instructions: 'Merhaba! Siparişiniz için teşekkür ederiz. Satın aldığınız ürünler için kullanım bilgileri:\n\n',
      welcome_instructions_cta: '\n\nUygulama konusunda sorunuz var mı?',
    },
    en: {
      welcome: 'Hello! Thank you for your order. How can I help you?',
      checkin_t3: 'Hello! How are you using your product? Do you have any questions?',
      checkin_t14: 'Hello! Are you satisfied with your product? We have new products just for you!',
      upsell: 'Would you like to discover our special discounted products?',
      welcome_with_instructions: 'Hello! Thank you for your order. Here are the usage instructions for your products:\n\n',
      welcome_instructions_cta: '\n\nDo you have any questions about usage?',
    },
    hu: {
      welcome: 'Üdvözöljük! Köszönjük a rendelését. Miben segíthetek?',
      checkin_t3: 'Üdvözöljük! Hogyan használja a terméket? Van bármilyen kérdése?',
      checkin_t14: 'Üdvözöljük! Elégedett a termékkel? Különleges új termékeink vannak Önnek!',
      upsell: 'Szeretné felfedezni különleges kedvezményes termékeinket?',
      welcome_with_instructions: 'Üdvözöljük! Köszönjük a rendelését. Íme a megvásárolt termékek használati útmutatója:\n\n',
      welcome_instructions_cta: '\n\nVan kérdése a használattal kapcsolatban?',
    },
  };
  return templates[lang] || templates.en;
}
