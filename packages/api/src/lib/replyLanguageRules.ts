import type { SupportedLanguage } from './i18n.js';

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  tr: 'Turkish',
  en: 'English',
  hu: 'Hungarian',
  de: 'German',
  el: 'Greek',
};

// One form of address per reply, formal unless the merchant chose a casual
// tone. Hungarian answers used to switch between tegezés and magázás from one
// message to the next.
const ADDRESS: Record<Exclude<SupportedLanguage, 'en'>, { formal: string; casual: string }> = {
  tr: {
    formal: 'Address the customer as "siz" throughout (e.g. "kullanabilirsiniz"), never "sen".',
    casual: 'Address the customer as "sen" throughout (e.g. "kullanabilirsin"), consistently.',
  },
  hu: {
    formal:
      'Address the customer formally throughout (magázás: "használja", "Önnek"), never tegezés ("használd", "neked"); if you greet, use "Jó napot" or "Üdvözlöm" rather than "Szia".',
    casual: 'Address the customer with tegezés throughout ("használd", "neked"), consistently.',
  },
  de: {
    formal: 'Address the customer as "Sie" throughout, never "du".',
    casual: 'Address the customer as "du" throughout, consistently.',
  },
  el: {
    formal: 'Address the customer in the polite plural throughout ("εσείς", e.g. "χρησιμοποιήστε"), never "εσύ".',
    casual: 'Address the customer as "εσύ" throughout (e.g. "χρησιμοποίησε"), consistently.',
  },
};

/**
 * Prompt lines for the reply's language, form of address and wording, shared
 * by the grounded product answer and the conversation prompt.
 *
 * Product information is often in another language than the customer's (a
 * Turkish source description, facts extracted from it), and Hungarian answers
 * carried Turkish phrases over ("cilt tonu eşitsizliği"). The model also
 * repeated the prompt's own word for its sources ("bizonyíték", evidence).
 */
export function replyLanguageRules(language: string, tone?: string | null): string {
  const code = String(language || '').trim().toLowerCase().slice(0, 2);
  const lang: SupportedLanguage = code in LANGUAGE_NAMES ? (code as SupportedLanguage) : 'en';
  const name = LANGUAGE_NAMES[lang];
  const address = lang === 'en' ? null : ADDRESS[lang][tone === 'casual' ? 'casual' : 'formal'];
  return [
    `- Write the whole reply in ${name}.`,
    `- The product information may be written in another language. Translate everything you use from it into ${name}; keep only product and brand names as written. Never leave words or phrases from another language in the reply, not even in brackets.`,
    ...(address ? [`- ${address}`] : []),
    '- Speak as the store\'s assistant. Never mention "evidence", "context", "sources" or "the information provided", or how you found the information; when something is not covered, say plainly that you don\'t have that information.',
  ]
    .map((line) => `${line}\n`)
    .join('');
}

/**
 * Prompt lines for how replies end and how reactions are handled, shared by
 * the same two prompts.
 *
 * Almost every answer ended with a stock offer of more help ("szívesen
 * segítek", "başka sorunuz olursa"), which reads as boilerplate when it comes
 * after every message. And a customer reporting stinging was told the product
 * "generally doesn't cause irritation" (not in the product information), or
 * only "I don't have information".
 */
export function replyConductRules(): string {
  return [
    '- End when the answer is complete. Do not add a stock offer of more help ("let me know if you have any other questions", "szívesen segítek", "başka sorunuz olursa"); a short polite close is fine only when the customer is thanking you or saying goodbye.',
    '- If the customer reports a reaction (stinging, burning, redness, itching, rash): never say it is normal or that the product does not cause it, unless the product information says exactly that. Share the product\'s own warnings, and the safe step: if it is strong or does not settle quickly, stop using it and rinse with lukewarm water; if it persists or gets worse, see a doctor or pharmacist.',
  ]
    .map((line) => `${line}\n`)
    .join('');
}
