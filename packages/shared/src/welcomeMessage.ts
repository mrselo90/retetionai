/**
 * The scheduled messages' fixed texts (welcome, check-ins), and the built-in
 * welcome a store gets when it leaves its welcome template empty. The workers
 * send it; the Shopify app's welcome step previews the same text.
 */
import type { MessageLanguage } from './messageLanguage.js';

export const SCHEDULED_MESSAGE_TEMPLATES: Record<MessageLanguage, Record<string, string>> = {
  tr: {
    welcome: 'Merhaba! Siparişiniz için teşekkür ederiz. Size nasıl yardımcı olabilirim?',
    checkin_t3: 'Merhaba! Ürününüzü nasıl kullanıyorsunuz? Herhangi bir sorunuz var mı?',
    checkin_t14: 'Merhaba! Ürününüzden memnun musunuz? Size özel yeni ürünlerimiz var!',
    upsell: 'Size özel indirimli ürünlerimizi keşfetmek ister misiniz?',
    welcome_with_instructions:
      'Merhaba! Siparişiniz için teşekkür ederiz. Satın aldığınız ürünler için kullanım bilgileri:\n\n',
    welcome_instructions_cta: '\n\nUygulama konusunda sorunuz var mı?',
    product: 'Ürün',
    summary: 'Özet',
    welcome_multi: 'Merhaba! Siparişiniz için teşekkür ederiz. Ürünleriniz için kısa birer not:\n\n',
    welcome_multi_cta: '\n\nKullanımlarıyla ilgili her şeyi bana sorabilirsiniz, ayrıntıları hemen ileteyim.',
    more_products: '…ve {n} ürün daha',
  },
  en: {
    welcome: 'Hello! Thank you for your order. How can I help you?',
    checkin_t3: 'Hello! How are you using your product? Do you have any questions?',
    checkin_t14: 'Hello! Are you satisfied with your product? We have new products just for you!',
    upsell: 'Would you like to discover our special discounted products?',
    welcome_with_instructions:
      'Hello! Thank you for your order. Here are the usage instructions for your products:\n\n',
    welcome_instructions_cta: '\n\nDo you have any questions about usage?',
    product: 'Product',
    summary: 'Summary',
    welcome_multi: 'Hello! Thank you for your order. A short note on each of your products:\n\n',
    welcome_multi_cta: '\n\nYou can ask me anything about using them, and I\'ll send you the details.',
    more_products: '…and {n} more',
  },
  hu: {
    welcome: 'Üdvözöljük! Köszönjük a rendelését. Miben segíthetek?',
    checkin_t3: 'Üdvözöljük! Hogyan használja a terméket? Van bármilyen kérdése?',
    checkin_t14: 'Üdvözöljük! Elégedett a termékkel? Különleges új termékeink vannak Önnek!',
    upsell: 'Szeretné felfedezni különleges kedvezményes termékeinket?',
    welcome_with_instructions:
      'Üdvözöljük! Köszönjük a rendelését. Íme a megvásárolt termékek használati útmutatója:\n\n',
    welcome_instructions_cta: '\n\nVan kérdése a használattal kapcsolatban?',
    product: 'Termék',
    summary: 'Összefoglaló',
    welcome_multi: 'Üdvözöljük! Köszönjük a rendelését. Röviden a termékeiről:\n\n',
    welcome_multi_cta: '\n\nBármit kérdezhet a használatukról, és elküldöm a részleteket.',
    more_products: '…és még {n} termék',
  },
  de: {
    welcome: 'Hallo! Vielen Dank für Ihre Bestellung. Wie kann ich Ihnen helfen?',
    checkin_t3: 'Hallo! Wie kommen Sie mit Ihrem Produkt zurecht? Haben Sie Fragen?',
    checkin_t14: 'Hallo! Sind Sie mit Ihrem Produkt zufrieden? Wir haben neue Produkte für Sie!',
    upsell: 'Möchten Sie unsere Sonderangebote entdecken?',
    welcome_with_instructions:
      'Hallo! Vielen Dank für Ihre Bestellung. Hier sind die Anwendungshinweise für Ihre Produkte:\n\n',
    welcome_instructions_cta: '\n\nHaben Sie Fragen zur Anwendung?',
    product: 'Produkt',
    summary: 'Zusammenfassung',
    welcome_multi: 'Hallo! Vielen Dank für Ihre Bestellung. Ein kurzer Hinweis zu jedem Ihrer Produkte:\n\n',
    welcome_multi_cta: '\n\nSie können mich alles zur Anwendung fragen, ich schicke Ihnen gern die Details.',
    more_products: '…und {n} weitere',
  },
  el: {
    welcome: 'Γεια σας! Ευχαριστούμε για την παραγγελία σας. Πώς μπορώ να σας βοηθήσω;',
    checkin_t3: 'Γεια σας! Πώς σας φαίνεται το προϊόν; Έχετε κάποια ερώτηση;',
    checkin_t14: 'Γεια σας! Είστε ικανοποιημένοι με το προϊόν σας; Έχουμε νέα προϊόντα ειδικά για εσάς!',
    upsell: 'Θα θέλατε να ανακαλύψετε τις ειδικές προσφορές μας;',
    welcome_with_instructions:
      'Γεια σας! Ευχαριστούμε για την παραγγελία σας. Ακολουθούν οι οδηγίες χρήσης για τα προϊόντα σας:\n\n',
    welcome_instructions_cta: '\n\nΈχετε κάποια ερώτηση για τη χρήση;',
    product: 'Προϊόν',
    summary: 'Σύνοψη',
    welcome_multi: 'Γεια σας! Ευχαριστούμε για την παραγγελία σας. Μια σύντομη σημείωση για κάθε προϊόν:\n\n',
    welcome_multi_cta: '\n\nΜπορείτε να με ρωτήσετε ό,τι θέλετε για τη χρήση τους και θα σας στείλω λεπτομέρειες.',
    more_products: '…και {n} ακόμη',
  },
};

export interface WelcomeInstruction {
  product_name?: string | null;
  usage_instructions: string;
  recipe_summary?: string | null;
}

const MULTI_PRODUCT_LIMIT = 5;
const NOTE_MAX_CHARS = 140;

/** The first sentence of a usage note, cut at a word near NOTE_MAX_CHARS. */
export function shortUsageNote(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const first = flat.split(/(?<=[.!?])\s/u)[0] || flat;
  if (first.length <= NOTE_MAX_CHARS) return first;
  const cut = first.slice(0, NOTE_MAX_CHARS);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), NOTE_MAX_CHARS / 2)).replace(/[\s,;:]+$/u, '')}…`;
}

/**
 * A product's line in a multi-product welcome: its key summary, which the AI
 * draft writes to tell it apart from similar products, else the first
 * sentence of its usage notes (drafts of one kind of product tend to open alike).
 */
function productLine(row: WelcomeInstruction): string {
  return shortUsageNote(row.recipe_summary?.trim() || row.usage_instructions);
}

/**
 * The built-in welcome. One product: its usage notes. Several: one short line
 * each (productLine) and an invitation to ask, since the
 * full notes of every item made a long first WhatsApp message; the assistant
 * answers the questions from the same notes. No notes at all: a short thank you.
 */
export function buildBuiltInWelcome(language: MessageLanguage, instructions: WelcomeInstruction[]): string {
  const tpl = SCHEDULED_MESSAGE_TEMPLATES[language] || SCHEDULED_MESSAGE_TEMPLATES.tr;
  if (instructions.length === 0) return tpl.welcome;
  if (instructions.length === 1) {
    const [row] = instructions;
    return (
      tpl.welcome_with_instructions +
      `**${row.product_name ?? tpl.product}**\n${row.usage_instructions}${row.recipe_summary ? `\n${tpl.summary}: ${row.recipe_summary}` : ''}` +
      tpl.welcome_instructions_cta
    );
  }
  const lines = instructions
    .slice(0, MULTI_PRODUCT_LIMIT)
    .map((row) => `• **${row.product_name ?? tpl.product}**: ${productLine(row)}`);
  const hidden = instructions.length - MULTI_PRODUCT_LIMIT;
  if (hidden > 0) lines.push(tpl.more_products.replace('{n}', String(hidden)));
  return tpl.welcome_multi + lines.join('\n') + tpl.welcome_multi_cta;
}
