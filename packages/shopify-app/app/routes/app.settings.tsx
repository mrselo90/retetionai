import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AlertCircleIcon, LockIcon, SettingsIcon } from "@shopify/polaris-icons";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Checkbox,
  ContextualSaveBar,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Spinner,
  Select,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { getSetupProgress } from "../lib/setupProgress";
import { PlanGate } from "../components/PlanGate";
import {
  cancelMerchantAddon,
  deleteMerchantDataFromAdminPanel,
  fetchMerchantAddons,
  fetchMerchantGuardrails,
  fetchMerchantMultiLangSettings,
  fetchMerchantOverviewFromRequest,
  fetchMerchantSettings,
  subscribeMerchantAddon,
  updateMerchantGuardrails,
  updateMerchantMultiLangSettings,
  updateMerchantSettings,
  type MerchantAddon,
  type MerchantGuardrail,
} from "../platform.server";
import { SectionCard, StatusBadge } from "../components/shell-ui";
import { getPlanSnapshotByDomain } from "../services/planService.server";
import { GROWTH_MONTHLY_PLAN } from "../services/planDefinitions";

function getStoreHandle(shop: string) {
  return shop.replace(/\.myshopify\.com$/i, "");
}

function getManagedPricingUrl(shop: string) {
  const storeHandle = getStoreHandle(shop);
  const appHandle = process.env.SHOPIFY_MANAGED_PRICING_APP_HANDLE?.trim() || "blackeagle";
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}

type ActionResult = {
  ok: boolean;
  intent?: string;
  message?: string;
  error?: string;
  confirmationUrl?: string;
};

const MERCHANT_RESET_CONFIRM_PHRASE = "DELETE ALL MERCHANT DATA";

type GuardrailDraft = {
  name: string;
  apply_to: "user_message" | "ai_response" | "both";
  match_type: "keywords" | "phrase";
  value: string;
  action: "block" | "escalate";
  suggested_response: string;
};

type CoreSettingsFormState = {
  bot_name: string;
  tone: "friendly" | "professional" | "casual" | "formal";
  response_length: "short" | "medium" | "long";
  notification_phone: string;
  whatsapp_welcome_template: string;
  enabled_langs: string;
  emoji: boolean;
  ai_vision_enabled: boolean;
};

const SERVICE_LANGUAGE_OPTIONS = [
  { label: "English", value: "en" },
  { label: "Turkish", value: "tr" },
  { label: "Hungarian", value: "hu" },
  { label: "German", value: "de" },
  { label: "Greek", value: "el" },
] as const;

function parseLanguageList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function serializeLanguageList(values: string[]) {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean))).join(", ");
}

const WELCOME_TEMPLATE_TOKENS = [
  {
    label: "First name",
    token: "{{customer_first_name}}",
    help: "Adds the buyer's first name.",
  },
  {
    label: "Order number",
    token: "{{order_number}}",
    help: "Adds the order number from Shopify.",
  },
  {
    label: "Product names",
    token: "{{product_names}}",
    help: "Adds product names in a natural sentence.",
  },
  {
    label: "Product count",
    token: "{{product_count}}",
    help: "Adds how many products were in the order.",
  },
  {
    label: "Bot name",
    token: "{{bot_name}}",
    help: "Adds the bot name set above.",
  },
] as const;

function parseGuardrailDrafts(
  raw: string,
  fallback: MerchantGuardrail[],
): MerchantGuardrail[] {
  if (!raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw) as MerchantGuardrail[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeCoreFormState(
  state: CoreSettingsFormState,
  planType: "STARTER" | "GROWTH" | "PRO",
): CoreSettingsFormState {
  const enabledLangs = parseLanguageList(state.enabled_langs);

  return {
    ...state,
    bot_name: state.bot_name.trim(),
    notification_phone: state.notification_phone.trim(),
    whatsapp_welcome_template: state.whatsapp_welcome_template.trim(),
    enabled_langs: serializeLanguageList(enabledLangs.length > 0 ? enabledLangs : ["en"]),
    ai_vision_enabled: planType === "STARTER" ? false : state.ai_vision_enabled,
  };
}

function appendWelcomeTemplateToken(template: string, token: string) {
  if (!template.trim()) return token;
  const needsSpacer = /[\s\n]$/.test(template);
  return `${template}${needsSpacer ? "" : " "}${token}`;
}

function buildWelcomeTemplatePreview(template: string, botName: string) {
  const baseTemplate =
    template.trim() ||
    'Tekrar selamlar {{customer_first_name}}, "{{order_number}}" nolu siparişinize ait {{product_names}} elinize ulaşmış olmalı. Nasıl kullanacağınızı biliyor musunuz? Destek olmamızı ister misiniz?';

  return baseTemplate
    .replace(/\{\{\s*customer_first_name\s*\}\}/gi, "Ayse")
    .replace(/\{\{\s*order_number\s*\}\}/gi, "1212")
    .replace(/\{\{\s*product_names\s*\}\}/gi, "A serumu ve B kremi")
    .replace(/\{\{\s*product_count\s*\}\}/gi, "2")
    .replace(/\{\{\s*bot_name\s*\}\}/gi, botName.trim() || "Recete");
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateEmbeddedAdmin(request);
  const [overview, merchantSettings, multiLang, guardrails, addons, plan] = await Promise.all([
    fetchMerchantOverviewFromRequest(request),
    fetchMerchantSettings(request),
    fetchMerchantMultiLangSettings(request).catch(() => ({
      settings: {
        shop_id: "",
        default_source_lang: "en",
        enabled_langs: ["en"],
        multi_lang_rag_enabled: true,
      },
    })),
    fetchMerchantGuardrails(request).catch(() => ({
      system_guardrails: [],
      custom_guardrails: [],
    })),
    fetchMerchantAddons(request).catch(() => ({ addons: [] as MerchantAddon[] })),
    getPlanSnapshotByDomain(session.shop),
  ]);

  return {
    overview,
    merchant: merchantSettings.merchant,
    managedPricingUrl: getManagedPricingUrl(session.shop),
    multiLang: multiLang.settings,
    guardrails,
    addons: addons.addons || [],
    plan,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateEmbeddedAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "").trim();

  try {
    if (intent === "save-core") {
      const plan = await getPlanSnapshotByDomain(session.shop);
      const currentSettings = await fetchMerchantSettings(request);
      const existingPersonaSettings = currentSettings.merchant.persona_settings || {};
      const enabledLangs = parseLanguageList(String(formData.get("enabled_langs") || "")).filter(Boolean);
      const botName = String(formData.get("bot_name") || "").trim();
      const welcomeTemplate = String(formData.get("whatsapp_welcome_template") || "").trim();
      const nextPersonaSettings: Record<string, unknown> = {
        ...existingPersonaSettings,
        tone:
          (String(formData.get("tone") || "").trim() as
            | "friendly"
            | "professional"
            | "casual"
            | "formal") || "friendly",
        emoji: formData.get("emoji") === "on",
        response_length:
          (String(formData.get("response_length") || "").trim() as
            | "short"
            | "medium"
            | "long") || "medium",
        ai_vision_enabled:
          plan.planType === "STARTER"
            ? false
            : formData.get("ai_vision_enabled") === "on",
        onboarding_settings_configured_at: new Date().toISOString(),
      };

      if (botName) {
        nextPersonaSettings.bot_name = botName;
      } else {
        delete nextPersonaSettings.bot_name;
      }

      if (welcomeTemplate) {
        nextPersonaSettings.whatsapp_welcome_template = welcomeTemplate;
      } else {
        delete nextPersonaSettings.whatsapp_welcome_template;
      }

      const [, multiLangResponse] = await Promise.all([
        updateMerchantSettings(request, {
          notification_phone: String(formData.get("notification_phone") || "").trim() || null,
          persona_settings: nextPersonaSettings,
        }),
        updateMerchantMultiLangSettings(request, {
          enabled_langs: enabledLangs.length > 0 ? enabledLangs : ["en"],
        }),
      ]);

      const languageUpdateMessage = multiLangResponse?.backfillTriggered
        ? ` Customer reply languages changed, so product knowledge refresh has started for ${[
            ...(multiLangResponse.addedLangs || []).map((lang) => `+${lang}`),
            ...(multiLangResponse.removedLangs || []).map((lang) => `-${lang}`),
          ].join(", ")}.`
        : " Customer reply languages were updated.";

      return {
        ok: true,
        intent,
        message:
          plan.planType === "STARTER"
            ? `Settings saved.${languageUpdateMessage} AI Vision stayed off because it requires Growth, and shared Recete WhatsApp routing was kept because custom branded WhatsApp requires Pro.`
            : plan.planType === "PRO"
              ? `Settings saved.${languageUpdateMessage}`
              : `Settings saved.${languageUpdateMessage} Shared Recete WhatsApp routing was kept because custom branded WhatsApp requires Pro.`,
      } satisfies ActionResult;
    }

    if (intent === "save-guardrails") {
      const existing = parseGuardrailDrafts(
        String(formData.get("guardrails_json") || ""),
        [],
      );
      const name = String(formData.get("guardrail_name") || "").trim();
      const value = String(formData.get("guardrail_value") || "").trim();

      if (!name || !value) {
        return {
          ok: false,
          intent,
          error: "Guardrail name and matching value are required.",
        } satisfies ActionResult;
      }

      const newGuardrail: MerchantGuardrail = {
        id: `custom-${Date.now()}`,
        name,
        apply_to: (String(formData.get("guardrail_apply_to") || "both") as GuardrailDraft["apply_to"]),
        match_type: (String(formData.get("guardrail_match_type") || "keywords") as GuardrailDraft["match_type"]),
        value:
          String(formData.get("guardrail_match_type") || "keywords") === "phrase"
            ? value
            : value.split(",").map((item) => item.trim()).filter(Boolean),
        action: (String(formData.get("guardrail_action") || "block") as GuardrailDraft["action"]),
        suggested_response: String(formData.get("guardrail_suggested_response") || "").trim() || undefined,
      };

      await updateMerchantGuardrails(request, [...existing, newGuardrail]);
      return { ok: true, intent, message: "Custom guardrail added." } satisfies ActionResult;
    }

    if (intent === "toggle-addon") {
      const addonKey = String(formData.get("addon_key") || "").trim();
      const addonStatus = String(formData.get("addon_status") || "").trim();
      if (!addonKey) {
        return { ok: false, intent, error: "Addon key is required." } satisfies ActionResult;
      }

      if (addonStatus === "active") {
        await cancelMerchantAddon(request, addonKey);
        return { ok: true, intent, message: "Add-on cancelled." } satisfies ActionResult;
      }

      const response = (await subscribeMerchantAddon(request, addonKey)) as {
        confirmationUrl?: string;
      };
      return {
        ok: true,
        intent,
        message: "Approval link created.",
        confirmationUrl: response.confirmationUrl,
      } satisfies ActionResult;
    }

    if (intent === "wipe-merchant-data") {
      const confirmationText = String(formData.get("wipe_confirmation") || "").trim();
      if (confirmationText !== MERCHANT_RESET_CONFIRM_PHRASE) {
        return {
          ok: false,
          intent,
          error: `Type exactly "${MERCHANT_RESET_CONFIRM_PHRASE}" to confirm.`,
        } satisfies ActionResult;
      }

      const result = await deleteMerchantDataFromAdminPanel(session.shop);
      return {
        ok: true,
        intent,
        message:
          result?.message ||
          "Merchant operational data has been deleted. Merchant identity is preserved. This action is irreversible.",
      } satisfies ActionResult;
    }

    return { ok: false, intent, error: "Unknown settings action." } satisfies ActionResult;
  } catch (error) {
    let errorMessage = "Settings action failed.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error instanceof Response) {
      try {
        const body = await error.clone().json() as { error?: string; message?: string };
        errorMessage = body?.error || body?.message || `Request failed (${error.status})`;
      } catch {
        errorMessage = `Request failed (${error.status})`;
      }
    }
    return {
      ok: false,
      intent,
      error: errorMessage,
    } satisfies ActionResult;
  }
};

export default function SettingsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);
  const persona = data.merchant.persona_settings || {};
  const busy = navigation.state !== "idle";

  const [formState, setFormState] = useState<CoreSettingsFormState>({
    bot_name: persona.bot_name || "",
    tone: persona.tone || "friendly",
    response_length: persona.response_length || "medium",
    notification_phone: data.merchant.notification_phone || "",
    whatsapp_welcome_template: persona.whatsapp_welcome_template || "",
    enabled_langs: serializeLanguageList(data.multiLang.enabled_langs || ["en"]),
    emoji: persona.emoji !== false,
    ai_vision_enabled: Boolean(persona.ai_vision_enabled),
  });
  const [guardrailDraft, setGuardrailDraft] = useState<GuardrailDraft>({
    name: "",
    apply_to: "both",
    match_type: "keywords",
    value: "",
    action: "block",
    suggested_response: "",
  });
  const [wipeConfirmation, setWipeConfirmation] = useState("");
  const [lastCoreSettingsSavedAt, setLastCoreSettingsSavedAt] = useState<string | null>(null);

  const loaderState = useMemo(
    () =>
      normalizeCoreFormState(
        {
          bot_name: persona.bot_name || "",
          tone: persona.tone || "friendly",
          response_length: persona.response_length || "medium",
          notification_phone: data.merchant.notification_phone || "",
          whatsapp_welcome_template: persona.whatsapp_welcome_template || "",
          enabled_langs: serializeLanguageList(data.multiLang.enabled_langs || ["en"]),
          emoji: persona.emoji !== false,
          ai_vision_enabled: Boolean(persona.ai_vision_enabled),
        },
        data.plan.planType,
      ),
    [data.merchant.notification_phone, data.multiLang.enabled_langs, data.plan.planType, persona.ai_vision_enabled, persona.bot_name, persona.emoji, persona.response_length, persona.tone, persona.whatsapp_welcome_template],
  );
  const loaderStateJson = useMemo(() => JSON.stringify(loaderState), [loaderState]);
  const [savedCoreStateJson, setSavedCoreStateJson] = useState(loaderStateJson);
  const dirty = savedCoreStateJson !== JSON.stringify(formState);
  const activeAddonCount = data.addons.filter((addon) => addon.status === "active").length;
  const selectedServiceLanguages = parseLanguageList(formState.enabled_langs);
  const enabledLanguageCount = selectedServiceLanguages.length;
  const onStarter = data.plan.planType === "STARTER";
  const aiVisionEnabled = !onStarter && formState.ai_vision_enabled;
  const guardrailNameMissing = !guardrailDraft.name.trim();
  const guardrailValueMissing = !guardrailDraft.value.trim();
  const guardrailDraftIncomplete = guardrailNameMissing || guardrailValueMissing;
  const setupProgress = getSetupProgress(data.overview);
  const setupBlocker = !setupProgress.hasBilling
    ? {
        title: "Choose a plan before launch",
        body: "You can finish settings now, but the shop still needs an active Shopify plan before launch.",
        tone: "warning" as const,
      }
    : !setupProgress.hasProducts
      ? {
          title: "Products still need setup",
          body: "These settings work best after products are prepared in the Products page.",
          tone: "info" as const,
        }
      : null;

  const saveCoreSettings = () => {
    if (formRef.current) submit(formRef.current);
  };

  const discardCoreSettings = () => {
    setFormState(JSON.parse(savedCoreStateJson));
  };

  const showCoreSuccess = actionData?.ok && actionData.intent === "save-core" && actionData.message;
  const showCoreError = !actionData?.ok && actionData?.intent === "save-core" && actionData.error;
  const showGuardrailSuccess = actionData?.ok && actionData.intent === "save-guardrails" && actionData.message;
  const showGuardrailError = !actionData?.ok && actionData?.intent === "save-guardrails" && actionData.error;
  const showAddonSuccess = actionData?.ok && actionData.intent === "toggle-addon" && actionData.message;
  const showAddonError = !actionData?.ok && actionData?.intent === "toggle-addon" && actionData.error;
  const showWipeSuccess = actionData?.ok && actionData.intent === "wipe-merchant-data" && actionData.message;
  const showWipeError = !actionData?.ok && actionData?.intent === "wipe-merchant-data" && actionData.error;
  const welcomeTemplatePreview = useMemo(
    () => buildWelcomeTemplatePreview(formState.whatsapp_welcome_template, formState.bot_name),
    [formState.bot_name, formState.whatsapp_welcome_template],
  );

  const toggleServiceLanguage = (lang: string, checked: boolean) => {
    const next = checked
      ? [...selectedServiceLanguages, lang]
      : selectedServiceLanguages.filter((value) => value !== lang);
    setFormState((current) => ({
      ...current,
      enabled_langs: serializeLanguageList(next),
    }));
  };

  useEffect(() => {
    if (showCoreSuccess) {
      setLastCoreSettingsSavedAt(new Date().toISOString());
      setFormState((current) => {
        const normalized = normalizeCoreFormState(current, data.plan.planType);
        setSavedCoreStateJson(JSON.stringify(normalized));
        return normalized;
      });
    }
  }, [data.plan.planType, showCoreSuccess]);

  useEffect(() => {
    if (!dirty && savedCoreStateJson !== loaderStateJson) {
      setSavedCoreStateJson(loaderStateJson);
      setFormState(loaderState);
    }
  }, [dirty, loaderState, loaderStateJson, savedCoreStateJson]);

  if (navigation.state === "loading") {
    return (
      <SkeletonPage title="Settings" primaryAction>
        <Layout>
          <Layout.Section>
            <Box padding="500" borderWidth="025" borderColor="border" borderRadius="200">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={4} />
            </Box>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page
      fullWidth
      title="Settings"
      subtitle="Adjust bot behavior, welcome messaging, languages, and safety rules."
      primaryAction={{ content: "Save changes", onAction: saveCoreSettings, icon: SettingsIcon, disabled: !dirty }}
    >
      {dirty ? (
        <ContextualSaveBar
          message="Unsaved settings"
          saveAction={{ onAction: saveCoreSettings, loading: busy, disabled: !dirty }}
          discardAction={{ onAction: discardCoreSettings, disabled: busy }}
        />
      ) : null}

      <Layout>
        <Layout.Section>
          {busy ? <Spinner accessibilityLabel="Saving" size="small" /> : null}
        </Layout.Section>

        {setupBlocker ? (
          <Layout.Section>
            <Banner tone={setupBlocker.tone} title={setupBlocker.title}>
              {setupBlocker.body}
            </Banner>
          </Layout.Section>
        ) : null}

        {showCoreSuccess && lastCoreSettingsSavedAt ? (
          <Layout.Section>
            <Banner tone="success" title="Core settings saved">
              <Text as="p" variant="bodyMd">
                {`${actionData?.message} Saved at ${formatSavedAt(lastCoreSettingsSavedAt)}.`}
              </Text>
            </Banner>
          </Layout.Section>
        ) : null}

        {showCoreError ? (
          <Layout.Section>
            <Banner tone="critical" title="Could not save core settings">
              <Text as="p" variant="bodyMd">{actionData?.error || "Settings action failed."}</Text>
            </Banner>
          </Layout.Section>
        ) : null}

        {showGuardrailSuccess ? (
          <Layout.Section>
            <Banner tone="success" title="Guardrail updated">
              <Text as="p" variant="bodyMd">{actionData?.message || "Custom guardrail added."}</Text>
            </Banner>
          </Layout.Section>
        ) : null}

        {showGuardrailError ? (
          <Layout.Section>
            <Banner tone="critical" title="Could not update guardrails">
              <Text as="p" variant="bodyMd">{actionData?.error || "Settings action failed."}</Text>
            </Banner>
          </Layout.Section>
        ) : null}

        {showAddonSuccess ? (
          <Layout.Section>
            <Banner tone="success" title="Add-on updated">
              <Text as="p" variant="bodyMd">{actionData?.message || "Add-on status updated."}</Text>
              {actionData?.confirmationUrl ? (
                <Box paddingBlockStart="300">
                  <Button url={actionData.confirmationUrl} target="_top" variant="primary">
                    Open approval in Shopify
                  </Button>
                </Box>
              ) : null}
            </Banner>
          </Layout.Section>
        ) : null}

        {showAddonError ? (
          <Layout.Section>
            <Banner tone="critical" title="Could not update add-on">
              <Text as="p" variant="bodyMd">{actionData?.error || "Settings action failed."}</Text>
            </Banner>
          </Layout.Section>
        ) : null}

        {showWipeSuccess ? (
          <Layout.Section>
            <Banner tone="success" title="Merchant data deleted">
              <Text as="p" variant="bodyMd">{actionData?.message}</Text>
            </Banner>
          </Layout.Section>
        ) : null}

        {showWipeError ? (
          <Layout.Section>
            <Banner tone="critical" title="Could not delete merchant data">
              <Text as="p" variant="bodyMd">{actionData?.error}</Text>
            </Banner>
          </Layout.Section>
        ) : null}

        {actionData?.error && !["save-core", "save-guardrails", "toggle-addon", "wipe-merchant-data"].includes(actionData.intent || "") ? (
          <Layout.Section>
            <Banner tone="critical" icon={AlertCircleIcon}>
              <Text as="p" variant="bodyMd">{actionData.error}</Text>
            </Banner>
          </Layout.Section>
        ) : null}

        {actionData?.message && !["save-core", "save-guardrails", "toggle-addon", "wipe-merchant-data"].includes(actionData.intent || "") ? (
          <Layout.Section>
            <Banner tone="success">
              <Text as="p" variant="bodyMd">{actionData.message}</Text>
              {actionData.confirmationUrl ? (
                <Box paddingBlockStart="300">
                  <Button url={actionData.confirmationUrl} target="_top" variant="primary">
                    Approve add-on in Shopify
                  </Button>
                </Box>
              ) : null}
            </Banner>
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Box padding="300" borderWidth="025" borderColor="border" borderRadius="200">
            <InlineGrid columns={{ xs: 2, md: 4 }} gap="200">
              <SettingsSummaryStat
                label="Bot name"
                value={formState.bot_name || "Recete"}
                hint="Customer-facing assistant"
              />
              <SettingsSummaryStat
                label="Languages"
                value={enabledLanguageCount || 1}
                hint="Customer reply languages"
              />
              <SettingsSummaryStat
                label="Guardrails"
                value={data.guardrails.custom_guardrails.length}
                hint={data.guardrails.custom_guardrails.length > 0 ? "Custom rules added" : "No custom rules yet"}
              />
              <SettingsSummaryStat
                label="Add-ons"
                value={activeAddonCount}
                hint={activeAddonCount > 0 ? "Active features" : "No active add-ons"}
              />
            </InlineGrid>
          </Box>
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            id="core-settings"
            title="Bot behavior"
            subtitle="Keep this focused on the few settings merchants actually change."
            badge={<StatusBadge status={data.overview.subscription?.status}>{data.overview.subscription?.status || "inactive"}</StatusBadge>}
          >
            <Form method="post" ref={formRef}>
              <input type="hidden" name="intent" value="save-core" />
              <BlockStack gap="400">
                <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
                  <TextField label="Bot name" name="bot_name" value={formState.bot_name} onChange={(value) => setFormState((current) => ({ ...current, bot_name: value }))} autoComplete="off" />
                  <TextField label="Notification phone" name="notification_phone" value={formState.notification_phone} onChange={(value) => setFormState((current) => ({ ...current, notification_phone: value }))} autoComplete="off" />
                  <Select label="Tone" name="tone" value={formState.tone} options={[{ label: "Friendly", value: "friendly" }, { label: "Professional", value: "professional" }, { label: "Casual", value: "casual" }, { label: "Formal", value: "formal" }]} onChange={(value) => setFormState((current) => ({ ...current, tone: value as typeof current.tone }))} />
                  <Select label="Response length" name="response_length" value={formState.response_length} options={[{ label: "Short", value: "short" }, { label: "Medium", value: "medium" }, { label: "Long", value: "long" }]} onChange={(value) => setFormState((current) => ({ ...current, response_length: value as typeof current.response_length }))} />
                </InlineGrid>
                <InlineStack gap="300" wrap>
                  <Checkbox label="Allow emoji in responses" name="emoji" checked={formState.emoji} onChange={(checked) => setFormState((current) => ({ ...current, emoji: checked }))} />
                </InlineStack>

                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="300">
                    <BlockStack gap="050">
                      <Text as="h3" variant="headingSm">
                        Customer reply languages
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Choose the languages Recete can use when replying to customers. Recete will detect source content language automatically.
                      </Text>
                    </BlockStack>
                    <input type="hidden" name="enabled_langs" value={formState.enabled_langs} />
                    <InlineGrid columns={{ xs: 1, md: 2, lg: 3 }} gap="200">
                      {SERVICE_LANGUAGE_OPTIONS.map((option) => (
                        <Checkbox
                          key={option.value}
                          label={option.label}
                          checked={selectedServiceLanguages.includes(option.value)}
                          onChange={(checked) => toggleServiceLanguage(option.value, checked)}
                          disabled={
                            selectedServiceLanguages.length === 1
                            && selectedServiceLanguages.includes(option.value)
                          }
                        />
                      ))}
                    </InlineGrid>
                    <Text as="p" variant="bodySm" tone="subdued">
                      When you add a new customer reply language, Recete must rebuild product knowledge for that language before answers are fully ready.
                    </Text>
                  </BlockStack>
                </Box>

                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="300">
                    <BlockStack gap="050">
                      <Text as="h3" variant="headingSm">
                        Welcome message
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Recete uses this as the default post-delivery message. Customer and order details are inserted automatically.
                      </Text>
                    </BlockStack>
                    <Banner tone="info">
                      Recete sends this text as a normal WhatsApp message inside the 24-hour window. Outside that window, the platform handles template delivery automatically.
                    </Banner>
                    <TextField label="Welcome template body" name="whatsapp_welcome_template" value={formState.whatsapp_welcome_template} onChange={(value) => setFormState((current) => ({ ...current, whatsapp_welcome_template: value }))} autoComplete="off" multiline={6} helpText="Supported placeholders are listed below." />
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="medium">Insert variables</Text>
                      <InlineStack gap="200" wrap>
                        {WELCOME_TEMPLATE_TOKENS.map((item) => (
                          <Button
                            key={item.token}
                            onClick={() =>
                              setFormState((current) => ({
                                ...current,
                                whatsapp_welcome_template: appendWelcomeTemplateToken(
                                  current.whatsapp_welcome_template,
                                  item.token,
                                ),
                              }))
                            }
                          >
                            {item.label}
                          </Button>
                        ))}
                      </InlineStack>
                      <BlockStack gap="050">
                        {WELCOME_TEMPLATE_TOKENS.map((item) => (
                          <Text key={item.token} as="p" variant="bodySm" tone="subdued">
                            <strong>{item.token}</strong> {item.help}
                          </Text>
                        ))}
                      </BlockStack>
                    </BlockStack>
                    <Box padding="300" background="bg-surface" borderRadius="200">
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingSm">Preview</Text>
                        <Text as="p" variant="bodyMd">{welcomeTemplatePreview}</Text>
                      </BlockStack>
                    </Box>
                  </BlockStack>
                </Box>
                <PlanGate
                  blocked={onStarter}
                  requiredPlan="GROWTH"
                  upgradePlan={GROWTH_MONTHLY_PLAN}
                  upgradeUrl={data.managedPricingUrl}
                  title="AI Vision"
                  message="Starter merchants cannot enable buyer photo analysis. Upgrade to Growth to allow customer photo submissions in the embedded workflow."
                >
                  <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingSm">
                        AI Vision
                      </Text>
                      <Checkbox
                        label="Enable AI Vision for customer photos"
                        name="ai_vision_enabled"
                        checked={formState.ai_vision_enabled}
                        onChange={(checked) =>
                          setFormState((current) => ({ ...current, ai_vision_enabled: checked }))
                        }
                        helpText="When enabled, Growth and Pro merchants can accept photo-based support flows once backend image processing is available."
                      />
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {aiVisionEnabled
                          ? "AI Vision is enabled for this shop."
                          : "AI Vision is off for this shop. Turn it on when you want to allow customer photo analysis."}
                      </Text>
                    </BlockStack>
                  </Box>
                </PlanGate>
              </BlockStack>
            </Form>
          </SectionCard>
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            id="guardrails"
            title="Safety rules"
            subtitle="Add only the rules you actually need. Overuse will reduce answer quality."
            badge={<StatusBadge status={data.guardrails.custom_guardrails.length > 0 ? "active" : "pending"}>{data.guardrails.custom_guardrails.length > 0 ? "Configured" : "Not configured"}</StatusBadge>}
          >
            <Form method="post">
              <input type="hidden" name="intent" value="save-guardrails" />
              <input type="hidden" name="guardrails_json" value={JSON.stringify(data.guardrails.custom_guardrails)} />
              <BlockStack gap="400">
                <Banner tone="info">
                  Add a short internal name and at least one keyword or phrase before saving.
                </Banner>
                <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
                  <TextField
                    label="Guardrail name"
                    name="guardrail_name"
                    value={guardrailDraft.name}
                    onChange={(value) => setGuardrailDraft((current) => ({ ...current, name: value }))}
                    autoComplete="off"
                    requiredIndicator
                    helpText="Required. Use a short internal label such as Refund abuse or VIP escalation."
                    error={showGuardrailError && guardrailNameMissing ? "Enter a guardrail name." : undefined}
                  />
                  <TextField
                    label="Match keywords or phrase"
                    name="guardrail_value"
                    value={guardrailDraft.value}
                    onChange={(value) => setGuardrailDraft((current) => ({ ...current, value }))}
                    autoComplete="off"
                    requiredIndicator
                    helpText="Required. Enter comma-separated keywords or one exact phrase."
                    error={showGuardrailError && guardrailValueMissing ? "Enter keywords or a phrase to match." : undefined}
                  />
                  <Select label="Apply to" name="guardrail_apply_to" value={guardrailDraft.apply_to} options={[{ label: "Both user and AI", value: "both" }, { label: "User message", value: "user_message" }, { label: "AI response", value: "ai_response" }]} onChange={(value) => setGuardrailDraft((current) => ({ ...current, apply_to: value as GuardrailDraft["apply_to"] }))} />
                  <Select label="Match type" name="guardrail_match_type" value={guardrailDraft.match_type} options={[{ label: "Keywords", value: "keywords" }, { label: "Exact phrase", value: "phrase" }]} onChange={(value) => setGuardrailDraft((current) => ({ ...current, match_type: value as GuardrailDraft["match_type"] }))} />
                  <Select label="Action" name="guardrail_action" value={guardrailDraft.action} options={[{ label: "Block answer", value: "block" }, { label: "Escalate to human", value: "escalate" }]} onChange={(value) => setGuardrailDraft((current) => ({ ...current, action: value as GuardrailDraft["action"] }))} />
                </InlineGrid>
                <TextField label="Suggested response" name="guardrail_suggested_response" value={guardrailDraft.suggested_response} onChange={(value) => setGuardrailDraft((current) => ({ ...current, suggested_response: value }))} autoComplete="off" multiline={4} />
                <InlineStack>
                  <Button submit variant="primary" icon={LockIcon} loading={busy} disabled={guardrailDraftIncomplete}>
                    Add guardrail
                  </Button>
                </InlineStack>
              </BlockStack>
            </Form>

            <Box paddingBlockStart="400">
              <BlockStack gap="200">
                {data.guardrails.system_guardrails.map((guardrail) => (
                  <Box key={guardrail.id} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                    <InlineGrid columns={{ xs: 1, md: "2fr auto" }} gap="200">
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingSm">{guardrail.name}</Text>
                        <Text as="p" variant="bodySm" tone="subdued">{guardrail.description}</Text>
                      </BlockStack>
                      <InlineStack align="end">
                        <StatusBadge status="active">System</StatusBadge>
                      </InlineStack>
                    </InlineGrid>
                  </Box>
                ))}
                {data.guardrails.custom_guardrails.map((guardrail) => (
                  <Box key={guardrail.id} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                    <InlineGrid columns={{ xs: 1, md: "2fr auto" }} gap="200">
                      <BlockStack gap="100">
                        <Text as="h3" variant="headingSm">{guardrail.name}</Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {Array.isArray(guardrail.value) ? guardrail.value.join(", ") : guardrail.value}
                        </Text>
                      </BlockStack>
                      <InlineStack align="end">
                        <StatusBadge status={guardrail.action === "block" ? "failed" : "pending"}>{guardrail.action}</StatusBadge>
                      </InlineStack>
                    </InlineGrid>
                  </Box>
                ))}
              </BlockStack>
            </Box>
          </SectionCard>
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            title="Add-ons"
            subtitle="Enable only the features the merchant will actually use."
            badge={<StatusBadge status={activeAddonCount > 0 ? "active" : "pending"}>{activeAddonCount > 0 ? `${activeAddonCount} active` : "No add-ons active"}</StatusBadge>}
          >
            <BlockStack gap="300">
              <Banner tone="info">
                {onStarter
                  ? "Growth unlocks AI Vision. Pro unlocks custom branded WhatsApp and advanced add-ons."
                  : data.plan.planType === "GROWTH"
                    ? "Pro unlocks custom branded WhatsApp and the advanced add-ons listed below."
                    : "Your current plan can use any compatible add-on below."}
              </Banner>
              {data.plan.planType !== "PRO" ? (
                <InlineStack>
                  <Button url={data.managedPricingUrl} target="_top">
                    View plan options
                  </Button>
                </InlineStack>
              ) : null}
              {data.addons.length > 0 ? (
                <BlockStack gap="200">
                  {data.addons.map((addon) => (
                    <Box key={addon.key} padding="300" borderWidth="025" borderColor="border" borderRadius="200">
                      <InlineGrid columns={{ xs: 1, md: "2fr auto" }} gap="300">
                        <BlockStack gap="100">
                          <InlineStack gap="150" wrap blockAlign="center">
                            <Text as="h3" variant="headingSm">{addon.name}</Text>
                            <StatusBadge status={addon.status}>{addon.status}</StatusBadge>
                          </InlineStack>
                          <Text as="p" variant="bodySm" tone="subdued">{addon.description}</Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            ${addon.priceMonthly}/month {addon.planAllowed ? "for this plan" : "after a plan upgrade"}
                          </Text>
                        </BlockStack>
                        <InlineStack align="end">
                          <Form method="post">
                            <input type="hidden" name="intent" value="toggle-addon" />
                            <input type="hidden" name="addon_key" value={addon.key} />
                            <input type="hidden" name="addon_status" value={addon.status} />
                            <Button submit variant={addon.status === "active" ? "secondary" : "primary"} disabled={!addon.planAllowed && addon.status !== "active"}>
                              {addon.status === "active" ? "Disable add-on" : addon.planAllowed ? "Enable add-on" : "Upgrade required"}
                            </Button>
                          </Form>
                        </InlineStack>
                      </InlineGrid>
                    </Box>
                  ))}
                </BlockStack>
              ) : (
                <Text as="p" variant="bodyMd" tone="subdued">
                  No add-ons are configured for this merchant yet.
                </Text>
              )}
            </BlockStack>
          </SectionCard>
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            title="Danger zone"
            subtitle="Use only when you intentionally want to permanently clear merchant data from Recete."
          >
            <BlockStack gap="300">
              <Banner tone="critical">
                This permanently deletes merchant data including products, knowledge, conversations, orders, users,
                analytics, billing/add-ons, settings, integrations, and WhatsApp event records while keeping the merchant
                creation record. This action cannot be undone.
              </Banner>
              <Form method="post">
                <input type="hidden" name="intent" value="wipe-merchant-data" />
                <BlockStack gap="300">
                  <TextField
                    label={`Type "${MERCHANT_RESET_CONFIRM_PHRASE}" to confirm`}
                    name="wipe_confirmation"
                    value={wipeConfirmation}
                    onChange={setWipeConfirmation}
                    autoComplete="off"
                    helpText="This protects against accidental data deletion."
                  />
                  <InlineStack>
                    <Button
                      submit
                      tone="critical"
                      variant="primary"
                      loading={busy}
                      disabled={wipeConfirmation.trim() !== MERCHANT_RESET_CONFIRM_PHRASE}
                    >
                      Delete all merchant data
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Form>
            </BlockStack>
          </SectionCard>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function SettingsSummaryStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Box padding="150">
      <BlockStack gap="050">
        <Text as="p" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="headingMd">
          {value}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {hint}
        </Text>
      </BlockStack>
    </Box>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
