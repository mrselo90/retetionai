'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Settings, Bot, Shield, Key, Database, Loader2, Plus, Copy, Trash2, Pencil, X, Download, AlertTriangle, ExternalLink } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

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

interface ApiKey {
  id: number;
  hash: string;
  name?: string;
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
  is_expired?: boolean;
  is_expiring_soon?: boolean;
  days_until_expiration?: number | null;
}

export default function SettingsPage() {
  const t = useTranslations('Settings');
  const locale = useLocale();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
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

      const keysResponse = await authenticatedRequest<{ apiKeys: ApiKey[]; count: number }>(
        '/api/merchants/me/api-keys',
        session.access_token
      );
      setApiKeys(keysResponse.apiKeys);

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
      await loadData();
    } catch (err: any) {
      console.error('Failed to save persona:', err);
      toast.error(t('toasts.saveError.title'), err.message || t('toasts.saveError.message'));
    } finally {
      setSaving(false);
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

  const handleCreateApiKey = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setCreatingKey(true);

      const response = await authenticatedRequest<{ apiKey: string }>(
        '/api/merchants/me/api-keys',
        session.access_token,
        {
          method: 'POST',
        }
      );

      setNewApiKey(response.apiKey);
      setShowNewKeyModal(true);
      await loadData();
    } catch (err: any) {
      console.error('Failed to create API key:', err);
      toast.error(t('toasts.saveError.title'), err.message || t('toasts.saveError.message'));
    } finally {
      setCreatingKey(false);
    }
  };

  const handleCopyApiKey = (keyHash: string) => {
    navigator.clipboard.writeText(keyHash);
    toast.success(t('toasts.copySuccess.title'), t('toasts.copySuccess.message'));
  };

  const handleRevokeApiKey = async (keyId: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await authenticatedRequest(
        `/api/merchants/me/api-keys/${keyId}`,
        session.access_token,
        {
          method: 'DELETE',
        }
      );

      toast.success(t('toasts.apiKeyRevokeSuccess.title'), t('toasts.apiKeyRevokeSuccess.message'));
      await loadData();
    } catch (err: any) {
      console.error('Failed to revoke API key:', err);
      toast.error(t('toasts.saveError.title'), err.message || t('toasts.saveError.message'));
    }
  };

  const copyApiKey = () => {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      toast.success(t('toasts.copySuccess.title'), t('toasts.copySuccess.message'));
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
      a.download = `glowguide-data-export-${new Date().toISOString().split('T')[0]}.json`;
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
      <div className="space-y-8 animate-fade-in">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-zinc-200 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-zinc-100 rounded animate-pulse" />
        </div>
        <div className="h-64 bg-white border border-zinc-200 rounded-xl animate-pulse" />
        <div className="h-48 bg-white border border-zinc-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('description')}{' '}
          <a href="#guardrails" className="text-primary hover:underline font-medium">
            {t('guardrailsLink')}
          </a>
        </p>
      </div>

      {/* Bot Persona Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>{t('botPersona.title')}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t('botPersona.description')}{' '}
                <Link href="/dashboard/settings/bot-info" className="text-primary hover:underline font-medium">
                  {t('botPersona.botInfoLink')}
                </Link>
              </p>
            </div>
          </div>
        </CardHeader>

        <div className="p-6 space-y-6">
          {/* Bot Name */}
          <div className="space-y-2">
            <label className="form-label">
              {t('botPersona.nameLabel')}
            </label>
            <Input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder={t('botPersona.namePlaceholder')}
              className="h-11"
            />
          </div>

          {/* Tone */}
          <div>
            <label className="form-label block mb-2">
              {t('botPersona.toneLabel')}
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['friendly', 'professional', 'casual', 'formal'] as const).map((tKey) => (
                <button
                  key={tKey}
                  onClick={() => setTone(tKey)}
                  className={`px-4 py-3 rounded-lg border-2 transition-colors font-medium ${tone === tKey
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-zinc-300 text-zinc-700 hover:border-zinc-400'
                    }`}
                >
                  {t(`botPersona.tones.${tKey}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Emoji */}
          <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-lg">
            <div>
              <p className="font-medium text-zinc-900">{t('botPersona.emojiLabel')}</p>
              <p className="text-sm text-zinc-600">{t('botPersona.emojiDesc')}</p>
            </div>
            <button
              onClick={() => setEmoji(!emoji)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${emoji ? 'bg-blue-600' : 'bg-zinc-300'
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${emoji ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
          </div>

          {/* Response Length */}
          <div>
            <label className="form-label block mb-2">
              {t('botPersona.responseLengthLabel')}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['short', 'medium', 'long'] as const).map((length) => (
                <button
                  key={length}
                  onClick={() => setResponseLength(length)}
                  className={`px-4 py-3 rounded-lg border-2 transition-colors font-medium ${responseLength === length
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-zinc-300 text-zinc-700 hover:border-zinc-400'
                    }`}
                >
                  {t(`botPersona.lengths.${length}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div>
            <label className="form-label block mb-2">
              {t('botPersona.temperatureLabel', { value: temperature.toFixed(1) })}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-1">
              <span>{t('botPersona.tempLabels.consistent')}</span>
              <span>{t('botPersona.tempLabels.balanced')}</span>
              <span>{t('botPersona.tempLabels.creative')}</span>
            </div>
          </div>

          {/* Product instructions scope (WhatsApp answers) — one must be chosen */}
          <div className="pt-2 border-t border-zinc-200">
            <label className="form-label block mb-2">
              {t('botPersona.productScopeLabel')}
            </label>
            <p className="text-sm text-zinc-600 mb-3">
              {t('botPersona.productScopeDesc')}
            </p>
            <div className="space-y-3">
              <label
                className={`flex gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${productInstructionsScope === 'order_only'
                  ? 'border-teal-600 bg-teal-50/80'
                  : 'border-zinc-200 hover:bg-zinc-50/80'
                  }`}
              >
                <input
                  type="radio"
                  name="product_instructions_scope"
                  value="order_only"
                  checked={productInstructionsScope === 'order_only'}
                  onChange={() => setProductInstructionsScope('order_only')}
                  className="mt-1 h-4 w-4 text-teal-600 border-zinc-300 focus:ring-teal-500"
                />
                <div>
                  <span className="font-medium text-zinc-900">{t('botPersona.productScopes.orderOnly.label')}</span>
                  <p className="text-sm text-zinc-600 mt-0.5">
                    {t('botPersona.productScopes.orderOnly.desc')}
                  </p>
                </div>
              </label>
              <label
                className={`flex gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${productInstructionsScope === 'rag_products_too'
                  ? 'border-teal-600 bg-teal-50/80'
                  : 'border-zinc-200 hover:bg-zinc-50/80'
                  }`}
              >
                <input
                  type="radio"
                  name="product_instructions_scope"
                  value="rag_products_too"
                  checked={productInstructionsScope === 'rag_products_too'}
                  onChange={() => setProductInstructionsScope('rag_products_too')}
                  className="mt-1 h-4 w-4 text-teal-600 border-zinc-300 focus:ring-teal-500"
                />
                <div>
                  <span className="font-medium text-zinc-900">{t('botPersona.productScopes.ragProductsToo.label')}</span>
                  <p className="text-sm text-zinc-600 mt-0.5">
                    {t('botPersona.productScopes.ragProductsToo.desc')}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* WhatsApp sender: merchant's number vs corporate number — one must be chosen */}
          <div className="pt-2 border-t border-zinc-200">
            <label className="form-label block mb-2">
              {t('botPersona.whatsappSenderLabel')}
            </label>
            <p className="text-sm text-zinc-600 mb-3">
              {t('botPersona.whatsappSenderDesc')}
            </p>
            <div className="space-y-3">
              <label
                className={`flex gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${whatsappSenderMode === 'merchant_own'
                  ? 'border-teal-600 bg-teal-50/80'
                  : 'border-zinc-200 hover:bg-zinc-50/80'
                  }`}
              >
                <input
                  type="radio"
                  name="whatsapp_sender_mode"
                  value="merchant_own"
                  checked={whatsappSenderMode === 'merchant_own'}
                  onChange={() => setWhatsappSenderMode('merchant_own')}
                  className="mt-1 h-4 w-4 text-teal-600 border-zinc-300 focus:ring-teal-500"
                />
                <div>
                  <span className="font-medium text-zinc-900">{t('botPersona.whatsappSenders.merchantOwn.label')}</span>
                  <p className="text-sm text-zinc-600 mt-0.5">
                    {t('botPersona.whatsappSenders.merchantOwn.desc')}
                  </p>
                </div>
              </label>
              <label
                className={`flex gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${whatsappSenderMode === 'corporate'
                  ? 'border-teal-600 bg-teal-50/80'
                  : 'border-zinc-200 hover:bg-zinc-50/80'
                  }`}
              >
                <input
                  type="radio"
                  name="whatsapp_sender_mode"
                  value="corporate"
                  checked={whatsappSenderMode === 'corporate'}
                  onChange={() => setWhatsappSenderMode('corporate')}
                  className="mt-1 h-4 w-4 text-teal-600 border-zinc-300 focus:ring-teal-500"
                />
                <div>
                  <span className="font-medium text-zinc-900">{t('botPersona.whatsappSenders.corporate.label')}</span>
                  <p className="text-sm text-zinc-600 mt-0.5">
                    {t('botPersona.whatsappSenders.corporate.desc')}
                  </p>
                </div>
              </label>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-zinc-100/80 border border-zinc-200">
              <p className="text-sm font-medium text-zinc-800 mb-1">{t('botPersona.whatsappHelpTitle')}</p>
              <p className="text-sm text-zinc-600">
                {t('botPersona.whatsappHelpText')}
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <Button
              onClick={handleSavePersona}
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {saving ? t('botPersona.saving') : t('botPersona.saveButton')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Guardrails */}
      <Card id="guardrails" className="scroll-mt-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>{t('guardrails.title')}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('guardrails.description')}
                </p>
              </div>
            </div>
            <Button onClick={openAddGuardrail}>
              <Plus className="w-4 h-4 mr-2" />
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

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Key className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>{t('apiKeys.title')}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('apiKeys.description')}
                </p>
              </div>
            </div>
            <Button
              onClick={handleCreateApiKey}
              disabled={creatingKey || apiKeys.length >= 5}
            >
              {creatingKey ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {creatingKey ? t('apiKeys.creating') : t('apiKeys.createButton')}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <p>{t('apiKeys.empty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => {
                const keyHash = key.hash; // Display hash as-is

                return (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-4 border rounded-lg border-zinc-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-zinc-900">{key.hash}</code>
                        {key.name && (
                          <span className="text-xs text-zinc-600 bg-zinc-100 px-2 py-1 rounded">
                            {key.name}
                          </span>
                        )}
                        {key.is_expired && (
                          <span className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded font-medium">
                            {t('apiKeys.expired')}
                          </span>
                        )}
                        {key.is_expiring_soon && !key.is_expired && (
                          <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded font-medium">
                            {t('apiKeys.expiresIn', { days: key.days_until_expiration })}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-zinc-600 space-y-1">
                        <p>{t('apiKeys.created', { date: new Date(key.created_at).toLocaleDateString() })}</p>
                        {key.expires_at && (
                          <p>
                            {t('apiKeys.expires', { date: new Date(key.expires_at).toLocaleDateString() })}
                            {key.days_until_expiration !== null && (
                              <span className="ml-2">
                                ({key.days_until_expiration} days)
                              </span>
                            )}
                          </p>
                        )}
                        {key.last_used_at && (
                          <p>{t('apiKeys.lastUsed', { date: new Date(key.last_used_at).toLocaleDateString() })}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => handleCopyApiKey(keyHash)}>
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        {t('apiKeys.copy')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Are you sure you want to revoke this API key?')) {
                            handleRevokeApiKey(key.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        {t('apiKeys.revoke')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* GDPR & Data Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle>{t('gdpr.title')}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
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
      {showGuardrailModal && (
        <div className="modal-overlay">
          <Card className="max-w-lg w-full animate-slide-up shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-zinc-900 mb-4">
              {editingGuardrail ? t('guardrails.modal.titleEdit') : t('guardrails.modal.titleAdd')}
            </h2>
            <div className="space-y-4">
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
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleSaveGuardrail}
                disabled={savingGuardrails}
              >
                {savingGuardrails && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {savingGuardrails ? t('guardrails.modal.saving') : (editingGuardrail ? t('guardrails.modal.save') : t('guardrails.modal.save'))}
              </Button>
              <Button
                variant="outline"
                onClick={closeGuardrailModal}
                disabled={savingGuardrails}
              >
                {t('guardrails.modal.cancel')}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <Card className="max-w-md w-full animate-slide-up shadow-2xl">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {t('gdpr.modal.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        </div>
      )}

      {/* New API Key Modal */}
      {showNewKeyModal && newApiKey && (
        <div className="modal-overlay">
          <Card className="max-w-md w-full animate-slide-up shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                {t('apiKeys.modal.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>{t('apiKeys.modal.important')}</strong> {t('apiKeys.modal.warning')}
                </p>
              </div>

              <div className="space-y-2">
                <label className="form-label">{t('apiKeys.modal.label')}</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={newApiKey}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button onClick={copyApiKey}>
                    <Copy className="w-4 h-4 mr-2" />
                    {t('apiKeys.copy')}
                  </Button>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowNewKeyModal(false);
                  setNewApiKey(null);
                }}
              >
                {t('apiKeys.modal.close')}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}