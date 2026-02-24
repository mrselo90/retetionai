'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Banner, BlockStack, Box, Card as PolarisCard, Checkbox, ChoiceList, Divider, InlineStack, Layout, Page, RangeSlider, SkeletonPage, Text, TextField } from '@shopify/polaris';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Settings, Bot, Shield, Database, Loader2, Plus, Trash2, Pencil, X, Download, AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react';
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
  };
  created_at: string;
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
  const [notificationPhone, setNotificationPhone] = useState('');

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
      <Card id="modules" hover className="scroll-mt-4 overflow-hidden shadow-lg">
        <CardHeader className="bg-gradient-to-r from-warning/5 to-transparent">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-warning to-warning/80 text-warning-foreground shadow-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl">Modules</CardTitle>
              <p className="text-sm text-muted-foreground mt-1.5 font-medium">
                Optional paid modules to enhance your AI capabilities
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
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
                    <Badge variant={addon.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {addon.status === 'active' ? rp('statusActive') : rp('statusInactive')}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-600 mt-1">{rp('moduleDescription')}</p>
                  <p className="text-sm font-semibold text-primary mt-1.5">
                    +${addon.priceMonthly}/month
                  </p>
                </div>
                <button
                  onClick={() => handleAddonToggle(addon.key, addon.status)}
                  disabled={!addon.planAllowed}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-200 shadow-inner ${addon.status === 'active' ? 'bg-primary' : 'bg-zinc-300'}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${addon.status === 'active' ? 'translate-x-8' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            </PlanGatedFeature>
          ))}

          {addons.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No modules available</p>
          )}
        </CardContent>
      </Card>

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
          <DialogFooter className="gap-3 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowAddonConfirm(null)}
              className="flex-1 sm:flex-none"
            >
              {rp('cancel')}
            </Button>
            <Button
              onClick={handleAddonConfirm}
              variant={addonAction === 'enable' ? 'default' : 'destructive'}
              className="flex-1 sm:flex-none"
            >
              {addonAction === 'enable' ? rp('enableConfirmButton') : rp('disableConfirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guardrails */}
      <Card id="guardrails" hover className="scroll-mt-4 overflow-hidden shadow-lg">
        <CardHeader className="bg-gradient-to-r from-success/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-success to-success/80 text-success-foreground shadow-lg">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-2xl">{t('guardrails.title')}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1.5 font-medium">
                  {t('guardrails.description')}
                </p>
              </div>
            </div>
            <Button onClick={openAddGuardrail} size="lg" variant="success" className="shadow-lg">
              <Plus className="w-5 h-5 mr-2" />
              {t('guardrails.addButton')}
            </Button>
          </div>
        </CardHeader>
        <div className="p-6 space-y-6">
          {/* System guardrails (read-only) */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-700 mb-2">{t('guardrails.systemTitle')}</h3>
            <ul className="space-y-3">
              {systemGuardrails.map((g) => (
                <li
                  key={g.id}
                  className="flex items-start gap-3 p-4 rounded-lg border border-zinc-200 bg-zinc-50/80"
                >
                  <span className="text-zinc-500 mt-0.5" title={t('guardrails.locked')}>🔒</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900">{locale === 'tr' ? (g.name_tr ?? g.name) : g.name}</p>
                    <p className="text-sm text-zinc-600 mt-1">{locale === 'tr' ? (g.description_tr ?? g.description) : g.description}</p>
                    <p className="text-xs text-zinc-500 mt-2">
                      {t('guardrails.application', {
                        type: g.apply_to === 'both' ? t('guardrails.types.both') : g.apply_to === 'user_message' ? t('guardrails.types.user_message') : t('guardrails.types.ai_response'),
                        action: g.action === 'escalate' ? t('guardrails.actions.escalate') : t('guardrails.actions.block')
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {/* Custom guardrails */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-700 mb-2">{t('guardrails.customTitle')}</h3>
            {customGuardrails.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4">{t('guardrails.empty')}</p>
            ) : (
              <ul className="space-y-3">
                {customGuardrails.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center gap-3 p-4 rounded-lg border border-zinc-200 bg-white"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900">{g.name}</p>
                      {g.description && (
                        <p className="text-sm text-zinc-600 mt-0.5">{g.description}</p>
                      )}
                      <p className="text-xs text-zinc-500 mt-2">
                        {g.match_type === 'keywords'
                          ? `${t('guardrails.modal.matchTypes.keywords')}: ${Array.isArray(g.value) ? g.value.join(', ') : g.value}`
                          : `${t('guardrails.modal.matchTypes.phrase')}: ${typeof g.value === 'string' ? g.value : (Array.isArray(g.value) ? g.value[0] : '')}`}
                        {' · '}
                        {t('guardrails.application', {
                          type: g.apply_to === 'both' ? t('guardrails.types.both') : g.apply_to === 'user_message' ? t('guardrails.types.user_message') : t('guardrails.types.ai_response'),
                          action: g.action === 'escalate' ? t('guardrails.actions.escalate') : t('guardrails.actions.block')
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditGuardrail(g)}
                        className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                      >
                        {t('guardrails.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGuardrail(g.id)}
                        disabled={savingGuardrails}
                        className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                      >
                        {t('guardrails.delete')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>


      {/* GDPR & Data Management */}
      <Card hover className="overflow-hidden shadow-lg">
        <CardHeader className="bg-gradient-to-r from-info/5 to-transparent">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-info to-info/80 text-info-foreground shadow-lg">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl">{t('gdpr.title')}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1.5 font-medium">
                {t('gdpr.description')}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data Export */}
          <div className="p-4 border border-border rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium mb-1">{t('gdpr.exportTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('gdpr.exportDesc')}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleExportData}
                disabled={exportingData}
                className="ml-4"
              >
                {exportingData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {exportingData ? t('gdpr.exporting') : t('gdpr.exportButton')}
              </Button>
            </div>
          </div>

          {/* Data Deletion */}
          <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-destructive mb-1">{t('gdpr.deleteTitle')}</h3>
                <p className="text-sm text-destructive/80">
                  {t('gdpr.deleteDesc')}
                </p>
                <p className="text-xs text-destructive/70 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {t('gdpr.deleteWarning')}
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deletingData}
                className="ml-4"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('gdpr.deleteButton')}
              </Button>
            </div>
          </div>

          {/* Links */}
          <div className="pt-4 border-t">
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
          </div>
        </CardContent>
      </Card>

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
          <div className="space-y-4 pt-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('guardrails.modal.nameLabel')}</label>
              <input
                type="text"
                value={guardrailName}
                onChange={(e) => setGuardrailName(e.target.value)}
                placeholder="e.g. Competitor mention"
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('guardrails.modal.descLabel')}</label>
              <input
                type="text"
                value={guardrailDescription}
                onChange={(e) => setGuardrailDescription(e.target.value)}
                placeholder="Brief description of the rule"
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('guardrails.modal.applyToLabel')}</label>
              <select
                value={guardrailApplyTo}
                onChange={(e) => setGuardrailApplyTo(e.target.value as 'user_message' | 'ai_response' | 'both')}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="both">{t('guardrails.types.both')}</option>
                <option value="user_message">{t('guardrails.types.user_message')}</option>
                <option value="ai_response">{t('guardrails.types.ai_response')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('guardrails.modal.matchTypeLabel')}</label>
              <select
                value={guardrailMatchType}
                onChange={(e) => setGuardrailMatchType(e.target.value as 'keywords' | 'phrase')}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="keywords">{t('guardrails.modal.matchTypes.keywords')}</option>
                <option value="phrase">{t('guardrails.modal.matchTypes.phrase')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                {t('guardrails.modal.valueLabel')}
              </label>
              <input
                type="text"
                value={guardrailValue}
                onChange={(e) => setGuardrailValue(e.target.value)}
                placeholder={guardrailMatchType === 'keywords' ? 'competitor, price, discount' : 'This product cures'}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('guardrails.modal.actionLabel')}</label>
              <select
                value={guardrailAction}
                onChange={(e) => setGuardrailAction(e.target.value as 'block' | 'escalate')}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="block">{t('guardrails.actions.block')}</option>
                <option value="escalate">{t('guardrails.actions.escalate')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">{t('guardrails.modal.responseLabel')}</label>
              <textarea
                value={guardrailSuggestedResponse}
                onChange={(e) => setGuardrailSuggestedResponse(e.target.value)}
                placeholder="Text to show when rule is triggered"
                rows={2}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <DialogFooter className="gap-3 sm:gap-0">
              <Button
                variant="outline"
                onClick={closeGuardrailModal}
                disabled={savingGuardrails}
              >
                {t('guardrails.modal.cancel')}
              </Button>
              <Button
                onClick={handleSaveGuardrail}
                disabled={savingGuardrails}
              >
                {savingGuardrails && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {savingGuardrails ? t('guardrails.modal.saving') : (editingGuardrail ? t('guardrails.modal.save') : t('guardrails.modal.save'))}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => {
        if (!deletingData) setShowDeleteConfirm(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('gdpr.modal.title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive font-medium mb-2">
                {t('gdpr.modal.warning')}
              </p>
              <ul className="text-sm text-destructive/80 space-y-1 list-disc list-inside">
                <li>{t('gdpr.modal.list.all')}</li>
                <li>{t('gdpr.modal.list.permanent')}</li>
                <li>{t('gdpr.modal.list.cancel')}</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => handleDeleteData(false)}
                disabled={deletingData}
              >
                {deletingData && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {deletingData ? t('gdpr.modal.deleting') : t('gdpr.modal.softDelete')}
              </Button>
              <Button
                variant="destructive"
                className="w-full opacity-80"
                onClick={() => handleDeleteData(true)}
                disabled={deletingData}
              >
                {deletingData ? t('gdpr.modal.deleting') : t('gdpr.modal.hardDelete')}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingData}
              >
                {t('gdpr.modal.cancel')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
