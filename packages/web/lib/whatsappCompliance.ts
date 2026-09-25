/**
 * Shared WhatsApp/GDPR copy, used by the public /whatsapp-gdpr page and the
 * in-app consent notice so the two never drift apart.
 *
 * The keyword list mirrors OPT_OUT_KEYWORDS in
 * packages/api/src/lib/customerOptOut.ts — update both together.
 */

export const OPT_OUT_KEYWORDS_DISPLAY =
  'STOP · UNSUBSCRIBE · DUR · ABONELİKTEN ÇIK · ABMELDEN · LEIRATKOZÁS · ΔΙΑΚΟΠΗ';

export const PRIVACY_NOTICE_SNIPPET = `WhatsApp messages after your purchase
If you agree to hear from us, we may message you on WhatsApp after your order is delivered — for example with tips on using your product, a check-in to see how it is going, or suggestions for your next order. You can reply to these messages with questions and get an answer straight away.

To do this, we share your name, phone number and order details with Recete Ltd (London, UK), which runs this messaging for us as our data processor. Messages are sent from our own WhatsApp number through WhatsApp (Meta), and replies are written with the help of an AI service (OpenAI, United States). We keep this information only as long as we need it for these messages and your support conversations.

You can stop these messages at any time by replying STOP, or by contacting us.`;

export const WHATSAPP_GDPR_PATH = '/whatsapp-gdpr';
