/**
 * Shared persistence logic for messaging setup.
 * Used by both the focused mini-wizard (/app/setup/messaging) and the full
 * settings page (/app/settings) so they keep persona_settings consistent.
 */

import {
  fetchMerchantSettings,
  updateMerchantSettings,
  updateMerchantMultiLangSettings,
} from "../platform.server";
import { getPlanSnapshotByDomain } from "../services/planService.server";

export type MessagingSetupInput = {
  botName?: string | null;
  tone?: "friendly" | "professional" | "casual" | "formal" | null;
  responseLength?: "short" | "medium" | "long" | null;
  emoji?: boolean | null;
  aiVisionEnabled?: boolean | null;
  notificationPhone?: string | null;
  welcomeTemplate?: string | null;
  messageSendMode?: "always" | "all_products_required" | null;
  enabledLangs?: string[] | null; // null → leave unchanged
};

export type MessagingSetupResult = {
  ok: boolean;
  message: string;
  backfillTriggered?: boolean;
  addedLangs?: string[];
  removedLangs?: string[];
};

const VALID_TONES = new Set(["friendly", "professional", "casual", "formal"] as const);
const VALID_LENGTHS = new Set(["short", "medium", "long"] as const);

/**
 * Persist the merchant's messaging/persona settings.
 * Mirrors the historical save-core behavior in app.settings.tsx so that
 * either entry point produces the same persona_settings shape.
 *
 * Caller passes the authenticated request; this helper handles plan-aware
 * coercions (e.g. AI Vision force-off on Starter) and the multi-lang side
 * effect.
 */
export async function persistMessagingSetup(
  request: Request,
  shop: string,
  input: MessagingSetupInput,
): Promise<MessagingSetupResult> {
  const plan = await getPlanSnapshotByDomain(shop);
  const currentSettings = await fetchMerchantSettings(request);
  const existingPersonaSettings = currentSettings.merchant.persona_settings || {};

  const nextPersonaSettings: Record<string, unknown> = {
    ...existingPersonaSettings,
    onboarding_settings_configured_at: new Date().toISOString(),
  };

  // Tone (optional update)
  if (input.tone !== undefined && input.tone !== null) {
    const tone = VALID_TONES.has(input.tone as typeof input.tone) ? input.tone : "friendly";
    nextPersonaSettings.tone = tone || "friendly";
  } else if (existingPersonaSettings.tone == null) {
    nextPersonaSettings.tone = "friendly";
  }

  // Emoji (default true if unset on existing record)
  if (input.emoji !== undefined && input.emoji !== null) {
    nextPersonaSettings.emoji = Boolean(input.emoji);
  } else if (existingPersonaSettings.emoji == null) {
    nextPersonaSettings.emoji = true;
  }

  // Response length
  if (input.responseLength !== undefined && input.responseLength !== null) {
    const rl = VALID_LENGTHS.has(input.responseLength as typeof input.responseLength)
      ? input.responseLength
      : "medium";
    nextPersonaSettings.response_length = rl || "medium";
  } else if (existingPersonaSettings.response_length == null) {
    nextPersonaSettings.response_length = "medium";
  }

  // AI Vision: forced off on Starter
  if (input.aiVisionEnabled !== undefined && input.aiVisionEnabled !== null) {
    nextPersonaSettings.ai_vision_enabled =
      plan.planType === "STARTER" ? false : Boolean(input.aiVisionEnabled);
  }

  // Bot name
  if (input.botName !== undefined && input.botName !== null) {
    const trimmed = input.botName.trim();
    if (trimmed) {
      nextPersonaSettings.bot_name = trimmed;
    } else {
      delete nextPersonaSettings.bot_name;
    }
  }

  // Welcome template
  if (input.welcomeTemplate !== undefined && input.welcomeTemplate !== null) {
    const trimmed = input.welcomeTemplate.trim();
    if (trimmed) {
      nextPersonaSettings.whatsapp_welcome_template = trimmed;
    } else {
      delete nextPersonaSettings.whatsapp_welcome_template;
    }
  }

  // Message send mode
  if (input.messageSendMode !== undefined && input.messageSendMode !== null) {
    nextPersonaSettings.message_send_mode =
      input.messageSendMode === "all_products_required" ? "all_products_required" : "always";
  }

  // Notification phone: pass-through (null clears, undefined leaves unchanged)
  const notificationPhonePayload =
    input.notificationPhone === undefined
      ? undefined
      : input.notificationPhone === null
        ? null
        : input.notificationPhone.trim() || null;

  const updatePromises: Array<Promise<unknown>> = [
    updateMerchantSettings(request, {
      ...(notificationPhonePayload === undefined ? {} : { notification_phone: notificationPhonePayload }),
      persona_settings: nextPersonaSettings,
    }),
  ];

  let multiLangPromise: Promise<{
    backfillTriggered?: boolean;
    addedLangs?: string[];
    removedLangs?: string[];
  } | undefined> | null = null;

  if (input.enabledLangs && input.enabledLangs.length > 0) {
    multiLangPromise = updateMerchantMultiLangSettings(request, {
      enabled_langs: input.enabledLangs,
    }) as Promise<{
      backfillTriggered?: boolean;
      addedLangs?: string[];
      removedLangs?: string[];
    } | undefined>;
    updatePromises.push(multiLangPromise);
  }

  await Promise.all(updatePromises);

  const multiLangResponse = multiLangPromise ? await multiLangPromise : undefined;
  const languageChanged = Boolean(multiLangResponse);
  const languageNote = languageChanged
    ? multiLangResponse?.backfillTriggered
      ? ` Customer reply languages changed, so product knowledge refresh has started for ${[
          ...(multiLangResponse.addedLangs || []).map((lang) => `+${lang}`),
          ...(multiLangResponse.removedLangs || []).map((lang) => `-${lang}`),
        ].join(", ")}.`
      : " Customer reply languages were updated."
    : "";

  const planNote =
    plan.planType === "STARTER"
      ? " AI Vision stayed off because it requires Growth, and shared Recete WhatsApp routing was kept because custom branded WhatsApp requires Pro."
      : plan.planType === "GROWTH"
        ? " Shared Recete WhatsApp routing was kept because custom branded WhatsApp requires Pro."
        : "";

  return {
    ok: true,
    message: `Settings saved.${languageNote}${planNote}`,
    backfillTriggered: multiLangResponse?.backfillTriggered,
    addedLangs: multiLangResponse?.addedLangs,
    removedLangs: multiLangResponse?.removedLangs,
  };
}
