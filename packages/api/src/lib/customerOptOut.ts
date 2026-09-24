/**
 * Customer opt-out from WhatsApp messages.
 *
 * Asking to stop used to be answered ("you won't hear from us again") and then
 * ignored: nothing changed consent_status, so the day-3 and day-14 check-ins and
 * upsells already scheduled for that customer still went out. Under GDPR/PECR
 * and WhatsApp Business policy an opt-out has to take effect, not just be
 * acknowledged.
 */

import { getSupabaseServiceClient, logger } from '@recete/shared';

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>;

// Whole-message keywords only. Matching words inside a sentence would turn
// "stop the order" or "iptal etmek istiyorum" (cancel my order) into an
// unsubscribe; sentences like that are left to the AI intent classifier.
// One entry per supported reply language (en, tr, de, hu, el).
const OPT_OUT_KEYWORDS = new Set([
  'stop',
  'stop all',
  'stopall',
  'unsubscribe',
  'opt out',
  'optout',
  'dur',
  'durdur',
  'abonelikten çık',
  'abonelikten cik',
  'abmelden',
  'leiratkozás',
  'leiratkozas',
  'διακοπή',
  'διακοπη',
]);

function normalize(text: string, locale: string) {
  return text
    .trim()
    .toLocaleLowerCase(locale)
    .replace(/[.!?\s]+$/u, '')
    .replace(/\s+/gu, ' ');
}

export function isOptOutKeyword(text: string | null | undefined): boolean {
  if (!text) return false;
  // Both casings: Turkish lowercases "I" to a dotless "ı" ("UNSUBSCRIBE" ->
  // "unsubscrıbe"), everything else needs "İ"/"I" handled the Turkish way
  // ("ABONELİKTEN ÇIK" -> "abonelikten çık").
  return OPT_OUT_KEYWORDS.has(normalize(text, 'en')) || OPT_OUT_KEYWORDS.has(normalize(text, 'tr'));
}

/**
 * Mark the customer opted out and cancel every message still waiting to be
 * sent to them. Safe to call more than once.
 */
export async function recordCustomerOptOut(
  client: ServiceClient,
  input: { merchantId: string; userId: string; source: 'keyword' | 'ai_intent' }
): Promise<{ ok: boolean }> {
  const { error: consentError } = await client
    .from('users')
    .update({ consent_status: 'opt_out' })
    .eq('id', input.userId)
    .eq('merchant_id', input.merchantId);

  if (consentError) {
    logger.error({ consentError, ...input }, '[opt-out] Could not record customer opt-out');
    return { ok: false };
  }

  const { error: tasksError } = await client
    .from('scheduled_tasks')
    .update({ status: 'cancelled' })
    .eq('user_id', input.userId)
    .eq('status', 'pending');

  if (tasksError) {
    // Consent is already opt_out, and the scheduled-message worker re-checks
    // consent before sending, so a leftover task is skipped rather than sent.
    logger.warn({ tasksError, ...input }, '[opt-out] Could not cancel pending tasks');
  }

  logger.info(input, '[opt-out] Customer opted out of WhatsApp messages');
  return { ok: true };
}
