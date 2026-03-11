import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import { useMemo, useRef, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { EditIcon, GlobeIcon, SettingsIcon } from "@shopify/polaris-icons";
import {
  Card,
  Checkbox,
  ContextualSaveBar,
  InlineGrid,
  Layout,
  Page,
  ProgressBar,
  Select,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import {
  fetchMerchantMultiLangSettings,
  fetchMerchantOverview,
  fetchMerchantSettings,
  updateMerchantMultiLangSettings,
  updateMerchantSettings,
} from "../platform.server";
import { MetricCard, SectionCard, StatusBadge } from "../components/shell-ui";

type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [overview, merchantSettings, multiLang] = await Promise.all([
    fetchMerchantOverview(session.shop),
    fetchMerchantSettings(session.shop),
    fetchMerchantMultiLangSettings(session.shop).catch(() => ({
      settings: {
        shop_id: "",
        default_source_lang: "en",
        enabled_langs: ["en"],
        multi_lang_rag_enabled: false,
      },
    })),
  ]);

  return {
    overview,
    merchant: merchantSettings.merchant,
    multiLang: multiLang.settings,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  try {
    const defaultSourceLang = String(formData.get("default_source_lang") || "en").trim() || "en";
    const rawLangs = String(formData.get("enabled_langs") || defaultSourceLang)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const enabledLangs = Array.from(new Set([defaultSourceLang, ...rawLangs]));

    await Promise.all([
      updateMerchantSettings(session.shop, {
        notification_phone: String(formData.get("notification_phone") || "").trim() || null,
        persona_settings: {
          bot_name: String(formData.get("bot_name") || "").trim() || undefined,
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
          whatsapp_sender_mode:
            (String(formData.get("whatsapp_sender_mode") || "").trim() as
              | "merchant_own"
              | "corporate") || "merchant_own",
          whatsapp_welcome_template:
            String(formData.get("whatsapp_welcome_template") || "").trim() || undefined,
        },
      }),
      updateMerchantMultiLangSettings(session.shop, {
        default_source_lang: defaultSourceLang,
        enabled_langs: enabledLangs,
        multi_lang_rag_enabled: formData.get("multi_lang_rag_enabled") === "on",
      }),
    ]);

    return { ok: true, message: "Settings saved successfully." } satisfies ActionResult;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Settings action failed.",
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

  const [formState, setFormState] = useState<{
    bot_name: string;
    tone: "friendly" | "professional" | "casual" | "formal";
    response_length: "short" | "medium" | "long";
    whatsapp_sender_mode: "merchant_own" | "corporate";
    notification_phone: string;
    whatsapp_welcome_template: string;
    default_source_lang: string;
    enabled_langs: string;
    emoji: boolean;
    multi_lang_rag_enabled: boolean;
  }>({
    bot_name: persona.bot_name || "",
    tone: persona.tone || "friendly",
    response_length: persona.response_length || "medium",
    whatsapp_sender_mode: persona.whatsapp_sender_mode || "merchant_own",
    notification_phone: data.merchant.notification_phone || "",
    whatsapp_welcome_template: persona.whatsapp_welcome_template || "",
    default_source_lang: data.multiLang.default_source_lang || "en",
    enabled_langs: (data.multiLang.enabled_langs || []).join(", "),
    emoji: persona.emoji !== false,
    multi_lang_rag_enabled: Boolean(data.multiLang.multi_lang_rag_enabled),
  });

  const initialState = useMemo(
    () => JSON.stringify(formState),
    [],
  );
  const currentState = JSON.stringify(formState);
  const dirty = initialState !== currentState;
  const busy = navigation.state !== "idle";

  const save = () => {
    if (formRef.current) submit(formRef.current);
  };

  const discard = () => {
    setFormState({
      bot_name: persona.bot_name || "",
      tone: persona.tone || "friendly",
      response_length: persona.response_length || "medium",
      whatsapp_sender_mode: persona.whatsapp_sender_mode || "merchant_own",
      notification_phone: data.merchant.notification_phone || "",
      whatsapp_welcome_template: persona.whatsapp_welcome_template || "",
      default_source_lang: data.multiLang.default_source_lang || "en",
      enabled_langs: (data.multiLang.enabled_langs || []).join(", "),
      emoji: persona.emoji !== false,
      multi_lang_rag_enabled: Boolean(data.multiLang.multi_lang_rag_enabled),
    });
  };

  if (navigation.state === "loading") {
    return (
      <SkeletonPage title="Settings" primaryAction>
        <Layout>
          <Layout.Section>
            <Card padding="500">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={4} />
            </Card>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page
      fullWidth
      title="Settings"
      subtitle="Merchant bot behavior, WhatsApp routing, and multilingual retrieval controls."
      primaryAction={{ content: "Save", onAction: save, icon: EditIcon, disabled: !dirty }}
    >
      {dirty ? (
        <ContextualSaveBar
          message="Unsaved settings"
          saveAction={{ onAction: save, loading: busy, disabled: !dirty }}
          discardAction={{ onAction: discard, disabled: busy }}
        />
      ) : null}

      <Layout>
        <Layout.Section>
          {busy ? <ProgressBar progress={80} size="small" /> : null}
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
            <MetricCard label="Bot name" value={formState.bot_name || "Recete"} hint="Customer-facing assistant identity." />
            <MetricCard label="Tone" value={formState.tone} hint="Default voice style for outbound and reply messaging." />
            <MetricCard label="Sender mode" value={formState.whatsapp_sender_mode} hint="WhatsApp routing mode configured for this merchant." />
            <MetricCard label="Languages" value={formState.enabled_langs.split(",").filter(Boolean).length} hint="Configured multilingual retrieval locales." />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          {actionData?.message ? <StatusBadge status="active">{actionData.message}</StatusBadge> : null}
          {actionData?.error ? <Text as="p" variant="bodyMd" tone="critical">{actionData.error}</Text> : null}
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            title="Merchant controls"
            subtitle="These are the core behavior settings merchants expect to manage without leaving Shopify."
            badge={<StatusBadge status={data.overview.subscription?.status}>{data.overview.subscription?.status || "inactive"}</StatusBadge>}
          >
            <Form method="post" ref={formRef}>
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <TextField label="Bot name" name="bot_name" value={formState.bot_name} onChange={(value) => setFormState((current) => ({ ...current, bot_name: value }))} autoComplete="off" />
                <Select label="Tone" name="tone" value={formState.tone} options={[{ label: "Friendly", value: "friendly" }, { label: "Professional", value: "professional" }, { label: "Casual", value: "casual" }, { label: "Formal", value: "formal" }]} onChange={(value) => setFormState((current) => ({ ...current, tone: value as typeof current.tone }))} />
                <Select label="Response length" name="response_length" value={formState.response_length} options={[{ label: "Short", value: "short" }, { label: "Medium", value: "medium" }, { label: "Long", value: "long" }]} onChange={(value) => setFormState((current) => ({ ...current, response_length: value as typeof current.response_length }))} />
                <Select label="Sender mode" name="whatsapp_sender_mode" value={formState.whatsapp_sender_mode} options={[{ label: "Merchant own number", value: "merchant_own" }, { label: "Corporate number", value: "corporate" }]} onChange={(value) => setFormState((current) => ({ ...current, whatsapp_sender_mode: value as typeof current.whatsapp_sender_mode }))} />
                <TextField label="Notification phone" name="notification_phone" value={formState.notification_phone} onChange={(value) => setFormState((current) => ({ ...current, notification_phone: value }))} autoComplete="off" />
                <TextField label="Enabled languages" name="enabled_langs" value={formState.enabled_langs} onChange={(value) => setFormState((current) => ({ ...current, enabled_langs: value }))} autoComplete="off" helpText="Comma separated values such as en, tr, de" />
                <Select label="Default source language" name="default_source_lang" value={formState.default_source_lang} options={[{ label: "English", value: "en" }, { label: "Turkish", value: "tr" }, { label: "Hungarian", value: "hu" }, { label: "German", value: "de" }, { label: "Greek", value: "el" }]} onChange={(value) => setFormState((current) => ({ ...current, default_source_lang: value }))} />
                <TextField label="Welcome template" name="whatsapp_welcome_template" value={formState.whatsapp_welcome_template} onChange={(value) => setFormState((current) => ({ ...current, whatsapp_welcome_template: value }))} autoComplete="off" multiline={6} />
              </InlineGrid>
              <Layout>
                <Layout.Section>
                  <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                    <Checkbox
                      label="Allow emoji in responses"
                      name="emoji"
                      checked={formState.emoji}
                      onChange={(checked) => setFormState((current) => ({ ...current, emoji: checked }))}
                    />
                    <Checkbox
                      label="Enable multilingual RAG"
                      name="multi_lang_rag_enabled"
                      checked={formState.multi_lang_rag_enabled}
                      onChange={(checked) =>
                        setFormState((current) => ({ ...current, multi_lang_rag_enabled: checked }))
                      }
                    />
                  </InlineGrid>
                </Layout.Section>
              </Layout>
            </Form>
          </SectionCard>
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            title="Operational note"
            subtitle="Keep language sprawl and bot behavior intentional. More options are not always better for merchant outcomes."
            badge={<StatusBadge status={formState.multi_lang_rag_enabled ? "active" : "pending"}>{formState.multi_lang_rag_enabled ? "Multilingual on" : "Multilingual off"}</StatusBadge>}
          >
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <Card padding="500">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Default source language should match the merchant’s strongest product knowledge base.
                </Text>
              </Card>
              <Card padding="500">
                <Text as="p" variant="bodyMd" tone="subdued">
                  The embedded shell should expose the main controls clearly even before advanced guardrails are added.
                </Text>
              </Card>
            </InlineGrid>
          </SectionCard>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
