/**
 * Telling customers they are talking to an AI.
 *
 * The EU AI Act (Art. 50, from August 2026) requires that people are told they
 * are interacting with an AI system, at the latest at the first interaction.
 * Nothing in the WhatsApp messages said so. The first message the assistant
 * sends a customer now ends with a short note, in the message's language, which
 * also says how to reach a person: each note quotes a phrase the handoff check
 * recognises (HUMAN_HANDOFF_PHRASES in packages/api lib/guardrails.ts).
 *
 * "First" is per customer: no conversation of theirs has an assistant message
 * yet. Scheduled messages (packages/workers) and replies to the customer
 * (packages/api whatsappInboundProcessor) both check it before sending.
 */
import type { getSupabaseServiceClient } from './supabase.js';

export type AiDisclosureLanguage = 'tr' | 'en' | 'hu' | 'de' | 'el';

export const AI_DISCLOSURE: Record<AiDisclosureLanguage, string> = {
  tr: 'Not: Bu sohbette size bir yapay zekâ asistanı yanıt veriyor. Bir mağaza çalışanıyla görüşmek isterseniz "müşteri temsilcisi" yazmanız yeterli.',
  en: 'Note: you are chatting with an AI assistant. To talk to someone from the store, just write "customer service".',
  hu: 'Megjegyzés: egy mesterséges intelligencián alapuló asszisztenssel beszélget. Ha az üzlet munkatársával szeretne beszélni, írja be: „ügyfélszolgálat”.',
  de: 'Hinweis: Sie schreiben mit einem KI-Assistenten. Wenn Sie mit jemandem aus dem Shop sprechen möchten, schreiben Sie einfach „Kundenservice“.',
  el: 'Σημείωση: συνομιλείτε με έναν βοηθό τεχνητής νοημοσύνης. Για να μιλήσετε με κάποιον από το κατάστημα, γράψτε απλώς «εξυπηρέτηση πελατών».',
};

export function aiDisclosureFor(language?: string | null): string {
  const code = String(language || '').trim().toLowerCase().slice(0, 2) as AiDisclosureLanguage;
  return AI_DISCLOSURE[code] ?? AI_DISCLOSURE.en;
}

/** The message with the AI note after it. */
export function appendAiDisclosure(message: string, language?: string | null): string {
  return `${message.trimEnd()}\n\n${aiDisclosureFor(language)}`;
}

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>;

/**
 * Whether the assistant has already messaged this customer, in any of their
 * conversations. When it can't tell (query failed), it answers false: telling
 * a customer twice is better than not at all.
 */
export async function hasAssistantMessagedCustomer(client: ServiceClient, userId: string): Promise<boolean> {
  const { data, error } = await client.from('conversations').select('history').eq('user_id', userId);
  if (error || !data) return false;
  return data.some((row: { history?: unknown }) =>
    Array.isArray(row.history) && row.history.some((item: { role?: string }) => item?.role === 'assistant')
  );
}

/** The message to send: with the AI note when it is the assistant's first to this customer. */
export async function withFirstContactAiDisclosure(
  client: ServiceClient,
  input: { userId: string; message: string; language?: string | null }
): Promise<string> {
  if (await hasAssistantMessagedCustomer(client, input.userId)) return input.message;
  return appendAiDisclosure(input.message, input.language);
}
