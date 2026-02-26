'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Badge as PolarisBadge, Banner, BlockStack, Box, Button as PolarisButton, Card as PolarisCard, Checkbox, ChoiceList, Divider, InlineStack, Layout, Page, RangeSlider, Select, SkeletonPage, Text, TextField } from '@shopify/polaris';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Settings, Bot, Shield, Database, Loader2, Pencil, X, AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useTranslations, useLocale } from 'next-intl';
import { ShopifySaveBar } from '@/components/ui/ShopifySaveBar';
import { InlineError } from '@/components/ui/InlineError';
import { PlanGatedFeature } from '@/components/ui/PlanGatedFeature';
import { isShopifyEmbedded } from '@/lib/shopifyEmbedded';

export type ProductInstructionsScope = 'order_only' | 'rag_products_too';

/** Read-only system guardrail (shown in UI) */
interface SystemGuardrailDefinition {
  id: string;
  name: string;
  name_tr?: string;
  description: string;
  description_tr?: string;
  apply_to: 'user_message' | 'ai_response' | 'both';
  action: 'block' | 'escalate';
  editable: false;
}

/** Custom guardrail (editable by merchant) */
export interface CustomGuardrail {
  id: string;
  name: string;
  description?: string;
  apply_to: 'user_message' | 'ai_response' | 'both';
  match_type: 'keywords' | 'phrase';
  value: string[] | string;
  action: 'block' | 'escalate';
  suggested_response?: string;
}

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
    product_instructions_scope?: ProductInstructionsScope;
    whatsapp_sender_mode?: 'merchant_own' | 'corporate';
    whatsapp_welcome_template?: string;
  };
  created_at: string;
}

interface MultiLangRagSettings {
  shop_id: string;
  default_source_lang: string;
  enabled_langs: string[];
  multi_lang_rag_enabled: boolean;
}

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const rp = useTranslations('ReturnPrevention');
  const locale = useLocale();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form states
  const [merchantName, setMerchantName] = useState('');
  const [botName, setBotName] = useState('');
  const [tone, setTone] = useState<'friendly' | 'professional' | 'casual' | 'formal'>('friendly');
  const [emoji, setEmoji] = useState(true);
  const [responseLength, setResponseLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [temperature, setTemperature] = useState(0.7);
  const [productInstructionsScope, setProductInstructionsScope] = useState<ProductInstructionsScope>('order_only');
  const [whatsappSenderMode, setWhatsappSenderMode] = useState<'merchant_own' | 'corporate'>('merchant_own');
  const [whatsappWelcomeTemplate, setWhatsappWelcomeTemplate] = useState('');
  const [notificationPhone, setNotificationPhone] = useState('');
  const [multiLangRagSettings, setMultiLangRagSettings] = useState<MultiLangRagSettings | null>(null);
  const [multiLangRagSaving, setMultiLangRagSaving] = useState(false);
  const [multiLangEnabledLangs, setMultiLangEnabledLangs] = useState<string[]>(['en']);
  const [multiLangDefaultSourceLang, setMultiLangDefaultSourceLang] = useState<string>('en');
  const [multiLangEnabled, setMultiLangEnabled] = useState(false);

  // Add-ons
  const [addons, setAddons] = useState<Array<{ key: string; name: string; description: string; priceMonthly: number; status: string; planAllowed: boolean }>>([]);
  const [showAddonConfirm, setShowAddonConfirm] = useState<string | null>(null);
  const [addonAction, setAddonAction] = useState<'enable' | 'disable'>('enable');

  // Guardrails
  const [systemGuardrails, setSystemGuardrails] = useState<SystemGuardrailDefinition[]>([]);
  const [customGuardrails, setCustomGuardrails] = useState<CustomGuardrail[]>([]);
  const [savingGuardrails, setSavingGuardrails] = useState(false);
  const [showGuardrailModal, setShowGuardrailModal] = useState(false);
  const [editingGuardrail, setEditingGuardrail] = useState<CustomGuardrail | null>(null);
  const [guardrailName, setGuardrailName] = useState('');
  const [guardrailDescription, setGuardrailDescription] = useState('');
  const [guardrailApplyTo, setGuardrailApplyTo] = useState<'user_message' | 'ai_response' | 'both'>('both');
  const [guardrailMatchType, setGuardrailMatchType] = useState<'keywords' | 'phrase'>('keywords');
  const [guardrailValue, setGuardrailValue] = useState('');
  const [guardrailAction, setGuardrailAction] = useState<'block' | 'escalate'>('block');
  const [guardrailSuggestedResponse, setGuardrailSuggestedResponse] = useState('');
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const merchantResponse = await authenticatedRequest<{ merchant: Merchant }>(
        '/api/merchants/me',
        session.access_token
      );
      setMerchant(merchantResponse.merchant);
      setMerchantName(merchantResponse.merchant.name);

      const persona = merchantResponse.merchant.persona_settings || {};
      setBotName(persona.bot_name || t('botPersona.namePlaceholder'));
      setTone(persona.tone || 'friendly');
      setEmoji(persona.emoji !== false);
      setResponseLength(persona.response_length || 'medium');
      setTemperature(persona.temperature || 0.7);
      setProductInstructionsScope(
        persona.product_instructions_scope === 'rag_products_too' ? 'rag_products_too' : 'order_only'
      );
      setWhatsappSenderMode(
        persona.whatsapp_sender_mode === 'corporate' ? 'corporate' : 'merchant_own'
      );
      setWhatsappWelcomeTemplate(typeof persona.whatsapp_welcome_template === 'string' ? persona.whatsapp_welcome_template : '');
      setNotificationPhone(merchantResponse.merchant.notification_phone || '');

      try {
        const guardrailsResponse = await authenticatedRequest<{
          system_guardrails: SystemGuardrailDefinition[];
          custom_guardrails: CustomGuardrail[];
        }>('/api/merchants/me/guardrails', session.access_token);
        setSystemGuardrails(guardrailsResponse.system_guardrails ?? []);
        setCustomGuardrails(guardrailsResponse.custom_guardrails ?? []);
      } catch (guardrailsErr: any) {
        console.warn('Guardrails load failed (migration 008 may not be run):', guardrailsErr);
        setSystemGuardrails([]);
        setCustomGuardrails([]);
        toast.error(t('toasts.saveError.title'), t('toasts.saveError.message'));
      }

      try {
        const addonsResponse = await authenticatedRequest<{ addons: any[] }>(
          '/api/billing/addons',
          session.access_token
        );
        setAddons(addonsResponse.addons || []);
      } catch {
        console.warn('Addons load failed (migration 011 may not be run)');
        setAddons([]);
      }

      try {
        const multiLangResponse = await authenticatedRequest<{ settings: MultiLangRagSettings }>(
          '/api/merchants/me/multi-lang-rag-settings',
          session.access_token
        );
        setMultiLangRagSettings(multiLangResponse.settings);
        setMultiLangEnabledLangs(Array.isArray(multiLangResponse.settings.enabled_langs) && multiLangResponse.settings.enabled_langs.length
          ? multiLangResponse.settings.enabled_langs
          : [multiLangResponse.settings.default_source_lang || 'en']);
        setMultiLangDefaultSourceLang(multiLangResponse.settings.default_source_lang || 'en');
        setMultiLangEnabled(Boolean(multiLangResponse.settings.multi_lang_rag_enabled));
      } catch (e) {
        console.warn('Multi-language RAG settings load failed (migration 019 may not be run):', e);
        setMultiLangRagSettings(null);
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      if (err.status === 401) {
        window.location.href = '/login';
      } else {
        toast.error(t('toasts.saveError.title'), t('toasts.saveError.message'));
      }
    } finally {
      setLoading(false);
    }
  };

  const allLangOptions = [
    { value: 'en', label: 'English' },
    { value: 'tr', label: 'Turkish' },
    { value: 'hu', label: 'Hungarian' },
    { value: 'de', label: 'German' },
    { value: 'el', label: 'Greek' },
  ] as const;

  const handleSaveMultiLangRagSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setMultiLangRagSaving(true);
      const enabled = [...new Set([multiLangDefaultSourceLang, ...multiLangEnabledLangs])];
      const response = await authenticatedRequest<{ settings: MultiLangRagSettings }>(
        '/api/merchants/me/multi-lang-rag-settings',
        session.access_token,
        {
          method: 'PUT',
          body: JSON.stringify({
            default_source_lang: multiLangDefaultSourceLang,
            enabled_langs: enabled,
            multi_lang_rag_enabled: multiLangEnabled,
          }),
        }
      );
      setMultiLangRagSettings(response.settings);
      setMultiLangEnabledLangs(response.settings.enabled_langs);
      setMultiLangDefaultSourceLang(response.settings.default_source_lang);
      setMultiLangEnabled(Boolean(response.settings.multi_lang_rag_enabled));
      toast.success('Multi-language RAG settings saved', 'New settings will apply to shadow write/read immediately via feature flags.');
    } catch (err: any) {
      console.error('Failed to save multi-language RAG settings:', err);
      toast.error('Failed to save multi-language RAG settings', err.message || 'Unknown error');
    } finally {
      setMultiLangRagSaving(false);
    }
  };

  const handleSavePersona = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setSaving(true);

      await authenticatedRequest(
        '/api/merchants/me',
        session.access_token,
        {
          method: 'PUT',
          body: JSON.stringify({
            notification_phone: notificationPhone,
            persona_settings: {
              bot_name: botName,
              tone,
              emoji,
              response_length: responseLength,
              temperature,
              product_instructions_scope: productInstructionsScope,
              whatsapp_sender_mode: whatsappSenderMode,
              whatsapp_welcome_template: whatsappWelcomeTemplate.trim() || undefined,
            },
          }),
        }
      );

      toast.success(t('toasts.saveSuccess.title'), t('toasts.saveSuccess.message'));
      setSaveError(null);
      setIsDirty(false);
      await loadData();
    } catch (err: any) {
      console.error('Failed to save persona:', err);
      setSaveError(err.message || t('toasts.saveError.message'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddonToggle = async (addonKey: string, currentStatus: string) => {
    if (currentStatus === 'active') {
      setAddonAction('disable');
      setShowAddonConfirm(addonKey);
    } else {
      setAddonAction('enable');
      setShowAddonConfirm(addonKey);
    }
  };

  const handleAddonConfirm = async () => {
    const addonKey = showAddonConfirm;
    if (!addonKey) return;
    setShowAddonConfirm(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (addonAction === 'enable') {
        const response = await authenticatedRequest<{ confirmationUrl?: string }>(
          `/api/billing/addons/${addonKey}/subscribe`,
          session.access_token,
          { method: 'POST' }
        );
        if (response.confirmationUrl) {
          window.location.href = response.confirmationUrl;
          return;
        }
        // If no confirmation URL (e.g. manual billing), just reload
        await loadData();
      } else {
        await authenticatedRequest(
          `/api/billing/addons/${addonKey}/cancel`,
          session.access_token,
          { method: 'POST' }
        );
        await loadData();
      }
    } catch (err: any) {
      console.error('Addon action failed:', err);
      toast.error(t('toasts.saveError.title'), err.message || t('toasts.saveError.message'));
    }
  };

  const openAddGuardrail = () => {
    setEditingGuardrail(null);
    setGuardrailName('');
    setGuardrailDescription('');
    setGuardrailApplyTo('both');
    setGuardrailMatchType('keywords');
    setGuardrailValue('');
    setGuardrailAction('block');
    setGuardrailSuggestedResponse('');
    setShowGuardrailModal(true);
  };

  const openEditGuardrail = (g: CustomGuardrail) => {
    setEditingGuardrail(g);
    setGuardrailName(g.name);
    setGuardrailDescription(g.description ?? '');
    setGuardrailApplyTo(g.apply_to);
    setGuardrailMatchType(g.match_type);
    setGuardrailValue(Array.isArray(g.value) ? g.value.join(', ') : (g.value ?? ''));
    setGuardrailAction(g.action);
    setGuardrailSuggestedResponse(g.suggested_response ?? '');
    setShowGuardrailModal(true);
  };

  const closeGuardrailModal = () => {
    setShowGuardrailModal(false);
    setEditingGuardrail(null);
  };

  const handleSaveGuardrail = async () => {
    const name = guardrailName.trim();
    if (!name) {
      toast.error(t('toasts.guardrailError.title'), t('guardrails.modal.nameLabel'));
      return;
    }
    const valueStr = guardrailValue.trim();
    if (!valueStr) {
      toast.error(t('toasts.guardrailError.title'), t('guardrails.modal.valueLabel'));
      return;
    }
    const value: string[] | string =
      guardrailMatchType === 'phrase'
        ? valueStr
        : valueStr.split(',').map((s) => s.trim()).filter(Boolean);
    if (guardrailMatchType === 'keywords' && Array.isArray(value) && value.length === 0) {
      toast.error(t('toasts.guardrailError.title'), t('guardrails.modal.valueLabel'));
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setSavingGuardrails(true);
      const id = editingGuardrail?.id ?? `custom-${Date.now()}`;
      const next: CustomGuardrail[] = editingGuardrail
        ? customGuardrails.map((g) =>
          g.id === editingGuardrail.id
            ? {
              id,
              name,
              description: guardrailDescription.trim() || undefined,
              apply_to: guardrailApplyTo,
              match_type: guardrailMatchType,
              value,
              action: guardrailAction,
              suggested_response: guardrailSuggestedResponse.trim() || undefined,
            }
            : g
        )
        : [
          ...customGuardrails,
          {
            id,
            name,
            description: guardrailDescription.trim() || undefined,
            apply_to: guardrailApplyTo,
            match_type: guardrailMatchType,
            value,
            action: guardrailAction,
            suggested_response: guardrailSuggestedResponse.trim() || undefined,
          },
        ];
      await authenticatedRequest('/api/merchants/me/guardrails', session.access_token, {
        method: 'PUT',
        body: JSON.stringify({ custom_guardrails: next }),
      });
      setCustomGuardrails(next);
      toast.success(t('toasts.guardrailSuccess.title'), t('toasts.guardrailSuccess.message'));
      closeGuardrailModal();
    } catch (err: any) {
      toast.error(t('toasts.guardrailError.title'), err.message || t('toasts.guardrailError.message'));
    } finally {
      setSavingGuardrails(false);
    }
  };

  const handleDeleteGuardrail = async (id: string) => {
    if (!confirm(t('guardrails.delete'))) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setSavingGuardrails(true);
      const next = customGuardrails.filter((g) => g.id !== id);
      await authenticatedRequest('/api/merchants/me/guardrails', session.access_token, {
        method: 'PUT',
        body: JSON.stringify({ custom_guardrails: next }),
      });
      setCustomGuardrails(next);
      toast.success(t('toasts.guardrailSuccess.title'), t('toasts.guardrailSuccess.message'));
    } catch (err: any) {
      toast.error(t('toasts.guardrailError.title'), err.message || t('toasts.guardrailError.message'));
    } finally {
      setSavingGuardrails(false);
    }
  };

  const handleExportData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setExportingData(true);
      const response = await authenticatedRequest<{ data: any; exported_at: string }>(
        '/api/gdpr/export',
        session.access_token,
        {
          method: 'GET',
        }
      );

      // Download as JSON file
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recete-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t('toasts.exportSuccess.title'), t('toasts.exportSuccess.message'));
    } catch (err: any) {
      console.error('Failed to export data:', err);
      toast.error(t('toasts.saveError.title'), err.message || t('toasts.saveError.message'));
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteData = async (permanent: boolean = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setDeletingData(true);
      const response = await authenticatedRequest<{ message: string; permanent_deletion_at?: string }>(
        '/api/gdpr/delete',
        session.access_token,
        {
          method: 'DELETE',
          body: JSON.stringify({ confirm: true, permanent }),
        }
      );

      if (permanent) {
        toast.warning(t('toasts.deletePermanent.title'), t('toasts.deletePermanent.message'));
        // Redirect to home after 2 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        toast.error(
          t('toasts.deleteScheduled.title'),
          t('toasts.deleteScheduled.message', { date: new Date(response.permanent_deletion_at || '').toLocaleDateString() })
        );
      }
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error('Failed to delete data:', err);
      toast.error(t('toasts.saveError.title'), err.message || t('toasts.saveError.message'));
    } finally {
      setDeletingData(false);
    }
  };

  if (loading) {
    return (
      <SkeletonPage title={t('title')}>
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <PolarisCard><Box padding="400"><div className="h-20 bg-zinc-100 rounded-lg animate-pulse" /></Box></PolarisCard>
              <PolarisCard><Box padding="400"><div className="h-80 bg-zinc-100 rounded-lg animate-pulse" /></Box></PolarisCard>
              <PolarisCard><Box padding="400"><div className="h-64 bg-zinc-100 rounded-lg animate-pulse" /></Box></PolarisCard>
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
      {/* Header */}
      <PolarisCard>
        <Box padding="400">
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">{t('title')}</Text>
              <Text as="p" tone="subdued">{t('description')}</Text>
            </BlockStack>
            <Banner tone="info">
              <p>
                <a href="#guardrails" className="text-primary hover:text-primary/80 font-semibold transition-colors">
                  {t('guardrailsLink')}
                </a>
              </p>
            </Banner>
          </BlockStack>
        </Box>
      </PolarisCard>

      {/* ── Notification Settings ──────────────────────────── */}
      <PolarisCard>
        <Box padding="400">
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="start">
              <Box background="bg-fill-warning" borderRadius="300" padding="300">
                <AlertTriangle className="w-5 h-5 text-white" />
              </Box>
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">{t('notifications.title')}</Text>
                <Text as="p" tone="subdued">{t('notifications.description')}</Text>
              </BlockStack>
            </InlineStack>
            <TextField
              label={t('notifications.phoneLabel')}
              type="tel"
              value={notificationPhone}
              onChange={(value) => { setNotificationPhone(value); setIsDirty(true); }}
              placeholder={t('notifications.phonePlaceholder')}
              autoComplete="off"
              helpText={t('notifications.phoneHint')}
            />
          </BlockStack>
        </Box>
      </PolarisCard>

      {/* Multi-language RAG (Option A: lang-specific retrieval + fallback) */}
      <PolarisCard>
        <Box padding="400">
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="start">
              <Box background="bg-fill-brand" borderRadius="300" padding="300">
                <Settings className="w-5 h-5 text-white" />
              </Box>
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">Multi-language RAG (Option A)</Text>
                <Text as="p" tone="subdued">
                  Configure source language, enabled target languages and per-shop rollout. Works with feature flags and shadow write/read.
                </Text>
              </BlockStack>
            </InlineStack>

            <Select
              label="Default source language"
              value={multiLangDefaultSourceLang}
              options={allLangOptions.map((o) => ({ value: o.value, label: o.label }))}
              onChange={(value) => {
                setMultiLangDefaultSourceLang(value);
                if (!multiLangEnabledLangs.includes(value)) {
                  setMultiLangEnabledLangs((prev) => [...new Set([value, ...prev])]);
                }
              }}
            />

            <ChoiceList
              title="Enabled languages (translations + per-lang embeddings)"
              allowMultiple
              choices={allLangOptions.map((o) => ({ value: o.value, label: o.label }))}
              selected={multiLangEnabledLangs}
              onChange={(selected) => {
                const next = [...new Set(selected)];
                if (!next.includes(multiLangDefaultSourceLang)) next.unshift(multiLangDefaultSourceLang);
                setMultiLangEnabledLangs(next);
              }}
            />

            <Checkbox
              label="Enable multi-language RAG for this shop"
              helpText="Safe rollout: global env flags still control shadow write/read and final answer path."
              checked={multiLangEnabled}
              onChange={setMultiLangEnabled}
            />

            <Box padding="300" borderWidth="025" borderColor="border" borderRadius="300" background="bg-surface-secondary">
              <BlockStack gap="100">
                <Text as="p" variant="bodySm">
                  <strong>Current state:</strong>{' '}
                  {multiLangRagSettings ? 'Configured' : 'Not available yet (migration 019 may not be applied)'}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Shadow write creates `product_i18n` + `product_embeddings`. Shadow read runs retrieval in parallel for logs. Final answers use the new flow only when both shop toggle and env flag are enabled.
                </Text>
              </BlockStack>
            </Box>

            <InlineStack align="end">
              <PolarisButton
                variant="primary"
                onClick={handleSaveMultiLangRagSettings}
                loading={multiLangRagSaving}
                disabled={multiLangRagSaving}
              >
                Save multi-language RAG settings
              </PolarisButton>
            </InlineStack>
          </BlockStack>
        </Box>
      </PolarisCard>

      {/* Bot Persona Settings */}
      <Card hover className="overflow-hidden shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl">{t('botPersona.title')}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1.5 font-medium">
                {t('botPersona.description')}{' '}
                <Link href="/dashboard/settings/bot-info" className="text-primary hover:text-primary/80 font-bold transition-colors">
                  {t('botPersona.botInfoLink')}
                </Link>
              </p>
            </div>
          </div>
        </CardHeader>

        <div className="p-6 space-y-6">
          {/* Bot Name */}
          <TextField
            label={t('botPersona.nameLabel')}
            type="text"
            value={botName}
            onChange={(value) => { setBotName(value); setIsDirty(true); }}
            placeholder={t('botPersona.namePlaceholder')}
            autoComplete="off"
          />

          {/* Tone */}
          <ChoiceList
            title={t('botPersona.toneLabel')}
            choices={(['friendly', 'professional', 'casual', 'formal'] as const).map((tKey) => ({
              label: t(`botPersona.tones.${tKey}`),
              value: tKey,
            }))}
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
            onChange={(checked) => { setEmoji(checked); setIsDirty(true); }}
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
              onChange={(value) => { setTemperature(Number(value)); setIsDirty(true); }}
            />
            <InlineStack align="space-between">
              <Text as="span" variant="bodySm" tone="subdued">{t('botPersona.tempLabels.consistent')}</Text>
              <Text as="span" variant="bodySm" tone="subdued">{t('botPersona.tempLabels.balanced')}</Text>
              <Text as="span" variant="bodySm" tone="subdued">{t('botPersona.tempLabels.creative')}</Text>
            </InlineStack>
          </BlockStack>

          {/* Product instructions scope (WhatsApp answers) — one must be chosen */}
          <Divider />
          <BlockStack gap="200">
            <ChoiceList
              title={t('botPersona.productScopeLabel')}
              choices={[
                { label: t('botPersona.productScopes.orderOnly.label'), value: 'order_only' },
                { label: t('botPersona.productScopes.ragProductsToo.label'), value: 'rag_products_too' },
              ]}
              selected={[productInstructionsScope]}
              onChange={(selected) => {
                const next = selected[0] as ProductInstructionsScope | undefined;
                if (next) {
                  setProductInstructionsScope(next);
                  setIsDirty(true);
                }
              }}
            />
            <Text as="p" tone="subdued">{t('botPersona.productScopeDesc')}</Text>
            <Box padding="300" borderWidth="025" borderColor="border" borderRadius="300" background="bg-surface-secondary">
              <BlockStack gap="200">
                <Text as="p" variant="bodySm"><strong>{t('botPersona.productScopes.orderOnly.label')}</strong></Text>
                <Text as="p" variant="bodySm" tone="subdued">{t('botPersona.productScopes.orderOnly.desc')}</Text>
                <Text as="p" variant="bodySm"><strong>{t('botPersona.productScopes.ragProductsToo.label')}</strong></Text>
                <Text as="p" variant="bodySm" tone="subdued">{t('botPersona.productScopes.ragProductsToo.desc')}</Text>
              </BlockStack>
            </Box>
          </BlockStack>

          {/* WhatsApp sender: merchant's number vs corporate number — one must be chosen */}
          <Divider />
          <BlockStack gap="200">
            <ChoiceList
              title={t('botPersona.whatsappSenderLabel')}
              choices={[
                { label: t('botPersona.whatsappSenders.merchantOwn.label'), value: 'merchant_own' },
                { label: t('botPersona.whatsappSenders.corporate.label'), value: 'corporate' },
              ]}
              selected={[whatsappSenderMode]}
              onChange={(selected) => {
                const next = selected[0] as typeof whatsappSenderMode | undefined;
                if (next) {
                  setWhatsappSenderMode(next);
                  setIsDirty(true);
                }
              }}
            />
            <Text as="p" tone="subdued">{t('botPersona.whatsappSenderDesc')}</Text>
            <Box padding="300" borderWidth="025" borderColor="border" borderRadius="300" background="bg-surface-secondary">
              <BlockStack gap="200">
                <Text as="p" variant="bodySm"><strong>{t('botPersona.whatsappSenders.merchantOwn.label')}</strong></Text>
                <Text as="p" variant="bodySm" tone="subdued">{t('botPersona.whatsappSenders.merchantOwn.desc')}</Text>
                <Text as="p" variant="bodySm"><strong>{t('botPersona.whatsappSenders.corporate.label')}</strong></Text>
                <Text as="p" variant="bodySm" tone="subdued">{t('botPersona.whatsappSenders.corporate.desc')}</Text>
              </BlockStack>
            </Box>
            <Banner tone="info">
              <p>
                <strong>{t('botPersona.whatsappHelpTitle')}</strong> {t('botPersona.whatsappHelpText')}
              </p>
            </Banner>
          </BlockStack>

          <Divider />
          <BlockStack gap="200">
            <TextField
              label={t('botPersona.welcomeTemplateLabel')}
              value={whatsappWelcomeTemplate}
              onChange={(value) => { setWhatsappWelcomeTemplate(value); setIsDirty(true); }}
              placeholder={t('botPersona.welcomeTemplatePlaceholder')}
              multiline={6}
              autoComplete="off"
            />
            <Text as="p" tone="subdued">{t('botPersona.welcomeTemplateDesc')}</Text>
            <Box padding="300" borderWidth="025" borderColor="border" borderRadius="300" background="bg-surface-secondary">
              <BlockStack gap="150">
                <Text as="p" variant="bodySm" fontWeight="medium">{t('botPersona.welcomeTemplatePlaceholdersTitle')}</Text>
                <Text as="p" variant="bodySm" tone="subdued">{t('botPersona.welcomeTemplatePlaceholderOrder')}</Text>
                <Text as="p" variant="bodySm" tone="subdued">{t('botPersona.welcomeTemplatePlaceholderProducts')}</Text>
              </BlockStack>
            </Box>
          </BlockStack>

          {/* Save Button */}
          <div className="pt-6 border-t border-border">
            {/* G4: Persistent inline error (BFS 4.2.4) */}
            <InlineError message={saveError} onDismiss={() => setSaveError(null)} />

            {/* G3: Contextual Save Bar when embedded (BFS 4.1.5) */}
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

            {/* Inline Save Button — standalone mode only */}
            {!isShopifyEmbedded() && (
              <Button
                onClick={handleSavePersona}
                disabled={saving}
                size="lg"
                className="shadow-lg hover:shadow-xl"
              >
                {saving && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                {saving ? t('botPersona.saving') : t('botPersona.saveButton')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Add-on Modules */}
      <PolarisCard>
        <Box id="modules" padding="400">
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="start">
              <Box background="bg-fill-caution" borderRadius="300" padding="300">
                <ShieldCheck className="w-5 h-5 text-white" />
              </Box>
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">Modules</Text>
                <Text as="p" tone="subdued">
                  Optional paid modules to enhance your AI capabilities
                </Text>
              </BlockStack>
            </InlineStack>
          {addons.map((addon) => (
            <PlanGatedFeature
              key={addon.key}
              isLocked={!addon.planAllowed}
              requiredPlan="Pro"
            >
              <div
                className={`flex items-center justify-between p-5 rounded-xl border transition-all ${addon.status === 'active'
                  ? 'bg-gradient-to-r from-success/5 to-transparent border-success/30'
                  : 'bg-gradient-to-r from-muted/50 to-transparent border-border'
                  }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-zinc-900 text-base">{rp('moduleTitle')}</p>
                    <PolarisBadge tone={addon.status === 'active' ? 'success' : undefined}>
                      {addon.status === 'active' ? rp('statusActive') : rp('statusInactive')}
                    </PolarisBadge>
                  </div>
                  <p className="text-sm text-zinc-600 mt-1">{rp('moduleDescription')}</p>
                  <p className="text-sm font-semibold text-primary mt-1.5">
                    +${addon.priceMonthly}/month
                  </p>
                </div>
                <PolarisButton
                  onClick={() => handleAddonToggle(addon.key, addon.status)}
                  disabled={!addon.planAllowed}
                  variant={addon.status === 'active' ? 'secondary' : 'primary'}
                  size="slim"
                >
                  {addon.status === 'active' ? rp('disableConfirmButton') : rp('enableConfirmButton')}
                </PolarisButton>
              </div>
            </PlanGatedFeature>
          ))}

          {addons.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No modules available</p>
          )}
          </BlockStack>
        </Box>
      </PolarisCard>

      {/* Add-on confirmation dialog */}
      <Dialog open={!!showAddonConfirm} onOpenChange={(open) => !open && setShowAddonConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {addonAction === 'enable' ? rp('enableConfirmTitle') : rp('disableConfirmTitle')}
            </DialogTitle>
            <DialogDescription>
              {addonAction === 'enable' ? rp('enableConfirmMessage') : rp('disableConfirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:gap-3">
            <PolarisButton
              onClick={() => setShowAddonConfirm(null)}
              variant="secondary"
            >
              {rp('cancel')}
            </PolarisButton>
            <PolarisButton
              onClick={handleAddonConfirm}
              variant={addonAction === 'enable' ? 'primary' : undefined}
              tone={addonAction === 'enable' ? undefined : 'critical'}
            >
              {addonAction === 'enable' ? rp('enableConfirmButton') : rp('disableConfirmButton')}
            </PolarisButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guardrails */}
      <PolarisCard>
        <Box id="guardrails" padding="400">
          <BlockStack gap="500">
            <InlineStack align="space-between" blockAlign="start" gap="300">
              <InlineStack gap="300" blockAlign="start">
                <Box background="bg-fill-success" borderRadius="300" padding="300">
                  <Shield className="w-5 h-5 text-white" />
                </Box>
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">{t('guardrails.title')}</Text>
                  <Text as="p" tone="subdued">{t('guardrails.description')}</Text>
                </BlockStack>
              </InlineStack>
              <PolarisButton onClick={openAddGuardrail} variant="primary">
                {t('guardrails.addButton')}
              </PolarisButton>
            </InlineStack>
          {/* System guardrails (read-only) */}
          <div>
            <BlockStack gap="200">
            <Text as="h3" variant="headingSm">{t('guardrails.systemTitle')}</Text>
            <ul className="space-y-3">
              {systemGuardrails.map((g) => (
                <li
                  key={g.id}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/80"
                >
                  <Box padding="300">
                    <InlineStack gap="300" blockAlign="start">
                      <Text as="span" tone="subdued">🔒</Text>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="medium">
                          {locale === 'tr' ? (g.name_tr ?? g.name) : g.name}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {locale === 'tr' ? (g.description_tr ?? g.description) : g.description}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {t('guardrails.application', {
                            type: g.apply_to === 'both' ? t('guardrails.types.both') : g.apply_to === 'user_message' ? t('guardrails.types.user_message') : t('guardrails.types.ai_response'),
                            action: g.action === 'escalate' ? t('guardrails.actions.escalate') : t('guardrails.actions.block')
                          })}
                        </Text>
                      </BlockStack>
                    </InlineStack>
                  </Box>
                </li>
              ))}
            </ul>
            </BlockStack>
          </div>
          {/* Custom guardrails */}
          <div>
            <BlockStack gap="200">
            <Text as="h3" variant="headingSm">{t('guardrails.customTitle')}</Text>
            {customGuardrails.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4">{t('guardrails.empty')}</p>
            ) : (
              <ul className="space-y-3">
                {customGuardrails.map((g) => (
                  <li
                    key={g.id}
                    className="rounded-lg border border-zinc-200 bg-white"
                  >
                    <Box padding="300">
                      <InlineStack align="space-between" blockAlign="start" gap="300">
                        <BlockStack gap="100">
                          <Text as="p" variant="bodyMd" fontWeight="medium">{g.name}</Text>
                          {g.description && (
                            <Text as="p" variant="bodySm" tone="subdued">{g.description}</Text>
                          )}
                          <Text as="p" variant="bodySm" tone="subdued">
                            {g.match_type === 'keywords'
                              ? `${t('guardrails.modal.matchTypes.keywords')}: ${Array.isArray(g.value) ? g.value.join(', ') : g.value}`
                              : `${t('guardrails.modal.matchTypes.phrase')}: ${typeof g.value === 'string' ? g.value : (Array.isArray(g.value) ? g.value[0] : '')}`}
                            {' · '}
                            {t('guardrails.application', {
                              type: g.apply_to === 'both' ? t('guardrails.types.both') : g.apply_to === 'user_message' ? t('guardrails.types.user_message') : t('guardrails.types.ai_response'),
                              action: g.action === 'escalate' ? t('guardrails.actions.escalate') : t('guardrails.actions.block')
                            })}
                          </Text>
                        </BlockStack>
                        <InlineStack gap="200">
                          <PolarisButton
                            onClick={() => openEditGuardrail(g)}
                            variant="secondary"
                            size="slim"
                          >
                            {t('guardrails.edit')}
                          </PolarisButton>
                          <PolarisButton
                            onClick={() => handleDeleteGuardrail(g.id)}
                            disabled={savingGuardrails}
                            tone="critical"
                            size="slim"
                          >
                            {t('guardrails.delete')}
                          </PolarisButton>
                        </InlineStack>
                      </InlineStack>
                    </Box>
                  </li>
                ))}
              </ul>
            )}
            </BlockStack>
          </div>
          </BlockStack>
        </Box>
      </PolarisCard>


      {/* GDPR & Data Management */}
      <PolarisCard>
        <Box padding="400">
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="start">
              <Box background="bg-fill-info" borderRadius="300" padding="300">
                <Database className="w-5 h-5 text-white" />
              </Box>
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">{t('gdpr.title')}</Text>
                <Text as="p" tone="subdued">{t('gdpr.description')}</Text>
              </BlockStack>
            </InlineStack>
          {/* Data Export */}
          <Box padding="300" borderWidth="025" borderColor="border" borderRadius="300">
            <InlineStack align="space-between" blockAlign="start" gap="300">
              <BlockStack gap="100">
                <Text as="h3" variant="headingSm">{t('gdpr.exportTitle')}</Text>
                <Text as="p" tone="subdued">{t('gdpr.exportDesc')}</Text>
              </BlockStack>
              <PolarisButton
                variant="secondary"
                onClick={handleExportData}
                disabled={exportingData}
                loading={exportingData}
              >
                {exportingData ? t('gdpr.exporting') : t('gdpr.exportButton')}
              </PolarisButton>
            </InlineStack>
          </Box>

          {/* Data Deletion */}
          <Box padding="300" borderWidth="025" borderColor="border-critical" borderRadius="300" background="bg-surface-critical">
            <InlineStack align="space-between" blockAlign="start" gap="300">
              <BlockStack gap="100">
                <Text as="h3" variant="headingSm" tone="critical">{t('gdpr.deleteTitle')}</Text>
                <Text as="p" tone="critical">{t('gdpr.deleteDesc')}</Text>
                <InlineStack gap="100" blockAlign="center">
                  <AlertTriangle className="w-3 h-3 text-red-700" />
                  <Text as="span" variant="bodySm" tone="critical">{t('gdpr.deleteWarning')}</Text>
                </InlineStack>
              </BlockStack>
              <PolarisButton
                tone="critical"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deletingData}
              >
                {t('gdpr.deleteButton')}
              </PolarisButton>
            </InlineStack>
          </Box>

          {/* Links */}
          <Box paddingBlockStart="300" borderBlockStartWidth="025" borderColor="border">
            <div className="flex flex-wrap gap-4 text-sm">
              <a href="/privacy-policy" target="_blank" className="text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> {t('gdpr.links.privacy')}
              </a>
              <a href="/terms-of-service" target="_blank" className="text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> {t('gdpr.links.terms')}
              </a>
              <a href="/cookie-policy" target="_blank" className="text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> {t('gdpr.links.cookie')}
              </a>
            </div>
          </Box>
          </BlockStack>
        </Box>
      </PolarisCard>

      {/* Guardrail Add/Edit Modal */}
      <Dialog open={showGuardrailModal} onOpenChange={(open) => {
        if (!savingGuardrails) {
          if (!open) closeGuardrailModal();
          else setShowGuardrailModal(true);
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingGuardrail ? t('guardrails.modal.titleEdit') : t('guardrails.modal.titleAdd')}
            </DialogTitle>
          </DialogHeader>
          <BlockStack gap="400">
            <TextField
              label={t('guardrails.modal.nameLabel')}
              value={guardrailName}
              onChange={setGuardrailName}
              placeholder="e.g. Competitor mention"
              autoComplete="off"
            />
            <TextField
              label={t('guardrails.modal.descLabel')}
              value={guardrailDescription}
              onChange={setGuardrailDescription}
              placeholder="Brief description of the rule"
              autoComplete="off"
            />
            <Select
              label={t('guardrails.modal.applyToLabel')}
              options={[
                { label: t('guardrails.types.both'), value: 'both' },
                { label: t('guardrails.types.user_message'), value: 'user_message' },
                { label: t('guardrails.types.ai_response'), value: 'ai_response' },
              ]}
              value={guardrailApplyTo}
              onChange={(value) => setGuardrailApplyTo(value as 'user_message' | 'ai_response' | 'both')}
            />
            <Select
              label={t('guardrails.modal.matchTypeLabel')}
              options={[
                { label: t('guardrails.modal.matchTypes.keywords'), value: 'keywords' },
                { label: t('guardrails.modal.matchTypes.phrase'), value: 'phrase' },
              ]}
              value={guardrailMatchType}
              onChange={(value) => setGuardrailMatchType(value as 'keywords' | 'phrase')}
            />
            <TextField
              label={t('guardrails.modal.valueLabel')}
              value={guardrailValue}
              onChange={setGuardrailValue}
              placeholder={guardrailMatchType === 'keywords' ? 'competitor, price, discount' : 'This product cures'}
              autoComplete="off"
            />
            <Select
              label={t('guardrails.modal.actionLabel')}
              options={[
                { label: t('guardrails.actions.block'), value: 'block' },
                { label: t('guardrails.actions.escalate'), value: 'escalate' },
              ]}
              value={guardrailAction}
              onChange={(value) => setGuardrailAction(value as 'block' | 'escalate')}
            />
            <TextField
              label={t('guardrails.modal.responseLabel')}
              value={guardrailSuggestedResponse}
              onChange={setGuardrailSuggestedResponse}
              placeholder="Text to show when rule is triggered"
              multiline={2}
              autoComplete="off"
            />
            <DialogFooter className="gap-3 sm:gap-3">
              <PolarisButton
                variant="secondary"
                onClick={closeGuardrailModal}
                disabled={savingGuardrails}
              >
                {t('guardrails.modal.cancel')}
              </PolarisButton>
              <PolarisButton
                onClick={handleSaveGuardrail}
                disabled={savingGuardrails}
                loading={savingGuardrails}
                variant="primary"
              >
                {savingGuardrails ? t('guardrails.modal.saving') : (editingGuardrail ? t('guardrails.modal.save') : t('guardrails.modal.save'))}
              </PolarisButton>
            </DialogFooter>
          </BlockStack>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => {
        if (!deletingData) setShowDeleteConfirm(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <InlineStack gap="200" blockAlign="center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <Text as="span" variant="headingSm" tone="critical">{t('gdpr.modal.title')}</Text>
              </InlineStack>
            </DialogTitle>
          </DialogHeader>
          <Box paddingBlockStart="300">
            <BlockStack gap="400">
              <Box background="bg-surface-critical" borderColor="border-critical" borderWidth="025" borderRadius="300" padding="300">
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="medium" tone="critical">
                    {t('gdpr.modal.warning')}
                  </Text>
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="critical">• {t('gdpr.modal.list.all')}</Text>
                    <Text as="p" variant="bodySm" tone="critical">• {t('gdpr.modal.list.permanent')}</Text>
                    <Text as="p" variant="bodySm" tone="critical">• {t('gdpr.modal.list.cancel')}</Text>
                  </BlockStack>
                </BlockStack>
              </Box>

              <BlockStack gap="200">
                <PolarisButton
                  tone="critical"
                  fullWidth
                  onClick={() => handleDeleteData(false)}
                  disabled={deletingData}
                  loading={deletingData}
                >
                  {deletingData ? t('gdpr.modal.deleting') : t('gdpr.modal.softDelete')}
                </PolarisButton>
                <PolarisButton
                  tone="critical"
                  variant="secondary"
                  fullWidth
                  onClick={() => handleDeleteData(true)}
                  disabled={deletingData}
                >
                  {deletingData ? t('gdpr.modal.deleting') : t('gdpr.modal.hardDelete')}
                </PolarisButton>
                <PolarisButton
                  variant="secondary"
                  fullWidth
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deletingData}
                >
                  {t('gdpr.modal.cancel')}
                </PolarisButton>
              </BlockStack>
            </BlockStack>
          </Box>
        </DialogContent>
      </Dialog>

    </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
