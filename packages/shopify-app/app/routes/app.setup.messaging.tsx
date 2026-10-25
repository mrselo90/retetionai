import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from 'react-router';
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
} from 'react-router';
import { useMemo, useRef, useState } from 'react';
import { SaveBar } from '@shopify/app-bridge-react';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { authenticateEmbeddedAdmin } from '../lib/embeddedAuth.server';
import {
  extractPlatformErrorMessage,
  fetchMerchantSettings,
  fetchMerchantMultiLangSettings,
  settle,
  type MerchantSettingsRecord,
} from '../platform.server';
import { persistMessagingSetup } from '../lib/persistMessagingSetup';
import { AppPage } from '../components/shell-ui';

const WHATSAPP_GDPR_URL = 'https://recete.co.uk/whatsapp-gdpr';

const WELCOME_TEMPLATE_TOKENS = [
  { label: 'First name', token: '{{customer_first_name}}' },
  { label: 'Order number', token: '{{order_number}}' },
  { label: 'Product names', token: '{{product_names}}' },
  { label: 'Bot name', token: '{{bot_name}}' },
] as const;

const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'Turkish', value: 'tr' },
  { label: 'Hungarian', value: 'hu' },
  { label: 'German', value: 'de' },
  { label: 'Greek', value: 'el' },
] as const;

/** The current value of an s-* field, read from its input/change event. */
function fieldValue(event: Event) {
  return (event.currentTarget as HTMLInputElement).value;
}

function appendToken(template: string, token: string) {
  if (!template.trim()) return token;
  const needsSpace = /[\s\n]$/.test(template);
  return `${template}${needsSpace ? '' : ' '}${token}`;
}

function buildPreview(template: string, botName: string) {
  const base =
    template.trim() ||
    'Hi {{customer_first_name}}, your order "{{order_number}}" with {{product_names}} should have arrived. Need help using it? — {{bot_name}}';
  return base
    .replace(/\{\{\s*customer_first_name\s*\}\}/gi, 'Ayse')
    .replace(/\{\{\s*order_number\s*\}\}/gi, '1212')
    .replace(/\{\{\s*product_names\s*\}\}/gi, 'Serum A and Cream B')
    .replace(/\{\{\s*product_count\s*\}\}/gi, '2')
    .replace(/\{\{\s*bot_name\s*\}\}/gi, botName.trim() || 'Recete');
}

/**
 * The languages to save, with `defaultLanguage` first.
 *
 * This step only picks the default, but it used to save `[defaultLanguage]` as
 * the whole list — so a merchant who had enabled English and Turkish in
 * Settings lost Turkish (and had its product knowledge purged) just by saving
 * their welcome message. Keeps every other enabled language, and returns null
 * ("leave unchanged") when nothing would change or the current list can't be
 * read, rather than guessing and overwriting it.
 */
async function withDefaultLanguage(request: Request, defaultLanguage: string) {
  let current: string[];
  try {
    const response = await fetchMerchantMultiLangSettings(request);
    current = response.settings?.enabled_langs || [];
  } catch {
    return null;
  }

  const next = [defaultLanguage, ...current.filter((lang) => lang !== defaultLanguage)];
  const unchanged = next.length === current.length && next.every((lang, i) => lang === current[i]);
  return unchanged ? null : next;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  const [settingsResult, multiLangResult] = await Promise.all([
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
  ]);

  const persona = settingsResult.value.merchant.persona_settings || {};
  const enabledLangs = multiLangResult.value.settings?.enabled_langs || ['en'];
  const defaultLanguage = persona.default_language || enabledLangs[0] || 'en';

  return {
    botName: persona.bot_name || '',
    defaultLanguage,
    welcomeTemplate: persona.whatsapp_welcome_template || '',
    // Blank fields on a genuinely fresh merchant look identical to blank
    // fields because the platform call failed - this tells the page which
    // one actually happened so it can warn rather than silently show blanks.
    settingsUnavailable: !settingsResult.ok || !multiLangResult.ok,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateEmbeddedAdmin(request);
  const formData = await request.formData();

  const botName = String(formData.get('bot_name') || '').trim();
  const defaultLanguage = String(formData.get('default_language') || 'en').trim();
  const welcomeTemplate = String(formData.get('welcome_template') || '').trim();

  try {
    const result = await persistMessagingSetup(request, session.shop, {
      botName,
      welcomeTemplate,
      defaultLanguage: defaultLanguage || 'en',
      enabledLangs: await withDefaultLanguage(request, defaultLanguage || 'en'),
    });

    if (!result.ok) {
      return { ok: false, error: result.message };
    }

    // Setup is one step closer to done — head back to the overview.
    return redirect('/app?setup=messaging_saved');
  } catch (error) {
    const message = await extractPlatformErrorMessage(error, 'Could not save messaging settings.');
    return { ok: false, error: message };
  }
};

export default function MessagingSetupPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const busy = navigation.state !== 'idle';

  const [botName, setBotName] = useState(data.botName || 'Recete');
  const [defaultLanguage, setDefaultLanguage] = useState(data.defaultLanguage || 'en');
  const [welcomeTemplate, setWelcomeTemplate] = useState(data.welcomeTemplate || '');
  const formRef = useRef<HTMLFormElement>(null);

  const initial = {
    botName: data.botName || 'Recete',
    defaultLanguage: data.defaultLanguage || 'en',
    welcomeTemplate: data.welcomeTemplate || '',
  };
  const dirty =
    botName !== initial.botName ||
    defaultLanguage !== initial.defaultLanguage ||
    welcomeTemplate !== initial.welcomeTemplate;

  const discard = () => {
    setBotName(initial.botName);
    setDefaultLanguage(initial.defaultLanguage);
    setWelcomeTemplate(initial.welcomeTemplate);
  };

  const preview = useMemo(() => buildPreview(welcomeTemplate, botName), [welcomeTemplate, botName]);

  return (
    <AppPage
      heading="Set up your welcome message"
      subtitle="Three quick fields. You can fine-tune everything else from Settings later."
      backAction={{ content: 'Back to setup', url: '/app' }}
    >
      {/* Shopify's save bar while there are unsaved edits; "Save and continue"
          below stays, since a merchant happy with the defaults still moves on. */}
      {/* Closed while the post-save redirect loads, so it never hangs over the
          next page. */}
      <SaveBar id="messaging-save-bar" open={dirty && navigation.state !== 'loading'}>
        <button
          variant="primary"
          onClick={() => formRef.current?.requestSubmit()}
          loading={busy ? '' : undefined}
        >
          Save
        </button>
        <button onClick={discard} disabled={busy}>
          Discard
        </button>
      </SaveBar>
      <s-section>
        <Form method="post" ref={formRef}>
          <s-stack gap="base">
            {data.settingsUnavailable ? (
              <s-banner tone="warning" heading="Couldn't reach Recete">
                <s-paragraph>
                  We couldn&apos;t load your current settings — the fields below may be blank even
                  if you&apos;ve already configured this. Refresh before saving.
                </s-paragraph>
              </s-banner>
            ) : null}

            {actionData?.error ? (
              <s-banner tone="critical">
                <s-paragraph>{actionData.error}</s-paragraph>
              </s-banner>
            ) : null}

            <s-banner tone="info">
              <s-paragraph>
                These three settings shape what customers receive after delivery. Advanced behavior
                (tone, guardrails, languages) lives in Settings.
              </s-paragraph>
            </s-banner>

            {/* Recete only messages customers with marketing consent, so the
                merchant's checkout wording and privacy notice must cover
                WhatsApp. This is the moment they set up what customers get. */}
            <s-banner tone="warning" heading="Before you go live: customer consent">
              <s-stack gap="small">
                <s-paragraph>
                  Recete only messages customers who accepted marketing at your checkout, and checks
                  again before every scheduled message. Make sure your checkout&apos;s consent
                  wording mentions WhatsApp and your privacy policy says you use it. Customers can
                  reply STOP at any time.
                </s-paragraph>
                <s-paragraph>
                  <s-link href={WHATSAPP_GDPR_URL} target="_blank">
                    Open the WhatsApp &amp; GDPR checklist (with a privacy policy paragraph)
                  </s-link>
                </s-paragraph>
              </s-stack>
            </s-banner>

            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
              <s-text-field
                label="Bot name"
                name="bot_name"
                value={botName}
                onInput={(event) => setBotName(fieldValue(event))}
                details="Shown to customers as the assistant signature."
                autocomplete="off"
              />
              <s-select
                label="Default language"
                name="default_language"
                value={defaultLanguage}
                onChange={(event) => setDefaultLanguage(fieldValue(event))}
                details="Primary language Recete uses when replying."
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <s-option key={opt.value} value={opt.value}>
                    {opt.label}
                  </s-option>
                ))}
              </s-select>
            </s-grid>

            <s-text-area
              label="Welcome message"
              name="welcome_template"
              value={welcomeTemplate}
              onInput={(event) => setWelcomeTemplate(fieldValue(event))}
              rows={5}
              autocomplete="off"
              details="Sent on the day delivery is confirmed. Use the tokens below to insert order details."
              placeholder='Hi {{customer_first_name}}, your order "{{order_number}}" with {{product_names}} should have arrived. Need help using it?'
            />

            <s-stack gap="small">
              <s-text type="strong">Insert variables</s-text>
              <s-stack direction="inline" gap="small-200">
                {WELCOME_TEMPLATE_TOKENS.map((item) => (
                  <s-button
                    key={item.token}
                    onClick={() =>
                      setWelcomeTemplate((current) => appendToken(current, item.token))
                    }
                  >
                    {item.label}
                  </s-button>
                ))}
              </s-stack>
            </s-stack>

            <s-box padding="base" background="subdued" borderRadius="base">
              <s-stack gap="small-200">
                <s-text type="strong">Preview</s-text>
                <s-paragraph>{preview}</s-paragraph>
              </s-stack>
            </s-box>

            <s-stack direction="inline" justifyContent="end" gap="small-200">
              <s-button disabled={busy || undefined} onClick={() => navigate('/app')}>
                Cancel
              </s-button>
              <s-button type="submit" variant="primary" loading={busy}>
                Save and continue
              </s-button>
            </s-stack>

            <s-paragraph color="subdued">
              Need tone, response length, guardrails, or add-ons?{' '}
              <s-link
                href="/app/settings"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('/app/settings');
                }}
              >
                Open full settings
              </s-link>
            </s-paragraph>
          </s-stack>
        </Form>
      </s-section>
    </AppPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
