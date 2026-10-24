/**
 * Internationalization helpers
 * Language detection and localized response templates
 */

export type SupportedLanguage = 'tr' | 'en' | 'hu' | 'de' | 'el';

export interface ReplyLanguageDecision {
  requestedLanguage: SupportedLanguage;
  responseLanguage: SupportedLanguage;
  supportedLanguages: SupportedLanguage[];
  usedFallback: boolean;
}

export function normalizeSupportedLanguage(lang?: string | null): SupportedLanguage {
  const value = String(lang || '').trim().toLowerCase();
  if (value.startsWith('tr')) return 'tr';
  if (value.startsWith('hu')) return 'hu';
  if (value.startsWith('de')) return 'de';
  if (value.startsWith('el')) return 'el';
  return 'en';
}

// Frequent words per language, matched as whole words. Short customer messages
// often have no language-specific letters ("Hamileyim, bu serumu kullanabilir
// miyim?", "Van benne illatanyag?"), and these are what identify them.
const LANGUAGE_WORDS: Record<Exclude<SupportedLanguage, 'el'>, string[]> = {
  tr: [
    'bu', 've', 'bir', 'ne', 'mi', 'mı', 'mu', 'mü', 'de', 'da', 'ile', 'için', 'icin', 'ama', 'çok', 'cok', 'daha',
    'nasıl', 'nasil', 'neden', 'nerede', 'zaman', 'kaç', 'kac', 'var', 'yok', 'olur', 'olabilir', 'evet', 'hayır', 'hayir',
    'tamam', 'merhaba', 'teşekkür', 'tesekkur', 'teşekkürler', 'tesekkurler', 'sağol', 'sagol', 'lütfen', 'lutfen', 'yardım', 'yardim',
    'ürün', 'urun', 'ürünü', 'urunu', 'sipariş', 'siparis', 'siparişim', 'siparisim', 'kargo', 'kargom', 'iade', 'gelir', 'geldi',
    'gün', 'gun', 'günde', 'gunde', 'sabah', 'akşam', 'aksam', 'gece', 'cilt', 'cildim', 'yüz', 'yuz', 'yüzüm', 'yuzum', 'krem', 'kremi',
    'serum', 'serumu', 'kullan', 'kullanım', 'kullanim', 'kullanabilir', 'kullanmalıyım', 'kullanmaliyim', 'sürebilir', 'surebilir',
    'hamile', 'hamileyim', 'bana', 'benim', 'sizin', 'misiniz', 'musunuz', 'miyim', 'mıyım', 'sence',
  ],
  hu: [
    'az', 'egy', 'és', 'van', 'nincs', 'benne', 'hogy', 'hogyan', 'mi', 'mit', 'mikor', 'meddig', 'miért', 'miert',
    'igen', 'nem', 'köszönöm', 'koszonom', 'kérem', 'kerem', 'szia', 'rendben', 'értem', 'ertem', 'termék', 'termek', 'krém', 'krem',
    'krémet', 'bőr', 'bőrre', 'borre', 'arc', 'arcra', 'használni', 'hasznalni', 'használjam', 'hasznaljam', 'használhatom',
    'szeretném', 'tudnám', 'kell', 'lehet', 'után', 'utan', 'reggel', 'este', 'illatanyag', 'rendelés', 'rendelésem', 'csomag',
    'visszaküldés', 'ezt', 'ez', 'milyen', 'melyik', 'mennyi', 'ideig', 'hányszor', 'hanyszor', 'naponta', 'köszi', 'koszi',
    'szabad', 'terhes', 'várandós', 'bőröm', 'borom', 'kérdés', 'kerdes', 'segítség', 'segitseg',
  ],
  en: [
    'the', 'is', 'it', 'an', 'and', 'or', 'i', 'you', 'my', 'me', 'can', 'do', 'does', 'how', 'what', 'when', 'where', 'why',
    'this', 'that', 'with', 'for', 'to', 'of', 'use', 'skin', 'will', 'should', 'please', 'thanks', 'thank', 'hi', 'hello',
    'order', 'product', 'cream', 'face', 'night', 'morning', 'safe', 'pregnant', 'are', 'have', 'any', 'about',
  ],
  de: [
    'und', 'oder', 'ist', 'das', 'der', 'die', 'ein', 'eine', 'ich', 'sie', 'wie', 'warum', 'wann', 'kann', 'bitte', 'danke',
    'hallo', 'produkt', 'anwendung', 'bestellung', 'hilfe', 'rückgabe', 'haut', 'creme', 'nicht', 'mit', 'für', 'fur',
  ],
};
const WORD_SETS = Object.fromEntries(
  Object.entries(LANGUAGE_WORDS).map(([lang, words]) => [lang, new Set(words)]),
) as Record<Exclude<SupportedLanguage, 'el'>, Set<string>>;

export interface LanguageDetection {
  language: SupportedLanguage;
  /**
   * false when the text gave no clear signal (very short, numbers only, or a
   * tie). Callers with context (earlier messages, the conversation's language)
   * should prefer it over this guess.
   */
  confident: boolean;
}

/**
 * Detects the language from letters, frequent words and Turkish suffixes.
 * Fast heuristic, no external call.
 *
 * The previous version matched keywords with an ASCII-only \b, so words
 * starting or ending with ü, ş, ö ... ("ürün", "köszönöm") never matched, and a
 * message without language-specific letters fell through to English.
 */
export function detectLanguageDetailed(text: string): LanguageDetection {
  // Plain lowercase: the Turkish locale would turn an English "I" into "ı".
  const lower = String(text || '').replace(/İ/g, 'i').toLowerCase();
  if (/[α-ωάέίόύήώϊϋΐΰ]/.test(lower)) return { language: 'el', confident: true };

  const score: Record<Exclude<SupportedLanguage, 'el'>, number> = { tr: 0, hu: 0, en: 0, de: 0 };
  // Letters: ş ğ ı are Turkish only; ő ű Hungarian only; ä ß German only.
  if (/[şğı]/.test(lower)) score.tr += 3;
  if (/[őű]/.test(lower)) score.hu += 3;
  if (/[äß]/.test(lower)) score.de += 3;
  if (/[áéíóú]/.test(lower)) score.hu += 1;
  // sz, gy, zs: Hungarian digraphs, rare in Turkish and English.
  if (/sz|gy|zs/.test(lower)) score.hu += 1.5;
  if (/[çöü]/.test(lower)) {
    score.tr += 1;
    score.hu += 0.5;
    score.de += 0.5;
  }
  // Turkish verb endings and question particles, also when typed without Turkish letters.
  if (/\p{L}(iyor|ıyor|uyor|üyor|yorum|abilir|ebilir|malıyım|meliyim|maliyim)(?!\p{L})/u.test(lower)) score.tr += 2;
  if (/(?<!\p{L})(mi|mı|mu|mü|miyim|mıyım|misiniz|musunuz)(?!\p{L})/u.test(lower)) score.tr += 1;

  for (const word of lower.match(/\p{L}+/gu) || []) {
    for (const lang of Object.keys(WORD_SETS) as Array<keyof typeof WORD_SETS>) {
      if (WORD_SETS[lang].has(word)) score[lang] += 1;
    }
  }

  const ranked = (Object.entries(score) as Array<[keyof typeof score, number]>).sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  if (best[1] === 0) return { language: 'en', confident: false };
  return { language: best[0], confident: best[1] >= 2 && best[1] - second[1] >= 1 };
}

export function detectLanguage(text: string): SupportedLanguage {
  return detectLanguageDetailed(text).language;
}

export function resolveMerchantReplyLanguage(
  requestedLanguage: string | undefined,
  enabledLanguages: string[] | undefined,
): ReplyLanguageDecision {
  const requested = normalizeSupportedLanguage(requestedLanguage);
  const supportedLanguages: SupportedLanguage[] = [
    ...new Set((enabledLanguages || []).map((lang) => normalizeSupportedLanguage(lang)).filter(Boolean)),
  ];
  const safeSupportedLanguages: SupportedLanguage[] = supportedLanguages.length > 0 ? supportedLanguages : ['en'];
  const responseLanguage = safeSupportedLanguages.includes(requested) ? requested : safeSupportedLanguages[0];

  return {
    requestedLanguage: requested,
    responseLanguage,
    supportedLanguages: safeSupportedLanguages,
    usedFallback: responseLanguage !== requested,
  };
}

function getLanguageName(lang: SupportedLanguage, locale: SupportedLanguage = 'en'): string {
  const labels: Record<SupportedLanguage, Record<SupportedLanguage, string>> = {
    en: {
      en: 'English',
      tr: 'Turkish',
      hu: 'Hungarian',
      de: 'German',
      el: 'Greek',
    },
    tr: {
      en: 'İngilizce',
      tr: 'Türkçe',
      hu: 'Macarca',
      de: 'Almanca',
      el: 'Yunanca',
    },
    hu: {
      en: 'angol',
      tr: 'török',
      hu: 'magyar',
      de: 'német',
      el: 'görög',
    },
    de: {
      en: 'Englisch',
      tr: 'Türkisch',
      hu: 'Ungarisch',
      de: 'Deutsch',
      el: 'Griechisch',
    },
    el: {
      en: 'Αγγλικά',
      tr: 'Τουρκικά',
      hu: 'Ουγγρικά',
      de: 'Γερμανικά',
      el: 'Ελληνικά',
    },
  };

  return labels[locale]?.[lang] || labels.en[lang];
}

export function buildUnsupportedLanguageNotice(
  responseLanguage: SupportedLanguage,
  supportedLanguages: SupportedLanguage[],
): string {
  const names = supportedLanguages.map((lang) => getLanguageName(lang, responseLanguage)).join(', ');

  if (responseLanguage === 'tr') {
    return `Şu anda ${names} dillerinde yardımcı olabiliyorum. Bu yüzden aşağıda ${getLanguageName(responseLanguage, responseLanguage)} devam ediyorum.`;
  }
  if (responseLanguage === 'hu') {
    return `Jelenleg ezekben a nyelvekben tudok segíteni: ${names}. Ezért lent ${getLanguageName(responseLanguage, responseLanguage)} folytatom.`;
  }
  if (responseLanguage === 'de') {
    return `Ich kann derzeit in diesen Sprachen helfen: ${names}. Deshalb antworte ich unten auf ${getLanguageName(responseLanguage, responseLanguage)} weiter.`;
  }
  if (responseLanguage === 'el') {
    return `Αυτή τη στιγμή μπορώ να βοηθήσω σε αυτές τις γλώσσες: ${names}. Γι’ αυτό συνεχίζω παρακάτω στα ${getLanguageName(responseLanguage, responseLanguage)}.`;
  }
  return `I can currently help in these languages: ${names}. So I’ll continue below in ${getLanguageName(responseLanguage, responseLanguage)}.`;
}

export function describeSupportedLanguagesForPrompt(languages: SupportedLanguage[]): string {
  return languages.map((lang) => getLanguageName(lang, 'en')).join(', ');
}

/**
 * Human handoff response — localized
 */
export function getLocalizedHandoffResponse(lang: SupportedLanguage): string {
  const responses: Record<SupportedLanguage, string> = {
    tr: 'Anladım, sizi ekibimize yönlendiriyorum. En kısa sürede bir temsilci sizinle iletişime geçecek. 🙏',
    en: 'Understood, I\'m connecting you with our team. A representative will reach out to you shortly. 🙏',
    hu: 'Megértettem, átirányítom Önt a csapatunkhoz. Egy képviselő hamarosan felveszi Önnel a kapcsolatot. 🙏',
    de: 'Verstanden, ich verbinde Sie mit unserem Team. Eine Ansprechperson meldet sich in Kürze bei Ihnen. 🙏',
    el: 'Κατάλαβα, σας συνδέω με την ομάδα μας. Ένας εκπρόσωπος θα επικοινωνήσει μαζί σας σύντομα. 🙏',
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
    de: 'Ich verstehe, dass das wichtig für Sie ist. Ich verbinde Sie mit einem Teammitglied, das persönlich helfen kann.',
    el: 'Καταλαβαίνω ότι αυτό είναι σημαντικό για εσάς. Να σας συνδέσω με ένα μέλος της ομάδας μας που μπορεί να βοηθήσει προσωπικά.',
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
    de: 'Ich verstehe, das wirkt wie eine ernste Situation. Bitte rufen Sie in Notfällen die 112 an oder suchen Sie die nächste Notaufnahme auf. Für weitere Unterstützung wenden Sie sich bitte an unseren Kundenservice.',
    el: 'Καταλαβαίνω ότι αυτό φαίνεται σοβαρό. Παρακαλώ καλέστε το 112 για επείγοντα περιστατικά ή επισκεφθείτε το πλησιέστερο τμήμα επειγόντων. Για περισσότερη βοήθεια, επικοινωνήστε με την υποστήριξη πελατών μας.',
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
    de: 'Es tut mir leid, ich kann keine medizinische Beratung geben. Bitte wenden Sie sich bei gesundheitlichen Fragen an medizinisches Fachpersonal. Bei Fragen zur Produktanwendung helfe ich Ihnen gern weiter.',
    el: 'Λυπάμαι, δεν μπορώ να δώσω ιατρικές συμβουλές. Για θέματα υγείας, συμβουλευτείτε έναν επαγγελματία υγείας. Αν έχετε ερωτήσεις για τη χρήση του προϊόντος, μπορώ να βοηθήσω.',
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
    de: 'Ich möchte gern helfen. Könnten Sie bitte etwas mehr Details teilen, damit ich Ihre Frage besser verstehe?',
    el: 'Θέλω να βοηθήσω. Μπορείτε να μοιραστείτε λίγες περισσότερες λεπτομέρειες ώστε να καταλάβω καλύτερα την ερώτησή σας;',
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
    de: {
      welcome: 'Hallo! Vielen Dank für Ihre Bestellung. Wie kann ich Ihnen helfen?',
      checkin_t3: 'Hallo! Wie nutzen Sie Ihr Produkt? Haben Sie Fragen dazu?',
      checkin_t14: 'Hallo! Sind Sie mit Ihrem Produkt zufrieden? Wir haben neue Produkte speziell für Sie.',
      upsell: 'Möchten Sie unsere besonders reduzierten Produkte entdecken?',
      welcome_with_instructions: 'Hallo! Vielen Dank für Ihre Bestellung. Hier sind die Anwendungshinweise für Ihre gekauften Produkte:\n\n',
      welcome_instructions_cta: '\n\nHaben Sie Fragen zur Anwendung?',
    },
    el: {
      welcome: 'Γεια σας! Ευχαριστούμε για την παραγγελία σας. Πώς μπορώ να βοηθήσω;',
      checkin_t3: 'Γεια σας! Πώς χρησιμοποιείτε το προϊόν σας; Έχετε κάποια ερώτηση;',
      checkin_t14: 'Γεια σας! Είστε ευχαριστημένοι με το προϊόν σας; Έχουμε νέα προϊόντα ειδικά για εσάς!',
      upsell: 'Θέλετε να δείτε τα ειδικά εκπτωτικά προϊόντα μας;',
      welcome_with_instructions: 'Γεια σας! Ευχαριστούμε για την παραγγελία σας. Ακολουθούν οι οδηγίες χρήσης για τα προϊόντα που αγοράσατε:\n\n',
      welcome_instructions_cta: '\n\nΈχετε κάποια ερώτηση σχετικά με τη χρήση;',
    },
  };
  return templates[lang] || templates.en;
}
