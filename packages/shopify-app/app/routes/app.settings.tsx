import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { Form, useActionData, useLoaderData, useNavigation, useSubmit } from 'react-router';
import { SaveBar } from '@shopify/app-bridge-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { LockIcon } from '@shopify/polaris-icons';
import { Button, Checkbox, Select, TextField } from '@shopify/polaris';
import { authenticateEmbeddedAdmin } from '../lib/embeddedAuth.server';
import { shellSetupProgress, useAppBootstrapData } from './app';
import { PlanGate } from '../components/PlanGate';
import {
  cancelMerchantAddon,
  deleteMerchantDataFromAdminPanel,
  fetchMerchantAddons,
  fetchMerchantGuardrails,
  fetchMerchantMultiLangSettings,
  fetchMerchantOverviewFromRequest,
  fetchMerchantSettings,
  settle,
  subscribeMerchantAddon,
  updateMerchantGuardrails,
  type MerchantAddon,
  type MerchantGuardrail,
  type MerchantSettingsRecord,
  type ShopifyMerchantOverview,
} from '../platform.server';
import { AppPage, SectionCard, StatusBadge } from '../components/shell-ui';
import { getPlanSnapshotByDomain } from '../services/planService.server';
import { GROWTH_MONTHLY_PLAN } from '../services/planDefinitions';
import { persistMessagingSetup } from '../lib/persistMessagingSetup';
import { useActionToast } from '../lib/appBridge';

function getStoreHandle(shop: string) {
  return shop.replace(/\.myshopify\.com$/i, '');
}

function getManagedPricingUrl(shop: string) {
  const storeHandle = getStoreHandle(shop);
  const appHandle = process.env.SHOPIFY_MANAGED_PRICING_APP_HANDLE?.trim() || 'blackeagle';
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}

type ActionResult = {
  ok: boolean;
  intent?: string;
  message?: string;
  error?: string;
  confirmationUrl?: string;
};

const MERCHANT_RESET_CONFIRM_PHRASE = 'DELETE ALL MERCHANT DATA';

type GuardrailDraft = {
  name: string;
  apply_to: 'user_message' | 'ai_response' | 'both';
  match_type: 'keywords' | 'phrase';
  value: string;
  action: 'block' | 'escalate';
  suggested_response: string;
};

type CoreSettingsFormState = {
  bot_name: string;
  tone: 'friendly' | 'professional' | 'casual' | 'formal';
  response_length: 'short' | 'medium' | 'long';
  notification_phone: string;
  whatsapp_welcome_template: string;
  enabled_langs: string;
  emoji: boolean;
  ai_vision_enabled: boolean;
  message_send_mode: 'always' | 'all_products_required';
};

const SERVICE_LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'Turkish', value: 'tr' },
  { label: 'Hungarian', value: 'hu' },
  { label: 'German', value: 'de' },
  { label: 'Greek', value: 'el' },
] as const;

function parseLanguageList(value: string) {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function serializeLanguageList(values: string[]) {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean))).join(', ');
}

const WELCOME_TEMPLATE_TOKENS = [
  {
    label: 'First name',
    token: '{{customer_first_name}}',
    help: "Adds the buyer's first name.",
  },
  {
    label: 'Order number',
    token: '{{order_number}}',
    help: 'Adds the order number from Shopify.',
  },
  {
    label: 'Product names',
    token: '{{product_names}}',
    help: 'Adds product names in a natural sentence.',
  },
  {
    label: 'Product count',
    token: '{{product_count}}',
    help: 'Adds how many products were in the order.',
  },
  {
    label: 'Bot name',
    token: '{{bot_name}}',
    help: 'Adds the bot name set above.',
  },
] as const;

function parseGuardrailDrafts(raw: string, fallback: MerchantGuardrail[]): MerchantGuardrail[] {
  if (!raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw) as MerchantGuardrail[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeCoreFormState(
  state: CoreSettingsFormState,
  planType: 'STARTER' | 'GROWTH' | 'PRO'
): CoreSettingsFormState {
  const enabledLangs = parseLanguageList(state.enabled_langs);

  return {
    ...state,
    bot_name: state.bot_name.trim(),
    notification_phone: state.notification_phone.trim(),
    whatsapp_welcome_template: state.whatsapp_welcome_template.trim(),
    enabled_langs: serializeLanguageList(enabledLangs.length > 0 ? enabledLangs : ['en']),
    ai_vision_enabled: planType === 'STARTER' ? false : state.ai_vision_enabled,
    message_send_mode: state.message_send_mode || 'always',
  };
}

function appendWelcomeTemplateToken(template: string, token: string) {
  if (!template.trim()) return token;
  const needsSpacer = /[\s\n]$/.test(template);
  return `${template}${needsSpacer ? '' : ' '}${token}`;
}

function buildWelcomeTemplatePreview(template: string, botName: string) {
  const baseTemplate =
    template.trim() ||
    'Tekrar selamlar {{customer_first_name}}, "{{order_number}}" nolu siparişinize ait {{product_names}} elinize ulaşmış olmalı. Nasıl kullanacağınızı biliyor musunuz? Destek olmamızı ister misiniz?';

  return baseTemplate
    .replace(/\{\{\s*customer_first_name\s*\}\}/gi, 'Ayse')
    .replace(/\{\{\s*order_number\s*\}\}/gi, '1212')
    .replace(/\{\{\s*product_names\s*\}\}/gi, 'A serumu ve B kremi')
    .replace(/\{\{\s*product_count\s*\}\}/gi, '2')
    .replace(/\{\{\s*bot_name\s*\}\}/gi, botName.trim() || 'Recete');
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateEmbeddedAdmin(request);
  const [
    overviewResult,
    merchantSettingsResult,
    multiLangResult,
    guardrailsResult,
    addonsResult,
    plan,
  ] = await Promise.all([
    settle<ShopifyMerchantOverview>(fetchMerchantOverviewFromRequest(request), {
      merchant: { id: '', name: '' },
      shop: '',
      integration: { id: '', provider: 'shopify', status: 'unknown' },
      subscription: null,
      metrics: { totalOrders: 0, activeUsers: 0, totalProducts: 0, responseRate: 0 },
      analytics: {
        avgSentiment: 0,
        returnRate: 0,
        preventedReturns: 0,
        totalConversations: 0,
        resolvedConversations: 0,
      },
      settings: {},
      integrations: [],
      products: [],
      recentOrders: [],
    }),
    settle<MerchantSettingsRecord>(fetchMerchantSettings(request), {
      merchant: { id: '', name: '' },
    }),
    settle(fetchMerchantMultiLangSettings(request), {
      settings: {
        shop_id: '',
        default_source_lang: 'en',
        enabled_langs: ['en'],
        multi_lang_rag_enabled: true,
      },
    }),
    settle(fetchMerchantGuardrails(request), {
      system_guardrails: [],
      custom_guardrails: [],
    }),
    settle(fetchMerchantAddons(request), { addons: [] as MerchantAddon[] }),
    getPlanSnapshotByDomain(session.shop),
  ]);

  // Any of these failing used to silently pre-fill the form with blank
  // defaults, indistinguishable from a merchant who genuinely has nothing
  // configured yet. If they don't notice and hit Save, the write path has no
  // separate safeguard and would push those blanks over real settings. Warn
  // instead of pretending the load succeeded.
  const dataUnavailable = [
    overviewResult,
    merchantSettingsResult,
    multiLangResult,
    guardrailsResult,
    addonsResult,
  ].some((result) => !result.ok);

  return {
    overview: overviewResult.value,
    merchant: merchantSettingsResult.value.merchant,
    managedPricingUrl: getManagedPricingUrl(session.shop),
    multiLang: multiLangResult.value.settings,
    guardrails: guardrailsResult.value,
    addons: addonsResult.value.addons || [],
    plan,
    dataUnavailable,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateEmbeddedAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '').trim();

  try {
    if (intent === 'save-core') {
      const enabledLangs = parseLanguageList(String(formData.get('enabled_langs') || '')).filter(
        Boolean
      );

      const result = await persistMessagingSetup(request, session.shop, {
        botName: String(formData.get('bot_name') || '').trim() || null,
        tone:
          (String(formData.get('tone') || '').trim() as
            | 'friendly'
            | 'professional'
            | 'casual'
            | 'formal') || null,
        responseLength:
          (String(formData.get('response_length') || '').trim() as 'short' | 'medium' | 'long') ||
          null,
        emoji: formData.get('emoji') === 'on',
        aiVisionEnabled: formData.get('ai_vision_enabled') === 'on',
        notificationPhone: String(formData.get('notification_phone') || '').trim() || null,
        welcomeTemplate: String(formData.get('whatsapp_welcome_template') || '').trim() || null,
        messageSendMode:
          String(formData.get('message_send_mode') || 'always').trim() === 'all_products_required'
            ? 'all_products_required'
            : 'always',
        enabledLangs: enabledLangs.length > 0 ? enabledLangs : ['en'],
      });

      return { ok: result.ok, intent, message: result.message } satisfies ActionResult;
    }

    if (intent === 'save-guardrails') {
      const existing = parseGuardrailDrafts(String(formData.get('guardrails_json') || ''), []);
      const name = String(formData.get('guardrail_name') || '').trim();
      const value = String(formData.get('guardrail_value') || '').trim();

      if (!name || !value) {
        return {
          ok: false,
          intent,
          error: 'Guardrail name and matching value are required.',
        } satisfies ActionResult;
      }

      const newGuardrail: MerchantGuardrail = {
        id: `custom-${Date.now()}`,
        name,
        apply_to: String(
          formData.get('guardrail_apply_to') || 'both'
        ) as GuardrailDraft['apply_to'],
        match_type: String(
          formData.get('guardrail_match_type') || 'keywords'
        ) as GuardrailDraft['match_type'],
        value:
          String(formData.get('guardrail_match_type') || 'keywords') === 'phrase'
            ? value
            : value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
        action: String(formData.get('guardrail_action') || 'block') as GuardrailDraft['action'],
        suggested_response:
          String(formData.get('guardrail_suggested_response') || '').trim() || undefined,
      };

      await updateMerchantGuardrails(request, [...existing, newGuardrail]);
      return { ok: true, intent, message: 'Custom guardrail added.' } satisfies ActionResult;
    }

    if (intent === 'toggle-addon') {
      const addonKey = String(formData.get('addon_key') || '').trim();
      const addonStatus = String(formData.get('addon_status') || '').trim();
      if (!addonKey) {
        return { ok: false, intent, error: 'Addon key is required.' } satisfies ActionResult;
      }

      if (addonStatus === 'active') {
        await cancelMerchantAddon(request, addonKey);
        return { ok: true, intent, message: 'Add-on cancelled.' } satisfies ActionResult;
      }

      const response = (await subscribeMerchantAddon(request, addonKey)) as {
        confirmationUrl?: string;
      };
      return {
        ok: true,
        intent,
        message: 'Approval link created.',
        confirmationUrl: response.confirmationUrl,
      } satisfies ActionResult;
    }

    if (intent === 'wipe-merchant-data') {
      const confirmationText = String(formData.get('wipe_confirmation') || '').trim();
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
          "Your store's data has been deleted from Recete. Your account stays, so you can set up again.",
      } satisfies ActionResult;
    }

    return { ok: false, intent, error: 'Unknown settings action.' } satisfies ActionResult;
  } catch (error) {
    let errorMessage = 'Settings action failed.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error instanceof Response) {
      try {
        const body = (await error.clone().json()) as { error?: string; message?: string };
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
  const { bootstrapData: shellBootstrap } = useAppBootstrapData();
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);
  const persona = data.merchant.persona_settings || {};
  const busy = navigation.state !== 'idle';

  const [formState, setFormState] = useState<CoreSettingsFormState>({
    bot_name: persona.bot_name || '',
    tone: persona.tone || 'friendly',
    response_length: persona.response_length || 'medium',
    notification_phone: data.merchant.notification_phone || '',
    whatsapp_welcome_template: persona.whatsapp_welcome_template || '',
    enabled_langs: serializeLanguageList(data.multiLang.enabled_langs || ['en']),
    emoji: persona.emoji !== false,
    ai_vision_enabled: Boolean(persona.ai_vision_enabled),
    message_send_mode:
      (persona.message_send_mode as 'always' | 'all_products_required') || 'always',
  });
  const [guardrailDraft, setGuardrailDraft] = useState<GuardrailDraft>({
    name: '',
    apply_to: 'both',
    match_type: 'keywords',
    value: '',
    action: 'block',
    suggested_response: '',
  });
  const [wipeConfirmation, setWipeConfirmation] = useState('');
  // Collapsed by default: a store adjusting a setting should not scroll past
  // an irreversible delete form to get there.
  const [showDataDeletion, setShowDataDeletion] = useState(false);

  const loaderState = useMemo(
    () =>
      normalizeCoreFormState(
        {
          bot_name: persona.bot_name || '',
          tone: persona.tone || 'friendly',
          response_length: persona.response_length || 'medium',
          notification_phone: data.merchant.notification_phone || '',
          whatsapp_welcome_template: persona.whatsapp_welcome_template || '',
          enabled_langs: serializeLanguageList(data.multiLang.enabled_langs || ['en']),
          emoji: persona.emoji !== false,
          ai_vision_enabled: Boolean(persona.ai_vision_enabled),
          message_send_mode:
            (persona.message_send_mode as 'always' | 'all_products_required') || 'always',
        },
        data.plan.planType
      ),
    [
      data.merchant.notification_phone,
      data.multiLang.enabled_langs,
      data.plan.planType,
      persona.ai_vision_enabled,
      persona.bot_name,
      persona.emoji,
      persona.message_send_mode,
      persona.response_length,
      persona.tone,
      persona.whatsapp_welcome_template,
    ]
  );
  const loaderStateJson = useMemo(() => JSON.stringify(loaderState), [loaderState]);
  const [savedCoreStateJson, setSavedCoreStateJson] = useState(loaderStateJson);
  const dirty = savedCoreStateJson !== JSON.stringify(formState);
  const activeAddonCount = data.addons.filter((addon) => addon.status === 'active').length;
  const selectedServiceLanguages = parseLanguageList(formState.enabled_langs);
  const enabledLanguageCount = selectedServiceLanguages.length;
  const onStarter = data.plan.planType === 'STARTER';
  const aiVisionEnabled = !onStarter && formState.ai_vision_enabled;
  const guardrailNameMissing = !guardrailDraft.name.trim();
  const guardrailValueMissing = !guardrailDraft.value.trim();
  const guardrailDraftIncomplete = guardrailNameMissing || guardrailValueMissing;
  const setupProgress = shellSetupProgress(data.overview, shellBootstrap);
  const setupBlocker = !setupProgress.hasBilling
    ? {
        title: 'Choose a plan before launch',
        body: 'You can finish settings now, but the shop still needs an active Shopify plan before launch.',
        tone: 'warning' as const,
      }
    : !setupProgress.hasProducts
      ? {
          title: 'Products still need setup',
          body: 'These settings work best after products are prepared in the Products page.',
          tone: 'info' as const,
        }
      : null;

  const saveCoreSettings = () => {
    if (formRef.current) submit(formRef.current);
  };

  const discardCoreSettings = () => {
    setFormState(JSON.parse(savedCoreStateJson));
  };

  const showCoreSuccess = actionData?.ok && actionData.intent === 'save-core' && actionData.message;
  const showCoreError = !actionData?.ok && actionData?.intent === 'save-core' && actionData.error;
  const showGuardrailError =
    !actionData?.ok && actionData?.intent === 'save-guardrails' && actionData.error;
  const showAddonSuccess =
    actionData?.ok && actionData.intent === 'toggle-addon' && actionData.message;
  const showAddonError =
    !actionData?.ok && actionData?.intent === 'toggle-addon' && actionData.error;
  const showWipeError =
    !actionData?.ok && actionData?.intent === 'wipe-merchant-data' && actionData.error;
  // Confirmations go to an admin toast; a Banner stays only where Shopify
  // approval is still pending (confirmationUrl) or for errors.
  const toastMessage =
    actionData?.ok && actionData.message && !actionData.confirmationUrl
      ? actionData.intent === 'save-core'
        ? 'Settings saved'
        : actionData.intent === 'save-guardrails'
          ? actionData.message || 'Custom guardrail added.'
          : actionData.message
      : null;
  useActionToast(toastMessage, actionData, {
    duration: actionData?.intent === 'wipe-merchant-data' ? 8000 : undefined,
  });
  const welcomeTemplatePreview = useMemo(
    () => buildWelcomeTemplatePreview(formState.whatsapp_welcome_template, formState.bot_name),
    [formState.bot_name, formState.whatsapp_welcome_template]
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

  // Mark the form clean once per successful save. This used to depend on
  // showCoreSuccess, the message string, which is identical on every save: the
  // second save in a visit never re-ran it, so the Save bar stayed open and
  // blocked leaving the page.
  const handledSaveRef = useRef<unknown>(null);
  useEffect(() => {
    if (!showCoreSuccess || handledSaveRef.current === actionData) return;
    handledSaveRef.current = actionData;
    setFormState((current) => {
      const normalized = normalizeCoreFormState(current, data.plan.planType);
      setSavedCoreStateJson(JSON.stringify(normalized));
      return normalized;
    });
  }, [actionData, data.plan.planType, showCoreSuccess]);

  useEffect(() => {
    if (!dirty && savedCoreStateJson !== loaderStateJson) {
      setSavedCoreStateJson(loaderStateJson);
      setFormState(loaderState);
    }
  }, [dirty, loaderState, loaderStateJson, savedCoreStateJson]);

  if (navigation.state === 'loading') {
    return (
      <AppPage
        heading="Settings"
        subtitle="Adjust bot behavior, welcome messaging, languages, and safety rules."
      >
        <s-section>
          <s-stack alignItems="center" padding="large">
            <s-spinner accessibilityLabel="Loading settings" size="large" />
          </s-stack>
        </s-section>
      </AppPage>
    );
  }

  return (
    <AppPage
      heading="Settings"
      subtitle="Adjust bot behavior, welcome messaging, languages, and safety rules."
    >
      {/* Shopify's own save bar in the admin frame, not one drawn inside the
          app: it is what merchants know from every other admin page, and it
          warns them before they navigate away with unsaved changes. */}
      <SaveBar id="settings-save-bar" open={dirty}>
        <button variant="primary" onClick={saveCoreSettings} loading={busy ? '' : undefined}>
          Save
        </button>
        <button onClick={discardCoreSettings} disabled={busy}>
          Discard
        </button>
      </SaveBar>

      {busy ? <s-spinner accessibilityLabel="Saving" size="base" /> : null}

      {data.dataUnavailable ? (
        <s-banner tone="warning" heading="Couldn't reach Recete">
          <s-paragraph>
            Some fields below may be blank even if you&apos;ve already configured them, because we
            couldn&apos;t load your current settings. Refresh before saving, or you risk overwriting
            real settings with these blanks.
          </s-paragraph>
        </s-banner>
      ) : null}

      {setupBlocker ? (
        <s-banner tone={setupBlocker.tone} heading={setupBlocker.title}>
          <s-paragraph>{setupBlocker.body}</s-paragraph>
        </s-banner>
      ) : null}

      {showCoreError ? (
        <s-banner tone="critical" heading="Could not save core settings">
          <s-paragraph>{actionData?.error || 'Settings action failed.'}</s-paragraph>
        </s-banner>
      ) : null}

      {showGuardrailError ? (
        <s-banner tone="critical" heading="Could not update guardrails">
          <s-paragraph>{actionData?.error || 'Settings action failed.'}</s-paragraph>
        </s-banner>
      ) : null}

      {showAddonSuccess && actionData?.confirmationUrl ? (
        <s-banner tone="success" heading="Add-on updated">
          <s-paragraph>{actionData?.message || 'Add-on status updated.'}</s-paragraph>
          {actionData?.confirmationUrl ? (
            <s-button
              slot="secondary-actions"
              variant="primary"
              href={actionData.confirmationUrl}
              target="_top"
            >
              Open approval in Shopify
            </s-button>
          ) : null}
        </s-banner>
      ) : null}

      {showAddonError ? (
        <s-banner tone="critical" heading="Could not update add-on">
          <s-paragraph>{actionData?.error || 'Settings action failed.'}</s-paragraph>
        </s-banner>
      ) : null}

      {showWipeError ? (
        <s-banner tone="critical" heading="Could not delete store data">
          <s-paragraph>{actionData?.error}</s-paragraph>
        </s-banner>
      ) : null}

      {actionData?.error &&
      !['save-core', 'save-guardrails', 'toggle-addon', 'wipe-merchant-data'].includes(
        actionData.intent || ''
      ) ? (
        <s-banner tone="critical">
          <s-paragraph>{actionData.error}</s-paragraph>
        </s-banner>
      ) : null}

      {actionData?.message &&
      actionData.confirmationUrl &&
      !['save-core', 'save-guardrails', 'toggle-addon', 'wipe-merchant-data'].includes(
        actionData.intent || ''
      ) ? (
        <s-banner tone="success">
          <s-paragraph>{actionData.message}</s-paragraph>
          <s-button
            slot="secondary-actions"
            variant="primary"
            href={actionData.confirmationUrl}
            target="_top"
          >
            Approve add-on in Shopify
          </s-button>
        </s-banner>
      ) : null}

      <s-section>
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base">
          <SettingsSummaryStat
            label="Bot name"
            value={formState.bot_name || 'Recete'}
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
            hint={
              data.guardrails.custom_guardrails.length > 0
                ? 'Custom rules added'
                : 'No custom rules yet'
            }
          />
          <SettingsSummaryStat
            label="Add-ons"
            value={activeAddonCount}
            hint={activeAddonCount > 0 ? 'Active features' : 'No active add-ons'}
          />
        </s-grid>
      </s-section>

      <SectionCard
        id="core-settings"
        title="Bot behavior"
        subtitle="How your assistant introduces itself and talks to customers."
      >
        <Form method="post" ref={formRef}>
          <input type="hidden" name="intent" value="save-core" />
          <s-stack gap="base">
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
              <TextField
                label="Bot name"
                name="bot_name"
                value={formState.bot_name}
                onChange={(value) => setFormState((current) => ({ ...current, bot_name: value }))}
                autoComplete="off"
              />
              <TextField
                label="Notification phone"
                name="notification_phone"
                value={formState.notification_phone}
                onChange={(value) =>
                  setFormState((current) => ({ ...current, notification_phone: value }))
                }
                autoComplete="off"
              />
              <Select
                label="Tone"
                name="tone"
                value={formState.tone}
                options={[
                  { label: 'Friendly', value: 'friendly' },
                  { label: 'Professional', value: 'professional' },
                  { label: 'Casual', value: 'casual' },
                  { label: 'Formal', value: 'formal' },
                ]}
                onChange={(value) =>
                  setFormState((current) => ({
                    ...current,
                    tone: value as typeof current.tone,
                  }))
                }
              />
              <Select
                label="Response length"
                name="response_length"
                value={formState.response_length}
                options={[
                  { label: 'Short', value: 'short' },
                  { label: 'Medium', value: 'medium' },
                  { label: 'Long', value: 'long' },
                ]}
                onChange={(value) =>
                  setFormState((current) => ({
                    ...current,
                    response_length: value as typeof current.response_length,
                  }))
                }
              />
            </s-grid>
            <s-box>
              {/* Polaris Checkbox draws its tick from the `checked` prop, but a
                  form submit reads the DOM input, and the two drifted: a
                  ticked box was saved as off. Submit what the merchant sees. */}
              <input type="hidden" name="emoji" value={formState.emoji ? 'on' : 'off'} />
              <Checkbox
                label="Allow emoji in responses"
                checked={formState.emoji}
                onChange={(checked) => setFormState((current) => ({ ...current, emoji: checked }))}
              />
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack gap="base">
                <s-stack gap="small-300">
                  <s-heading>Customer reply languages</s-heading>
                  <s-paragraph color="subdued">
                    Choose the languages Recete can use when replying to customers. Recete will
                    detect source content language automatically.
                  </s-paragraph>
                </s-stack>
                <input type="hidden" name="enabled_langs" value={formState.enabled_langs} />
                <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="small">
                  {SERVICE_LANGUAGE_OPTIONS.map((option) => (
                    <Checkbox
                      key={option.value}
                      label={option.label}
                      checked={selectedServiceLanguages.includes(option.value)}
                      onChange={(checked) => toggleServiceLanguage(option.value, checked)}
                      disabled={
                        selectedServiceLanguages.length === 1 &&
                        selectedServiceLanguages.includes(option.value)
                      }
                    />
                  ))}
                </s-grid>
                <s-paragraph color="subdued">
                  When you add a new customer reply language, Recete must rebuild product knowledge
                  for that language before answers are fully ready.
                </s-paragraph>
              </s-stack>
            </s-box>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack gap="base">
                <s-stack gap="small-300">
                  <s-heading>Welcome message</s-heading>
                  <s-paragraph color="subdued">
                    Recete uses this as the default post-delivery message. Customer and order
                    details are inserted automatically.
                  </s-paragraph>
                </s-stack>
                <Select
                  label="WhatsApp message send rule"
                  name="message_send_mode"
                  value={formState.message_send_mode}
                  options={[
                    { label: 'Always send', value: 'always' },
                    {
                      label: 'Send only if all products are defined in Recete',
                      value: 'all_products_required',
                    },
                  ]}
                  onChange={(value) =>
                    setFormState((current) => ({
                      ...current,
                      message_send_mode: value as CoreSettingsFormState['message_send_mode'],
                    }))
                  }
                  helpText="Always send: a welcome message is sent for every delivery, even if some products are not defined in Recete. All products defined: the message is only sent when every product in the order has usage instructions in Recete."
                />
                <s-banner tone="info">
                  <s-paragraph>
                    Recete sends this text as a normal WhatsApp message inside the 24-hour window.
                    Outside that window, the platform handles template delivery automatically.
                  </s-paragraph>
                </s-banner>
                <TextField
                  label="Welcome template body"
                  name="whatsapp_welcome_template"
                  value={formState.whatsapp_welcome_template}
                  onChange={(value) =>
                    setFormState((current) => ({
                      ...current,
                      whatsapp_welcome_template: value,
                    }))
                  }
                  autoComplete="off"
                  multiline={6}
                  helpText="Supported placeholders are listed below."
                />
                <s-stack gap="small">
                  <s-text type="strong">Insert variables</s-text>
                  <s-stack direction="inline" gap="small-200">
                    {WELCOME_TEMPLATE_TOKENS.map((item) => (
                      <s-button
                        key={item.token}
                        onClick={() =>
                          setFormState((current) => ({
                            ...current,
                            whatsapp_welcome_template: appendWelcomeTemplateToken(
                              current.whatsapp_welcome_template,
                              item.token
                            ),
                          }))
                        }
                      >
                        {item.label}
                      </s-button>
                    ))}
                  </s-stack>
                  <s-stack gap="small-500">
                    {WELCOME_TEMPLATE_TOKENS.map((item) => (
                      <s-paragraph key={item.token} color="subdued">
                        <s-text type="strong">{item.token}</s-text> {item.help}
                      </s-paragraph>
                    ))}
                  </s-stack>
                </s-stack>
                <s-box padding="base" background="base" borderRadius="base">
                  <s-stack gap="small">
                    <s-heading>Preview</s-heading>
                    <s-paragraph>{welcomeTemplatePreview}</s-paragraph>
                  </s-stack>
                </s-box>
              </s-stack>
            </s-box>
            <PlanGate
              blocked={onStarter}
              requiredPlan="GROWTH"
              upgradePlan={GROWTH_MONTHLY_PLAN}
              upgradeUrl={data.managedPricingUrl}
              title="AI Vision"
              message="Photo analysis is part of the Growth plan. Upgrade to let customers send a photo of their product and get an answer about it."
            >
              <s-box padding="base" background="subdued" borderRadius="base">
                <s-stack gap="base">
                  <s-heading>AI Vision</s-heading>
                  <input
                    type="hidden"
                    name="ai_vision_enabled"
                    value={formState.ai_vision_enabled ? 'on' : 'off'}
                  />
                  <Checkbox
                    label="Enable AI Vision for customer photos (Growth or Pro plan required)"
                    checked={formState.ai_vision_enabled}
                    onChange={(checked) =>
                      setFormState((current) => ({ ...current, ai_vision_enabled: checked }))
                    }
                    helpText="Customers can send a photo on WhatsApp (for example of a damaged item) and Recete answers about what it shows."
                  />
                  <s-paragraph color="subdued">
                    {aiVisionEnabled
                      ? 'AI Vision is enabled for this shop.'
                      : 'AI Vision is off for this shop. Turn it on when you want to allow customer photo analysis.'}
                  </s-paragraph>
                </s-stack>
              </s-box>
            </PlanGate>
          </s-stack>
        </Form>
      </SectionCard>

      <SectionCard
        id="guardrails"
        title="Safety rules"
        subtitle="Add only the rules you need. Too many make answers worse."
        badge={
          <StatusBadge status={data.guardrails.custom_guardrails.length > 0 ? 'active' : 'pending'}>
            {data.guardrails.custom_guardrails.length > 0 ? 'Configured' : 'Not configured'}
          </StatusBadge>
        }
      >
        <Form method="post">
          <input type="hidden" name="intent" value="save-guardrails" />
          <input
            type="hidden"
            name="guardrails_json"
            value={JSON.stringify(data.guardrails.custom_guardrails)}
          />
          <s-stack gap="base">
            <s-banner tone="info">
              <s-paragraph>
                Add a short internal name and at least one keyword or phrase before saving.
              </s-paragraph>
            </s-banner>
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
              <TextField
                label="Guardrail name"
                name="guardrail_name"
                value={guardrailDraft.name}
                onChange={(value) => setGuardrailDraft((current) => ({ ...current, name: value }))}
                autoComplete="off"
                requiredIndicator
                helpText="Required. Use a short internal label such as Refund abuse or VIP escalation."
                error={
                  showGuardrailError && guardrailNameMissing ? 'Enter a guardrail name.' : undefined
                }
              />
              <TextField
                label="Match keywords or phrase"
                name="guardrail_value"
                value={guardrailDraft.value}
                onChange={(value) => setGuardrailDraft((current) => ({ ...current, value }))}
                autoComplete="off"
                requiredIndicator
                helpText="Required. Enter comma-separated keywords or one exact phrase."
                error={
                  showGuardrailError && guardrailValueMissing
                    ? 'Enter keywords or a phrase to match.'
                    : undefined
                }
              />
              <Select
                label="Apply to"
                name="guardrail_apply_to"
                value={guardrailDraft.apply_to}
                options={[
                  { label: 'Both user and AI', value: 'both' },
                  { label: 'User message', value: 'user_message' },
                  { label: 'AI response', value: 'ai_response' },
                ]}
                onChange={(value) =>
                  setGuardrailDraft((current) => ({
                    ...current,
                    apply_to: value as GuardrailDraft['apply_to'],
                  }))
                }
              />
              <Select
                label="Match type"
                name="guardrail_match_type"
                value={guardrailDraft.match_type}
                options={[
                  { label: 'Keywords (comma-separated words)', value: 'keywords' },
                  { label: 'Exact phrase (full match)', value: 'phrase' },
                ]}
                helpText="Keywords: triggers if any listed word appears. Exact phrase: triggers only on the complete phrase."
                onChange={(value) =>
                  setGuardrailDraft((current) => ({
                    ...current,
                    match_type: value as GuardrailDraft['match_type'],
                  }))
                }
              />
              <Select
                label="Action"
                name="guardrail_action"
                value={guardrailDraft.action}
                options={[
                  { label: 'Block answer', value: 'block' },
                  { label: 'Escalate to human', value: 'escalate' },
                ]}
                onChange={(value) =>
                  setGuardrailDraft((current) => ({
                    ...current,
                    action: value as GuardrailDraft['action'],
                  }))
                }
              />
            </s-grid>
            <TextField
              label="Suggested response"
              name="guardrail_suggested_response"
              value={guardrailDraft.suggested_response}
              onChange={(value) =>
                setGuardrailDraft((current) => ({ ...current, suggested_response: value }))
              }
              autoComplete="off"
              multiline={4}
            />
            <s-stack direction="inline">
              <Button
                submit
                variant="primary"
                icon={LockIcon}
                loading={busy}
                disabled={guardrailDraftIncomplete}
              >
                Add guardrail
              </Button>
            </s-stack>
          </s-stack>
        </Form>

        <s-stack gap="small">
          {data.guardrails.system_guardrails.map((guardrail) => (
            <s-box key={guardrail.id} padding="base" border="base" borderRadius="base">
              <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="start">
                <s-stack gap="small-400">
                  <s-heading>{guardrail.name}</s-heading>
                  <s-paragraph color="subdued">{guardrail.description}</s-paragraph>
                </s-stack>
                <StatusBadge status="active">System</StatusBadge>
              </s-grid>
            </s-box>
          ))}
          {data.guardrails.custom_guardrails.map((guardrail) => (
            <s-box key={guardrail.id} padding="base" border="base" borderRadius="base">
              <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="start">
                <s-stack gap="small-400">
                  <s-heading>{guardrail.name}</s-heading>
                  <s-paragraph color="subdued">
                    {Array.isArray(guardrail.value) ? guardrail.value.join(', ') : guardrail.value}
                  </s-paragraph>
                </s-stack>
                <StatusBadge status={guardrail.action === 'block' ? 'failed' : 'pending'}>
                  {guardrail.action}
                </StatusBadge>
              </s-grid>
            </s-box>
          ))}
        </s-stack>
      </SectionCard>

      <SectionCard
        title="Add-ons"
        subtitle="Turn on only what you will use."
        badge={
          <StatusBadge status={activeAddonCount > 0 ? 'active' : 'pending'}>
            {activeAddonCount > 0 ? `${activeAddonCount} active` : 'No add-ons active'}
          </StatusBadge>
        }
      >
        <s-banner tone="info">
          <s-paragraph>
            {onStarter
              ? 'Growth unlocks AI Vision. Pro unlocks the advanced add-ons.'
              : data.plan.planType === 'GROWTH'
                ? 'Pro unlocks the advanced add-ons listed below.'
                : 'Your current plan can use any compatible add-on below.'}
          </s-paragraph>
        </s-banner>
        {data.plan.planType !== 'PRO' ? (
          <s-stack direction="inline">
            <s-button href={data.managedPricingUrl} target="_top">
              View plan options
            </s-button>
          </s-stack>
        ) : null}
        {data.addons.length > 0 ? (
          <s-stack gap="small">
            {data.addons.map((addon) => (
              <s-box key={addon.key} padding="base" border="base" borderRadius="base">
                <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
                  <s-stack gap="small-400">
                    <s-stack direction="inline" gap="small-300" alignItems="center">
                      <s-heading>{addon.name}</s-heading>
                      <StatusBadge status={addon.status}>{addon.status}</StatusBadge>
                    </s-stack>
                    <s-paragraph color="subdued">{addon.description}</s-paragraph>
                    <s-paragraph color="subdued">
                      ${addon.priceMonthly}/month{' '}
                      {addon.planAllowed ? 'for this plan' : 'after a plan upgrade'}
                    </s-paragraph>
                  </s-stack>
                  <Form method="post">
                    <input type="hidden" name="intent" value="toggle-addon" />
                    <input type="hidden" name="addon_key" value={addon.key} />
                    <input type="hidden" name="addon_status" value={addon.status} />
                    <Button
                      submit
                      variant={addon.status === 'active' ? 'secondary' : 'primary'}
                      disabled={!addon.planAllowed && addon.status !== 'active'}
                    >
                      {addon.status === 'active'
                        ? 'Disable add-on'
                        : addon.planAllowed
                          ? 'Enable add-on'
                          : 'Upgrade required'}
                    </Button>
                  </Form>
                </s-grid>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-paragraph color="subdued">
            No add-ons are configured for this merchant yet.
          </s-paragraph>
        )}
      </SectionCard>

      <SectionCard
        title="Delete store data"
        subtitle="Permanently remove your store's data from Recete. Rarely needed."
      >
        {!showDataDeletion ? (
          <s-stack direction="inline">
            <s-button variant="tertiary" tone="critical" onClick={() => setShowDataDeletion(true)}>
              Show data deletion
            </s-button>
          </s-stack>
        ) : (
          <s-stack gap="base">
            <s-banner tone="critical">
              <s-paragraph>
                This deletes your products, product knowledge, conversations, orders, customers,
                analytics, add-ons, settings, integrations and WhatsApp records from Recete. Your
                account itself stays. This cannot be undone.
              </s-paragraph>
            </s-banner>
            <Form method="post">
              <input type="hidden" name="intent" value="wipe-merchant-data" />
              <s-stack gap="base">
                <TextField
                  label={`Type "${MERCHANT_RESET_CONFIRM_PHRASE}" to confirm`}
                  name="wipe_confirmation"
                  value={wipeConfirmation}
                  onChange={setWipeConfirmation}
                  autoComplete="off"
                  helpText="This protects against accidental data deletion."
                />
                <s-stack direction="inline">
                  <Button
                    submit
                    tone="critical"
                    variant="primary"
                    loading={busy}
                    disabled={wipeConfirmation.trim() !== MERCHANT_RESET_CONFIRM_PHRASE}
                  >
                    Delete all store data
                  </Button>
                </s-stack>
              </s-stack>
            </Form>
          </s-stack>
        )}
      </SectionCard>
    </AppPage>
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
    <s-stack gap="small-400">
      <s-text color="subdued">{label}</s-text>
      <s-heading>{value}</s-heading>
      <s-text color="subdued">{hint}</s-text>
    </s-stack>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
