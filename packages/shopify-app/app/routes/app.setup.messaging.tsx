import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, Link as RemixLink, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { useMemo, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import {
  fetchMerchantSettings,
  fetchMerchantMultiLangSettings,
  type MerchantSettingsRecord,
} from "../platform.server";
import { persistMessagingSetup } from "../lib/persistMessagingSetup";

const WELCOME_TEMPLATE_TOKENS = [
  { label: "First name", token: "{{customer_first_name}}" },
  { label: "Order number", token: "{{order_number}}" },
  { label: "Product names", token: "{{product_names}}" },
  { label: "Bot name", token: "{{bot_name}}" },
] as const;

const LANGUAGE_OPTIONS = [
  { label: "English", value: "en" },
  { label: "Turkish", value: "tr" },
  { label: "Hungarian", value: "hu" },
  { label: "German", value: "de" },
  { label: "Greek", value: "el" },
] as const;

function appendToken(template: string, token: string) {
  if (!template.trim()) return token;
  const needsSpace = /[\s\n]$/.test(template);
  return `${template}${needsSpace ? "" : " "}${token}`;
}

function buildPreview(template: string, botName: string) {
  const base =
    template.trim() ||
    'Hi {{customer_first_name}}, your order "{{order_number}}" with {{product_names}} should have arrived. Need help using it? — {{bot_name}}';
  return base
    .replace(/\{\{\s*customer_first_name\s*\}\}/gi, "Ayse")
    .replace(/\{\{\s*order_number\s*\}\}/gi, "1212")
    .replace(/\{\{\s*product_names\s*\}\}/gi, "Serum A and Cream B")
    .replace(/\{\{\s*product_count\s*\}\}/gi, "2")
    .replace(/\{\{\s*bot_name\s*\}\}/gi, botName.trim() || "Recete");
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  const [settings, multiLang] = await Promise.all([
    fetchMerchantSettings(request).catch((): MerchantSettingsRecord => ({
      merchant: { id: "", name: "" },
    })),
    fetchMerchantMultiLangSettings(request).catch(() => ({
      settings: {
        shop_id: "",
        default_source_lang: "en",
        enabled_langs: ["en"],
        multi_lang_rag_enabled: true,
      },
    })),
  ]);

  const persona = settings.merchant.persona_settings || {};
  const enabledLangs = multiLang.settings?.enabled_langs || ["en"];
  const defaultLanguage = enabledLangs[0] || "en";

  return {
    botName: persona.bot_name || "",
    defaultLanguage,
    welcomeTemplate: persona.whatsapp_welcome_template || "",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateEmbeddedAdmin(request);
  const formData = await request.formData();

  const botName = String(formData.get("bot_name") || "").trim();
  const defaultLanguage = String(formData.get("default_language") || "en").trim();
  const welcomeTemplate = String(formData.get("welcome_template") || "").trim();

  try {
    const result = await persistMessagingSetup(request, session.shop, {
      botName,
      welcomeTemplate,
      enabledLangs: [defaultLanguage || "en"],
    });

    if (!result.ok) {
      return { ok: false, error: result.message };
    }

    // Setup is one step closer to done — head back to the overview.
    return redirect("/app?setup=messaging_saved");
  } catch (error) {
    let message = "Could not save messaging settings.";
    if (error instanceof Error) message = error.message;
    return { ok: false, error: message };
  }
};

export default function MessagingSetupPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  const [botName, setBotName] = useState(data.botName || "Recete");
  const [defaultLanguage, setDefaultLanguage] = useState(data.defaultLanguage || "en");
  const [welcomeTemplate, setWelcomeTemplate] = useState(data.welcomeTemplate || "");

  const preview = useMemo(() => buildPreview(welcomeTemplate, botName), [welcomeTemplate, botName]);

  return (
    <Page
      title="Set up your welcome message"
      subtitle="Three quick fields. You can fine-tune everything else from Settings later."
      backAction={{ content: "Back to setup", url: "/app" }}
    >
      <BlockStack gap="400">
        <Card padding="400" roundedAbove="sm">
          <Form method="post">
            <BlockStack gap="400">
              {actionData?.error ? (
                <Banner tone="critical">
                  <Text as="p" variant="bodyMd">
                    {actionData.error}
                  </Text>
                </Banner>
              ) : null}

              <Banner tone="info">
                These three settings are enough to start sending WhatsApp messages to your customers after delivery.
                Advanced behavior (tone, guardrails, languages) lives in Settings.
              </Banner>

              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <TextField
                  label="Bot name"
                  name="bot_name"
                  value={botName}
                  onChange={setBotName}
                  helpText="Shown to customers as the assistant signature."
                  autoComplete="off"
                />
                <Select
                  label="Default language"
                  name="default_language"
                  value={defaultLanguage}
                  options={LANGUAGE_OPTIONS.map((opt) => ({ label: opt.label, value: opt.value }))}
                  onChange={setDefaultLanguage}
                  helpText="Primary language Recete uses when replying."
                />
              </InlineGrid>

              <TextField
                label="Welcome message"
                name="welcome_template"
                value={welcomeTemplate}
                onChange={setWelcomeTemplate}
                multiline={5}
                autoComplete="off"
                helpText="Sent on the day delivery is confirmed. Use the tokens below to insert order details."
                placeholder='Hi {{customer_first_name}}, your order "{{order_number}}" with {{product_names}} should have arrived. Need help using it?'
              />

              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="medium">
                  Insert variables
                </Text>
                <InlineStack gap="200" wrap>
                  {WELCOME_TEMPLATE_TOKENS.map((item) => (
                    <Button
                      key={item.token}
                      onClick={() => setWelcomeTemplate((current) => appendToken(current, item.token))}
                    >
                      {item.label}
                    </Button>
                  ))}
                </InlineStack>
              </BlockStack>

              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="150">
                  <Text as="p" variant="bodySm" fontWeight="medium">
                    Preview
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {preview}
                  </Text>
                </BlockStack>
              </Box>

              <InlineStack align="end" gap="200">
                <Button url="/app" disabled={busy}>
                  Cancel
                </Button>
                <Button submit variant="primary" loading={busy}>
                  Save and continue
                </Button>
              </InlineStack>

              <Box paddingBlockStart="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  Need tone, response length, guardrails, or add-ons?{" "}
                  <RemixLink to="/app/settings">Open full settings</RemixLink>
                </Text>
              </Box>
            </BlockStack>
          </Form>
        </Card>
      </BlockStack>
    </Page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
