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
  },
};

export interface WelcomeInstruction {
  product_name?: string | null;
  usage_instructions: string;
  recipe_summary?: string | null;
}

/**
 * The built-in welcome: the ordered products' usage notes, or a short thank
 * you when none of them has any.
 */
export function buildBuiltInWelcome(language: MessageLanguage, instructions: WelcomeInstruction[]): string {
  const tpl = SCHEDULED_MESSAGE_TEMPLATES[language] || SCHEDULED_MESSAGE_TEMPLATES.tr;
  if (instructions.length === 0) return tpl.welcome;
  const parts = instructions.map(
    (row) =>
      `**${row.product_name ?? tpl.product}**\n${row.usage_instructions}${row.recipe_summary ? `\n${tpl.summary}: ${row.recipe_summary}` : ''}`
  );
  return tpl.welcome_with_instructions + parts.join('\n\n') + tpl.welcome_instructions_cta;
}
