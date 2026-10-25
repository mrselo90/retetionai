/**
 * The language of a store's scheduled messages (welcome, check-ins): the one
 * saved by the Shopify app's welcome message step, else the store's first
 * reply language, else Turkish.
 *
 * Nothing saved persona_settings.default_language before 2026-10-25, so every
 * store got the workers' Turkish templates whatever language it had chosen.
 */
export const MESSAGE_LANGUAGES = ['tr', 'en', 'hu', 'de', 'el'] as const;
export type MessageLanguage = (typeof MESSAGE_LANGUAGES)[number];

function isMessageLanguage(value: unknown): value is MessageLanguage {
  return typeof value === 'string' && (MESSAGE_LANGUAGES as readonly string[]).includes(value);
}

export function pickMessageLanguage(savedLanguage: unknown, enabledLangs: unknown): MessageLanguage {
  if (isMessageLanguage(savedLanguage)) return savedLanguage;
  const first = Array.isArray(enabledLangs) ? enabledLangs[0] : null;
  return isMessageLanguage(first) ? first : 'tr';
}
