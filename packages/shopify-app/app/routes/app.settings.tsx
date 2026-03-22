import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import { useMemo, useRef, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AlertCircleIcon, GlobeIcon, LockIcon, SettingsIcon } from "@shopify/polaris-icons";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
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
import { PlanGate } from "../components/PlanGate";
import {
  cancelMerchantAddon,
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
import { MetricCard, SectionCard, StatusBadge } from "../components/shell-ui";
import { getPlanSnapshotByDomain } from "../services/planService.server";
import {
  GROWTH_MONTHLY_PLAN,
  PRO_MONTHLY_PLAN,
} from "../services/planDefinitions";

type ActionResult = {
  ok: boolean;
  intent?: string;
  message?: string;
  error?: string;
  confirmationUrl?: string;
};

type GuardrailDraft = {
  name: string;
  apply_to: "user_message" | "ai_response" | "both";
  match_type: "keywords" | "phrase";
  value: string;
  action: "block" | "escalate";
  suggested_response: string;
};

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
        multi_lang_rag_enabled: false,
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
      const defaultSourceLang = String(formData.get("default_source_lang") || "en").trim() || "en";
      const rawLangs = String(formData.get("enabled_langs") || defaultSourceLang)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const enabledLangs = Array.from(new Set([defaultSourceLang, ...rawLangs]));
      const requestedSenderMode =
        (String(formData.get("whatsapp_sender_mode") || "").trim() as
          | "merchant_own"
          | "corporate") || "merchant_own";
      const resolvedSenderMode = plan.planType === "PRO" ? requestedSenderMode : "corporate";

      await Promise.all([
        updateMerchantSettings(request, {
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
            whatsapp_sender_mode: resolvedSenderMode,
            ai_vision_enabled:
              plan.planType === "STARTER"
                ? false
                : formData.get("ai_vision_enabled") === "on",
            whatsapp_welcome_template:
              String(formData.get("whatsapp_welcome_template") || "").trim() || undefined,
          },
        }),
        updateMerchantMultiLangSettings(request, {
          default_source_lang: defaultSourceLang,
          enabled_langs: enabledLangs,
          multi_lang_rag_enabled: formData.get("multi_lang_rag_enabled") === "on",
        }),
      ]);

      return {
        ok: true,
        intent,
        message:
          plan.planType === "STARTER"
            ? "Core settings saved. AI Vision stayed off because it requires Growth, and shared Recete WhatsApp routing was kept because custom branded WhatsApp requires Pro."
            : plan.planType === "PRO"
              ? "Core settings saved."
              : "Core settings saved. Shared Recete WhatsApp routing was kept because custom branded WhatsApp requires Pro.",
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

    return { ok: false, intent, error: "Unknown settings action." } satisfies ActionResult;
  } catch (error) {
    return {
      ok: false,
      intent,
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
  const busy = navigation.state !== "idle";

  const [formState, setFormState] = useState({
    bot_name: persona.bot_name || "",
    tone: persona.tone || "friendly",
    response_length: persona.response_length || "medium",
    whatsapp_sender_mode: persona.whatsapp_sender_mode || "merchant_own",
    notification_phone: data.merchant.notification_phone || "",
    whatsapp_welcome_template: persona.whatsapp_welcome_template || "",
    default_source_lang: data.multiLang.default_source_lang || "en",
    enabled_langs: (data.multiLang.enabled_langs || []).join(", "),
    emoji: persona.emoji !== false,
    ai_vision_enabled: Boolean(persona.ai_vision_enabled),
    multi_lang_rag_enabled: Boolean(data.multiLang.multi_lang_rag_enabled),
  });
  const [guardrailDraft, setGuardrailDraft] = useState<GuardrailDraft>({
    name: "",
    apply_to: "both",
    match_type: "keywords",
    value: "",
    action: "block",
    suggested_response: "",
  });

  const initialState = useMemo(
    () =>
      JSON.stringify({
        bot_name: persona.bot_name || "",
        tone: persona.tone || "friendly",
        response_length: persona.response_length || "medium",
        whatsapp_sender_mode: persona.whatsapp_sender_mode || "merchant_own",
        notification_phone: data.merchant.notification_phone || "",
        whatsapp_welcome_template: persona.whatsapp_welcome_template || "",
        default_source_lang: data.multiLang.default_source_lang || "en",
        enabled_langs: (data.multiLang.enabled_langs || []).join(", "),
        emoji: persona.emoji !== false,
        ai_vision_enabled: Boolean(persona.ai_vision_enabled),
        multi_lang_rag_enabled: Boolean(data.multiLang.multi_lang_rag_enabled),
      }),
    [data.merchant.notification_phone, data.multiLang.default_source_lang, data.multiLang.enabled_langs, data.multiLang.multi_lang_rag_enabled, persona.ai_vision_enabled, persona.bot_name, persona.emoji, persona.response_length, persona.tone, persona.whatsapp_sender_mode, persona.whatsapp_welcome_template],
  );
  const dirty = initialState !== JSON.stringify(formState);
  const activeAddonCount = data.addons.filter((addon) => addon.status === "active").length;
  const onStarter = data.plan.planType === "STARTER";
  const onGrowthOrLower = data.plan.planType !== "PRO";
  const aiVisionEnabled = !onStarter && formState.ai_vision_enabled;

  const saveCoreSettings = () => {
    if (formRef.current) submit(formRef.current);
  };

  const discardCoreSettings = () => {
    setFormState(JSON.parse(initialState));
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
      subtitle="Merchant bot behavior, WhatsApp routing, multilingual retrieval, and control policies."
      primaryAction={{ content: "Save core settings", onAction: saveCoreSettings, icon: SettingsIcon, disabled: !dirty }}
    >
      {dirty ? (
        <ContextualSaveBar
          message="Unsaved core settings"
          saveAction={{ onAction: saveCoreSettings, loading: busy, disabled: !dirty }}
          discardAction={{ onAction: discardCoreSettings, disabled: busy }}
        />
      ) : null}

      <Layout>
        <Layout.Section>
          {busy ? <Spinner accessibilityLabel="Saving" size="small" /> : null}
        </Layout.Section>

        {actionData?.error ? (
          <Layout.Section>
            <Banner tone="critical" icon={AlertCircleIcon}>
              <Text as="p" variant="bodyMd">{actionData.error}</Text>
            </Banner>
          </Layout.Section>
        ) : null}

        {actionData?.message ? (
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
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
            <MetricCard label="Bot name" value={formState.bot_name || "Recete"} hint="Customer-facing assistant identity." />
            <MetricCard label="Tone" value={formState.tone} hint="Default voice style for outbound and reply messaging." />
            <MetricCard label="AI Vision" value={aiVisionEnabled ? "Enabled" : onStarter ? "Locked" : "Disabled"} hint="Customer photo analysis requires Growth or higher." />
            <MetricCard label="Add-ons active" value={activeAddonCount} hint="Feature modules turned on for this merchant." />
            <MetricCard label="Custom guardrails" value={data.guardrails.custom_guardrails.length} hint="Merchant-defined safety or escalation rules." />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            title="Tier-controlled capabilities"
            subtitle="These controls reflect the final Recete pricing strategy and should make upgrade boundaries explicit inside Shopify."
            badge={<StatusBadge status={data.plan.planType.toLowerCase()}>{data.plan.planType}</StatusBadge>}
          >
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <PlanGate
                blocked={onStarter}
                requiredPlan="GROWTH"
                upgradePlan={GROWTH_MONTHLY_PLAN}
                title="AI Vision"
                message="Starter merchants cannot enable buyer photo analysis. Upgrade to Growth to accept customer photos and use AI vision workflows."
              >
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">AI Vision</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Buyers can send product photos for analysis and richer support flows.
                  </Text>
                </BlockStack>
              </PlanGate>
              <PlanGate
                blocked={onGrowthOrLower}
                requiredPlan="PRO"
                upgradePlan={PRO_MONTHLY_PLAN}
                title="Smart Re-order"
                message="Smart Re-order is a Pro-only upsell capability. Upgrade to Pro to unlock advanced reorder suggestions and custom-branded WhatsApp routing."
              >
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">Smart Re-order</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Turn upsell links into a more opinionated post-purchase reorder program.
                  </Text>
                </BlockStack>
              </PlanGate>
              <PlanGate
                blocked={onGrowthOrLower}
                requiredPlan="PRO"
                upgradePlan={PRO_MONTHLY_PLAN}
                title="Advanced analytics"
                message="Advanced analytics is reserved for Pro. Upgrade if the merchant needs deeper retention reporting from the embedded shell."
              >
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">Advanced analytics</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Pro stores can expose a higher signal analytics layer beyond the basic operational dashboard.
                  </Text>
                </BlockStack>
              </PlanGate>
              <PlanGate
                blocked={onGrowthOrLower}
                requiredPlan="PRO"
                upgradePlan={PRO_MONTHLY_PLAN}
                title="Custom branded WhatsApp"
                message="Starter and Growth shops use the shared Recete number. Upgrade to Pro to switch the merchant onto a custom branded WhatsApp number."
              >
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">Custom branded WhatsApp</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    The shared Recete number remains the default until the shop moves onto Pro.
                  </Text>
                </BlockStack>
              </PlanGate>
            </InlineGrid>
          </SectionCard>
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            title="Core merchant controls"
            subtitle="These are the daily behavior settings merchants expect to adjust without leaving Shopify."
            badge={<StatusBadge status={data.overview.subscription?.status}>{data.overview.subscription?.status || "inactive"}</StatusBadge>}
          >
            <Form method="post" ref={formRef}>
              <input type="hidden" name="intent" value="save-core" />
              <BlockStack gap="400">
                <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                  <TextField label="Bot name" name="bot_name" value={formState.bot_name} onChange={(value) => setFormState((current) => ({ ...current, bot_name: value }))} autoComplete="off" />
                  <TextField label="Notification phone" name="notification_phone" value={formState.notification_phone} onChange={(value) => setFormState((current) => ({ ...current, notification_phone: value }))} autoComplete="off" />
                  <Select label="Tone" name="tone" value={formState.tone} options={[{ label: "Friendly", value: "friendly" }, { label: "Professional", value: "professional" }, { label: "Casual", value: "casual" }, { label: "Formal", value: "formal" }]} onChange={(value) => setFormState((current) => ({ ...current, tone: value as typeof current.tone }))} />
                  <Select label="Response length" name="response_length" value={formState.response_length} options={[{ label: "Short", value: "short" }, { label: "Medium", value: "medium" }, { label: "Long", value: "long" }]} onChange={(value) => setFormState((current) => ({ ...current, response_length: value as typeof current.response_length }))} />
                  <Select label="WhatsApp sender mode" name="whatsapp_sender_mode" value={formState.whatsapp_sender_mode} options={[{ label: "Merchant own number", value: "merchant_own" }, { label: "Corporate number", value: "corporate" }]} onChange={(value) => setFormState((current) => ({ ...current, whatsapp_sender_mode: value as typeof current.whatsapp_sender_mode }))} />
                  <Select label="Default source language" name="default_source_lang" value={formState.default_source_lang} options={[{ label: "English", value: "en" }, { label: "Turkish", value: "tr" }, { label: "Hungarian", value: "hu" }, { label: "German", value: "de" }, { label: "Greek", value: "el" }]} onChange={(value) => setFormState((current) => ({ ...current, default_source_lang: value }))} />
                  <TextField label="Enabled languages" name="enabled_langs" value={formState.enabled_langs} onChange={(value) => setFormState((current) => ({ ...current, enabled_langs: value }))} autoComplete="off" helpText="Comma separated values like en, tr, de." />
                  <Box paddingBlockStart="500">
                    <BlockStack gap="300">
                      <Checkbox label="Allow emoji in responses" name="emoji" checked={formState.emoji} onChange={(checked) => setFormState((current) => ({ ...current, emoji: checked }))} />
                      <Checkbox label="Enable multilingual RAG" name="multi_lang_rag_enabled" checked={formState.multi_lang_rag_enabled} onChange={(checked) => setFormState((current) => ({ ...current, multi_lang_rag_enabled: checked }))} />
                    </BlockStack>
                  </Box>
                </InlineGrid>
                <TextField label="Welcome template" name="whatsapp_welcome_template" value={formState.whatsapp_welcome_template} onChange={(value) => setFormState((current) => ({ ...current, whatsapp_welcome_template: value }))} autoComplete="off" multiline={6} />
                <PlanGate
                  blocked={onStarter}
                  requiredPlan="GROWTH"
                  upgradePlan={GROWTH_MONTHLY_PLAN}
                  title="AI Vision"
                  message="Starter merchants cannot enable buyer photo analysis. Upgrade to Growth to allow customer photo submissions in the embedded workflow."
                >
                  <Card padding="500">
                    <BlockStack gap="300">
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
                  </Card>
                </PlanGate>
              </BlockStack>
            </Form>
          </SectionCard>
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            title="Custom guardrails"
            subtitle="Add merchant-specific keywords or phrases that should block the AI or escalate the conversation."
            badge={<StatusBadge status={data.guardrails.custom_guardrails.length > 0 ? "active" : "pending"}>{data.guardrails.custom_guardrails.length > 0 ? "Configured" : "Not configured"}</StatusBadge>}
          >
            <Form method="post">
              <input type="hidden" name="intent" value="save-guardrails" />
              <input type="hidden" name="guardrails_json" value={JSON.stringify(data.guardrails.custom_guardrails)} />
              <BlockStack gap="400">
                <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                  <TextField label="Guardrail name" name="guardrail_name" value={guardrailDraft.name} onChange={(value) => setGuardrailDraft((current) => ({ ...current, name: value }))} autoComplete="off" />
                  <TextField label="Match keywords or phrase" name="guardrail_value" value={guardrailDraft.value} onChange={(value) => setGuardrailDraft((current) => ({ ...current, value }))} autoComplete="off" helpText="Comma separated keywords or a single phrase." />
                  <Select label="Apply to" name="guardrail_apply_to" value={guardrailDraft.apply_to} options={[{ label: "Both user and AI", value: "both" }, { label: "User message", value: "user_message" }, { label: "AI response", value: "ai_response" }]} onChange={(value) => setGuardrailDraft((current) => ({ ...current, apply_to: value as GuardrailDraft["apply_to"] }))} />
                  <Select label="Match type" name="guardrail_match_type" value={guardrailDraft.match_type} options={[{ label: "Keywords", value: "keywords" }, { label: "Exact phrase", value: "phrase" }]} onChange={(value) => setGuardrailDraft((current) => ({ ...current, match_type: value as GuardrailDraft["match_type"] }))} />
                  <Select label="Action" name="guardrail_action" value={guardrailDraft.action} options={[{ label: "Block answer", value: "block" }, { label: "Escalate to human", value: "escalate" }]} onChange={(value) => setGuardrailDraft((current) => ({ ...current, action: value as GuardrailDraft["action"] }))} />
                </InlineGrid>
                <TextField label="Suggested response" name="guardrail_suggested_response" value={guardrailDraft.suggested_response} onChange={(value) => setGuardrailDraft((current) => ({ ...current, suggested_response: value }))} autoComplete="off" multiline={4} />
                <InlineStack>
                  <Button submit variant="primary" icon={LockIcon} loading={busy}>
                    Add guardrail
                  </Button>
                </InlineStack>
              </BlockStack>
            </Form>

            <Box paddingBlockStart="400">
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                {data.guardrails.system_guardrails.map((guardrail) => (
                  <Card key={guardrail.id} padding="500">
                    <BlockStack gap="200">
                      <InlineStack align="space-between" gap="300">
                        <Text as="h3" variant="headingMd">{guardrail.name}</Text>
                        <StatusBadge status="active">System</StatusBadge>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">{guardrail.description}</Text>
                    </BlockStack>
                  </Card>
                ))}
                {data.guardrails.custom_guardrails.map((guardrail) => (
                  <Card key={guardrail.id} padding="500">
                    <BlockStack gap="200">
                      <InlineStack align="space-between" gap="300">
                        <Text as="h3" variant="headingMd">{guardrail.name}</Text>
                        <StatusBadge status={guardrail.action === "block" ? "failed" : "pending"}>{guardrail.action}</StatusBadge>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        {Array.isArray(guardrail.value) ? guardrail.value.join(", ") : guardrail.value}
                      </Text>
                    </BlockStack>
                  </Card>
                ))}
              </InlineGrid>
            </Box>
          </SectionCard>
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            title="Add-ons"
            subtitle="Expose optional modules here so merchants understand what is active, locked, or requires approval."
            badge={<StatusBadge status={activeAddonCount > 0 ? "active" : "pending"}>{activeAddonCount > 0 ? `${activeAddonCount} active` : "No add-ons active"}</StatusBadge>}
          >
            {data.addons.length > 0 ? (
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                {data.addons.map((addon) => (
                  <Card key={addon.key} padding="500">
                    <BlockStack gap="300">
                      <InlineStack align="space-between" gap="300">
                        <Box maxWidth="18rem">
                          <Text as="h3" variant="headingMd">{addon.name}</Text>
                          <Text as="p" variant="bodyMd" tone="subdued">{addon.description}</Text>
                        </Box>
                        <StatusBadge status={addon.status}>{addon.status}</StatusBadge>
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        ${addon.priceMonthly}/month {addon.planAllowed ? "for this plan" : "after a plan upgrade"}
                      </Text>
                      <Form method="post">
                        <input type="hidden" name="intent" value="toggle-addon" />
                        <input type="hidden" name="addon_key" value={addon.key} />
                        <input type="hidden" name="addon_status" value={addon.status} />
                        <Button submit variant={addon.status === "active" ? "secondary" : "primary"} disabled={!addon.planAllowed && addon.status !== "active"}>
                          {addon.status === "active" ? "Disable add-on" : addon.planAllowed ? "Enable add-on" : "Upgrade required"}
                        </Button>
                      </Form>
                    </BlockStack>
                  </Card>
                ))}
              </InlineGrid>
            ) : (
              <Text as="p" variant="bodyMd" tone="subdued">
                No add-ons are configured for this merchant yet.
              </Text>
            )}
          </SectionCard>
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            title="Operational note"
            subtitle="Keep language sprawl and bot behavior intentional. More options are not automatically better for merchant outcomes."
            badge={<StatusBadge status={formState.multi_lang_rag_enabled ? "active" : "pending"}>{formState.multi_lang_rag_enabled ? "Multilingual on" : "Multilingual off"}</StatusBadge>}
          >
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <Card padding="500">
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">Knowledge source discipline</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Default source language should match the merchant’s strongest product knowledge base and recipe quality.
                  </Text>
                </BlockStack>
              </Card>
              <Card padding="500">
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">Escalation clarity</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Guardrails should stay narrow and explicit. Over-broad rules will quietly reduce answer quality and throughput.
                  </Text>
                </BlockStack>
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
