'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  BlockStack,
  Box,
  Banner,
  Button as PolarisButton,
  Card as PolarisCard,
  Checkbox,
  ChoiceList,
  Divider,
  InlineStack,
  Layout,
  Page,
  RangeSlider,
  SkeletonPage,
  Text,
  TextField,
} from '@shopify/polaris';
import { Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ShopifySaveBar } from '@/components/ui/ShopifySaveBar';
import { InlineError } from '@/components/ui/InlineError';
import { isShopifyEmbedded } from '@/lib/shopifyEmbedded';

interface Merchant {
  id: string;
  name: string;
  notification_phone?: string | null;
  persona_settings?: {
    bot_name?: string;
    tone?: 'friendly' | 'professional' | 'casual' | 'formal';
    emoji?: boolean;
    response_length?: 'short' | 'medium' | 'long';
    temperature?: number;
    whatsapp_welcome_template?: string;
  };
  created_at: string;
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
    help: 'Adds the configured bot name.',
  },
] as const;

function appendWelcomeTemplateToken(template: string, token: string) {
  if (!template.trim()) return token;
  return /[\s\n]$/.test(template) ? `${template}${token}` : `${template} ${token}`;
}

function buildWelcomeTemplatePreview(template: string, botName: string) {
  const baseTemplate =
    template.trim() ||
    'Tekrar selamlar {{customer_first_name}}, "1212" nolu siparişinize ait {{product_names}} elinize ulaşmış olmalı. Nasıl kullanacağınızı biliyor musunuz? Destek olmamızı ister misiniz?';

  return baseTemplate
    .replace(/\{\{\s*customer_first_name\s*\}\}/gi, 'Ayse')
    .replace(/\{\{\s*order_number\s*\}\}/gi, '1212')
    .replace(/\{\{\s*product_names\s*\}\}/gi, 'A serumu ve B kremi')
    .replace(/\{\{\s*product_count\s*\}\}/gi, '2')
    .replace(/\{\{\s*bot_name\s*\}\}/gi, botName.trim() || 'Recete');
}

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Bot persona form state
  const [botName, setBotName] = useState('');
  const [tone, setTone] = useState<'friendly' | 'professional' | 'casual' | 'formal'>('friendly');
  const [emoji, setEmoji] = useState(true);
  const [responseLength, setResponseLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [temperature, setTemperature] = useState(0.7);
  const [whatsappWelcomeTemplate, setWhatsappWelcomeTemplate] = useState('');

  const welcomeTemplatePreview = buildWelcomeTemplatePreview(whatsappWelcomeTemplate, botName);

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  };

  const getErrorStatus = (err: unknown): number | undefined => {
    if (typeof err === 'object' && err !== null && 'status' in err) {
      const status = (err as { status?: unknown }).status;
      if (typeof status === 'number') return status;
    }
    return undefined;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const merchantResponse = await authenticatedRequest<{ merchant: Merchant }>(
        '/api/merchants/me',
        session.access_token
      );

      const persona = merchantResponse.merchant.persona_settings || {};
      setBotName(persona.bot_name || t('botPersona.namePlaceholder'));
      setTone(persona.tone || 'friendly');
      setEmoji(persona.emoji !== false);
      setResponseLength(persona.response_length || 'medium');
      setTemperature(persona.temperature || 0.7);
      setWhatsappWelcomeTemplate(
        typeof persona.whatsapp_welcome_template === 'string'
          ? persona.whatsapp_welcome_template
          : ''
      );
    } catch (err: unknown) {
      console.error('Failed to load settings:', err);
      if (getErrorStatus(err) === 401) {
        window.location.href = '/login';
      } else {
        toast.error(t('toasts.saveError.title'), t('toasts.saveError.message'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersona = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      setSaving(true);

      await authenticatedRequest('/api/merchants/me', session.access_token, {
        method: 'PUT',
        body: JSON.stringify({
          persona_settings: {
            bot_name: botName,
            tone,
            emoji,
            response_length: responseLength,
            temperature,
            whatsapp_welcome_template: whatsappWelcomeTemplate.trim() || undefined,
          },
        }),
      });

      toast.success(t('toasts.saveSuccess.title'), t('toasts.saveSuccess.message'));
      setSaveError(null);
      setIsDirty(false);
      await loadData();
    } catch (err: unknown) {
      console.error('Failed to save persona:', err);
      const message = getErrorMessage(err, t('toasts.saveError.message'));
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SkeletonPage title={t('title')}>
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <PolarisCard>
                <Box padding="400">
                  <div className="h-20 bg-zinc-100 rounded-lg animate-pulse" />
                </Box>
              </PolarisCard>
              <PolarisCard>
                <Box padding="400">
                  <div className="h-80 bg-zinc-100 rounded-lg animate-pulse" />
                </Box>
              </PolarisCard>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page title={t('title')} subtitle={t('description')} fullWidth>
      <Layout>
        <Layout.Section>
          <div className="space-y-6 animate-fade-in pb-8">
            {/* Bot Persona Settings */}
            <PolarisCard>
              <Box id="settings-bot-persona" padding="400">
                <BlockStack gap="400">
                  <InlineStack gap="300" blockAlign="start">
                    <Box background="bg-fill-brand" borderRadius="300" padding="300">
                      <Bot className="w-5 h-5 text-white" />
                    </Box>
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        {t('botPersona.title')}
                      </Text>
                      <Text as="p" tone="subdued">
                        {t('botPersona.description')}{' '}
                        <Link
                          href="/dashboard/settings/bot-info"
                          className="text-primary hover:text-primary/80 font-semibold transition-colors"
                        >
                          {t('botPersona.botInfoLink')}
                        </Link>
                      </Text>
                    </BlockStack>
                  </InlineStack>

                  {/* Bot Name */}
                  <TextField
                    label={t('botPersona.nameLabel')}
                    type="text"
                    value={botName}
                    onChange={(value) => {
                      setBotName(value);
                      setIsDirty(true);
                    }}
                    placeholder={t('botPersona.namePlaceholder')}
                    autoComplete="off"
                  />

                  {/* Tone */}
                  <ChoiceList
                    title={t('botPersona.toneLabel')}
                    choices={(['friendly', 'professional', 'casual', 'formal'] as const).map(
                      (tKey) => ({
                        label: t(`botPersona.tones.${tKey}`),
                        value: tKey,
                      })
                    )}
                    selected={[tone]}
                    onChange={(selected) => {
                      const next = selected[0] as typeof tone | undefined;
                      if (next) {
                        setTone(next);
                        setIsDirty(true);
                      }
                    }}
                  />

                  {/* Emoji */}
                  <Checkbox
                    label={t('botPersona.emojiLabel')}
                    helpText={t('botPersona.emojiDesc')}
                    checked={emoji}
                    onChange={(checked) => {
                      setEmoji(checked);
                      setIsDirty(true);
                    }}
                  />

                  {/* Response Length */}
                  <ChoiceList
                    title={t('botPersona.responseLengthLabel')}
                    choices={(['short', 'medium', 'long'] as const).map((length) => ({
                      label: t(`botPersona.lengths.${length}`),
                      value: length,
                    }))}
                    selected={[responseLength]}
                    onChange={(selected) => {
                      const next = selected[0] as typeof responseLength | undefined;
                      if (next) {
                        setResponseLength(next);
                        setIsDirty(true);
                      }
                    }}
                  />

                  {/* Temperature */}
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {t('botPersona.temperatureLabel', { value: temperature.toFixed(1) })}
                    </Text>
                    <RangeSlider
                      label={t('botPersona.temperatureLabel', { value: temperature.toFixed(1) })}
                      labelHidden
                      min={0}
                      max={1}
                      step={0.1}
                      value={temperature}
                      onChange={(value) => {
                        setTemperature(Number(value));
                        setIsDirty(true);
                      }}
                    />
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodySm" tone="subdued">
                        {t('botPersona.tempLabels.consistent')}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {t('botPersona.tempLabels.balanced')}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {t('botPersona.tempLabels.creative')}
                      </Text>
                    </InlineStack>
                  </BlockStack>

                  <Divider />

                  {/* Welcome Template */}
                  <BlockStack gap="200">
                    <Banner tone="info">
                      <p>
                        Welcome messaging follows the 24-hour WhatsApp rule. If the customer already has an open conversation window, Recete sends the rendered welcome text below as a normal message. If the window is closed and Twilio is the sender, Recete uses a platform-managed approved WhatsApp template and injects the rendered message automatically.
                      </p>
                    </Banner>
                    <TextField
                      label={t('botPersona.welcomeTemplateLabel')}
                      value={whatsappWelcomeTemplate}
                      onChange={(value) => {
                        setWhatsappWelcomeTemplate(value);
                        setIsDirty(true);
                      }}
                      placeholder={t('botPersona.welcomeTemplatePlaceholder')}
                      multiline={6}
                      autoComplete="off"
                    />
                    <Text as="p" tone="subdued">
                      Build the welcome message once. Recete fills in customer and order details automatically.
                    </Text>
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" fontWeight="medium">
                        Insert order variables
                      </Text>
                      <InlineStack gap="200" wrap>
                        {WELCOME_TEMPLATE_TOKENS.map((item) => (
                          <PolarisButton
                            key={item.token}
                            onClick={() => {
                              setWhatsappWelcomeTemplate((current) =>
                                appendWelcomeTemplateToken(current, item.token)
                              );
                              setIsDirty(true);
                            }}
                          >
                            {item.label}
                          </PolarisButton>
                        ))}
                      </InlineStack>
                      <BlockStack gap="100">
                        {WELCOME_TEMPLATE_TOKENS.map((item) => (
                          <Text key={item.token} as="p" variant="bodySm" tone="subdued">
                            <strong>{item.token}</strong> {item.help}
                          </Text>
                        ))}
                      </BlockStack>
                    </BlockStack>
                    <Box
                      padding="300"
                      borderWidth="025"
                      borderColor="border"
                      borderRadius="300"
                      background="bg-surface-secondary"
                    >
                      <BlockStack gap="150">
                        <Text as="p" variant="bodySm" fontWeight="medium">
                          Preview
                        </Text>
                        <Text as="p" variant="bodySm">
                          {welcomeTemplatePreview}
                        </Text>
                      </BlockStack>
                    </Box>
                    <Box
                      padding="300"
                      borderWidth="025"
                      borderColor="border"
                      borderRadius="300"
                      background="bg-surface-secondary"
                    >
                      <BlockStack gap="150">
                        <Text as="p" variant="bodySm" fontWeight="medium">
                          {t('botPersona.welcomeTemplatePlaceholdersTitle')}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {t('botPersona.welcomeTemplatePlaceholderOrder')}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {t('botPersona.welcomeTemplatePlaceholderProducts')}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Additional placeholders: {'{{customer_first_name}}'}, {'{{product_count}}'}, {'{{bot_name}}'}
                        </Text>
                      </BlockStack>
                    </Box>
                  </BlockStack>

                  <Box paddingBlockStart="300" borderBlockStartWidth="025" borderColor="border">
                    <BlockStack gap="300">
                      <InlineError message={saveError} onDismiss={() => setSaveError(null)} />

                      <ShopifySaveBar
                        id="settings-persona-csb"
                        isDirty={isDirty}
                        onSave={handleSavePersona}
                        onDiscard={() => {
                          setIsDirty(false);
                          setSaveError(null);
                          loadData();
                        }}
                      />

                      {!isShopifyEmbedded() && (
                        <InlineStack>
                          <PolarisButton
                            onClick={handleSavePersona}
                            disabled={saving}
                            loading={saving}
                            variant="primary"
                          >
                            {saving ? t('botPersona.saving') : t('botPersona.saveButton')}
                          </PolarisButton>
                        </InlineStack>
                      )}
                    </BlockStack>
                  </Box>
                </BlockStack>
              </Box>
            </PolarisCard>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
