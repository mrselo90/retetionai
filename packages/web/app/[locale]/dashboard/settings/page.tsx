'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Settings, Bot, Shield, Key, Database, Loader2, Plus, Copy, Trash2, Pencil, X, Download, AlertTriangle, ExternalLink } from 'lucide-react';

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
      setBotName(persona.bot_name || 'Asistan');
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

      // Load guardrails separately so a missing column or API error doesn't break the whole page
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
        toast.error('Güvenlik kuralları yüklenemedi. Veritabanı migration\'ını (008_merchant_guardrails) çalıştırın.');
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      if (err.status === 401) {
        window.location.href = '/login';
      } else {
        toast.error('Ayarlar yüklenirken bir hata oluştu');
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

      toast.success('Bot ayarları başarıyla güncellendi');
      await loadData();
    } catch (err: any) {
      console.error('Failed to save persona:', err);
      toast.error(err.message || 'Ayarlar kaydedilemedi');
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
      toast.error('Kural adı gerekli');
      return;
    }
    const valueStr = guardrailValue.trim();
    if (!valueStr) {
      toast.error('Anahtar kelimeler veya ifade gerekli');
      return;
    }
    const value: string[] | string =
      guardrailMatchType === 'phrase'
        ? valueStr
        : valueStr.split(',').map((s) => s.trim()).filter(Boolean);
    if (guardrailMatchType === 'keywords' && Array.isArray(value) && value.length === 0) {
      toast.error('En az bir anahtar kelime girin');
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
      toast.success(editingGuardrail ? 'Kural güncellendi' : 'Kural eklendi');
      closeGuardrailModal();
    } catch (err: any) {
      toast.error(err.message || 'Kural kaydedilemedi');
    } finally {
      setSavingGuardrails(false);
    }
  };

  const handleDeleteGuardrail = async (id: string) => {
    if (!confirm('Bu kuralı silmek istediğinize emin misiniz?')) return;
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
      toast.success('Kural silindi');
    } catch (err: any) {
      toast.error(err.message || 'Kural silinemedi');
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
      toast.error(err.message || 'API key oluşturulamadı');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleCopyApiKey = (keyHash: string) => {
    navigator.clipboard.writeText(keyHash);
    toast.success('API key panoya kopyalandı');
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

      toast.success('API key başarıyla iptal edildi');
      await loadData();
    } catch (err: any) {
      console.error('Failed to revoke API key:', err);
      toast.error(err.message || 'API key iptal edilemedi');
    }
  };

  const copyApiKey = () => {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      toast.success('API key panoya kopyalandı');
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

      toast.success('Verileriniz indirildi');
    } catch (err: any) {
      console.error('Failed to export data:', err);
      toast.error(err.message || 'Veri export edilemedi');
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
        toast.warning('Verileriniz kalıcı olarak silindi');
        // Redirect to home after 2 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        toast.error(
          `Veri silme planlandı. Kalıcı silme: ${new Date(response.permanent_deletion_at || '').toLocaleDateString()}`,
          'info'
        );
      }
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error('Failed to delete data:', err);
      toast.error(err.message || 'Veri silinemedi');
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
        <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
        <p className="text-muted-foreground">
          Bot davranışını ve API erişimini yönetin.{' '}
          <a href="#guardrails" className="text-primary hover:underline font-medium">
            Güvenlik Kuralları (Guardrails) →
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
              <CardTitle>Bot Kişiliği</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                AI botunuzun müşterilerle nasıl konuşacağını belirleyin.{' '}
                <Link href="/dashboard/settings/bot-info" className="text-primary hover:underline font-medium">
                  Bot Bilgisi (AI Kuralları) →
                </Link>
              </p>
            </div>
          </div>
        </CardHeader>

        <div className="p-6 space-y-6">
          {/* Bot Name */}
          <div className="space-y-2">
            <label className="form-label">
              Bot Adı
            </label>
            <Input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Asistan"
              className="h-11"
            />
          </div>

          {/* Tone */}
          <div>
            <label className="form-label block mb-2">
              Ton
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['friendly', 'professional', 'casual', 'formal'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`px-4 py-3 rounded-lg border-2 transition-colors font-medium ${tone === t
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-zinc-300 text-zinc-700 hover:border-zinc-400'
                    }`}
                >
                  {t === 'friendly' && '😊 Samimi'}
                  {t === 'professional' && '👔 Profesyonel'}
                  {t === 'casual' && '😎 Rahat'}
                  {t === 'formal' && '🎩 Resmi'}
                </button>
              ))}
            </div>
          </div>

          {/* Emoji */}
          <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-lg">
            <div>
              <p className="font-medium text-zinc-900">Emoji Kullan</p>
              <p className="text-sm text-zinc-600">Mesajlarda emoji kullanılsın mı?</p>
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
              Yanıt Uzunluğu
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
                  {length === 'short' && 'Kısa'}
                  {length === 'medium' && 'Orta'}
                  {length === 'long' && 'Uzun'}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div>
            <label className="form-label block mb-2">
              Yaratıcılık (Temperature): {temperature.toFixed(1)}
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
              <span>Tutarlı (0.0)</span>
              <span>Dengeli (0.7)</span>
              <span>Yaratıcı (1.0)</span>
            </div>
          </div>

          {/* Product instructions scope (WhatsApp answers) — one must be chosen */}
          <div className="pt-2 border-t border-zinc-200">
            <label className="form-label block mb-2">
              Ürün talimatları (WhatsApp yanıtları)
            </label>
            <p className="text-sm text-zinc-600 mb-3">
              Kullanım talimatları (Shopify → Kullanım Talimatı sayfasındaki metinler) hangi durumlarda AI yanıtına eklensin?
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
                  <span className="font-medium text-zinc-900">Sadece siparişi olan müşteriler</span>
                  <p className="text-sm text-zinc-600 mt-0.5">
                    Kullanım talimatları yalnızca siparişi olan müşterilere gösterilir. Siparişi olmayan sorularda sadece ürün açıklaması (RAG) kullanılır.
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
                  <span className="font-medium text-zinc-900">Tüm ürün sorularında</span>
                  <p className="text-sm text-zinc-600 mt-0.5">
                    Siparişi olmasa bile, soru hangi ürüne denk geliyorsa o ürünün kullanım talimatları da yanıta eklenir (RAG ile eşleşen ürünler).
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* WhatsApp sender: merchant's number vs corporate number — one must be chosen */}
          <div className="pt-2 border-t border-zinc-200">
            <label className="form-label block mb-2">
              WhatsApp iletişim numarası
            </label>
            <p className="text-sm text-zinc-600 mb-3">
              Müşterilere gönderilen WhatsApp mesajları (yanıtlar, T+0 hoş geldin, T+3/T+14) hangi numaradan gitsin?
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
                  <span className="font-medium text-zinc-900">Kendi numaram (mağaza)</span>
                  <p className="text-sm text-zinc-600 mt-0.5">
                    Entegrasyonlarda bağladığınız WhatsApp Business numaranız kullanılır. Müşteriler sizin mağaza numaranızdan yanıt alır.
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
                  <span className="font-medium text-zinc-900">Kurumsal numara (GlowGuide)</span>
                  <p className="text-sm text-zinc-600 mt-0.5">
                    Platformun kurumsal WhatsApp numarası kullanılır. Tüm mesajlar bu numaradan gider.
                  </p>
                </div>
              </label>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-zinc-100/80 border border-zinc-200">
              <p className="text-sm font-medium text-zinc-800 mb-1">Kendi numaramı nereden alacağım?</p>
              <p className="text-sm text-zinc-600">
                WhatsApp Business API numaranızı <strong>Meta for Developers</strong> (developers.facebook.com) veya <strong>Meta Business Suite</strong> üzerinden alırsınız: WhatsApp Business hesabı oluşturup bir telefon numarası eklediğinizde Meta size bir <em>Phone Number ID</em> verir; bu numara mesajların gönderileceği numaradır. İleride dashboard’da <strong>Entegrasyonlar</strong> sayfasından &quot;WhatsApp Business bağla&quot; ile bu bilgileri bağlayabileceksiniz.
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
              {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
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
                <CardTitle>Güvenlik Kuralları (Guardrails)</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Botun hangi mesajlara yanıt vermeyeceğini veya yönlendireceğini belirleyin.
                </p>
              </div>
            </div>
            <Button onClick={openAddGuardrail}>
              <Plus className="w-4 h-4 mr-2" />
              Yeni Kural
            </Button>
          </div>
        </CardHeader>
        <div className="p-6 space-y-6">
          {/* System guardrails (read-only) */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-700 mb-2">Sistem kuralları (düzenlenemez)</h3>
            <ul className="space-y-3">
              {systemGuardrails.map((g) => (
                <li
                  key={g.id}
                  className="flex items-start gap-3 p-4 rounded-lg border border-zinc-200 bg-zinc-50/80"
                >
                  <span className="text-zinc-500 mt-0.5" title="Düzenlenemez">🔒</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-900">{g.name_tr ?? g.name}</p>
                    <p className="text-sm text-zinc-600 mt-1">{g.description_tr ?? g.description}</p>
                    <p className="text-xs text-zinc-500 mt-2">
                      Uygulama: {g.apply_to === 'both' ? 'Kullanıcı + AI yanıtı' : g.apply_to === 'user_message' ? 'Kullanıcı mesajı' : 'AI yanıtı'} · {g.action === 'escalate' ? 'İnsan yönlendirme' : 'Engelle'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {/* Custom guardrails */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-700 mb-2">Özel kurallarınız</h3>
            {customGuardrails.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4">Henüz özel kural eklenmedi. &quot;+ Yeni Kural&quot; ile ekleyin.</p>
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
                          ? `Anahtar kelimeler: ${Array.isArray(g.value) ? g.value.join(', ') : g.value}`
                          : `İfade: ${typeof g.value === 'string' ? g.value : (Array.isArray(g.value) ? g.value[0] : '')}`}
                        {' · '}
                        {g.apply_to === 'both' ? 'Kullanıcı + AI' : g.apply_to === 'user_message' ? 'Kullanıcı' : 'AI'} · {g.action === 'escalate' ? 'İnsan yönlendir' : 'Engelle'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditGuardrail(g)}
                        className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGuardrail(g.id)}
                        disabled={savingGuardrails}
                        className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                      >
                        Sil
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
                <CardTitle>API Keys</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  API entegrasyonları için kullanılır (Max 5)
                </p>
              </div>
            </div>
            <Button
              onClick={handleCreateApiKey}
              disabled={creatingKey || apiKeys.length >= 5}
            >
              {creatingKey ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {creatingKey ? 'Oluşturuluyor...' : 'Yeni Key'}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <p>Henüz API key oluşturulmamış</p>
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
                            Expired
                          </span>
                        )}
                        {key.is_expiring_soon && !key.is_expired && (
                          <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded font-medium">
                            Expires in {key.days_until_expiration} days
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-zinc-600 space-y-1">
                        <p>Created: {new Date(key.created_at).toLocaleDateString()}</p>
                        {key.expires_at && (
                          <p>
                            Expires: {new Date(key.expires_at).toLocaleDateString()}
                            {key.days_until_expiration !== null && (
                              <span className="ml-2">
                                ({key.days_until_expiration} days)
                              </span>
                            )}
                          </p>
                        )}
                        {key.last_used_at && (
                          <p>Last used: {new Date(key.last_used_at).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => handleCopyApiKey(keyHash)}>
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Kopyala
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Bu API key\'i iptal etmek istediğinizden emin misiniz?')) {
                            handleRevokeApiKey(key.id);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        İptal Et
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
              <CardTitle>GDPR & Veri Yönetimi</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Verilerinizi export edin veya silin (GDPR hakları)
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data Export */}
          <div className="p-4 border border-border rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium mb-1">Verilerinizi İndirin</h3>
                <p className="text-sm text-muted-foreground">
                  Tüm verilerinizi JSON formatında indirin (GDPR - Right to Data Portability)
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleExportData}
                disabled={exportingData}
                className="ml-4"
              >
                {exportingData ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {exportingData ? 'İndiriliyor...' : 'İndir'}
              </Button>
            </div>
          </div>

          {/* Data Deletion */}
          <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-destructive mb-1">Hesabınızı Silin</h3>
                <p className="text-sm text-destructive/80">
                  Tüm verilerinizi silin (GDPR - Right to Erasure). Bu işlem geri alınamaz!
                </p>
                <p className="text-xs text-destructive/70 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Veriler 30 gün içinde kalıcı olarak silinir.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deletingData}
                className="ml-4"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Sil
              </Button>
            </div>
          </div>

          {/* Links */}
          <div className="pt-4 border-t">
            <div className="flex flex-wrap gap-4 text-sm">
              <a href="/privacy-policy" target="_blank" className="text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Privacy Policy
              </a>
              <a href="/terms-of-service" target="_blank" className="text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Terms of Service
              </a>
              <a href="/cookie-policy" target="_blank" className="text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Cookie Policy
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
              {editingGuardrail ? 'Kuralı düzenle' : 'Yeni güvenlik kuralı'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Kural adı *</label>
                <input
                  type="text"
                  value={guardrailName}
                  onChange={(e) => setGuardrailName(e.target.value)}
                  placeholder="Örn: Rekabet içeriği"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Açıklama (isteğe bağlı)</label>
                <input
                  type="text"
                  value={guardrailDescription}
                  onChange={(e) => setGuardrailDescription(e.target.value)}
                  placeholder="Kuralın ne yaptığını kısaca yazın"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Uygulama</label>
                <select
                  value={guardrailApplyTo}
                  onChange={(e) => setGuardrailApplyTo(e.target.value as 'user_message' | 'ai_response' | 'both')}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="both">Kullanıcı mesajı + AI yanıtı</option>
                  <option value="user_message">Sadece kullanıcı mesajı</option>
                  <option value="ai_response">Sadece AI yanıtı</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Eşleşme türü</label>
                <select
                  value={guardrailMatchType}
                  onChange={(e) => setGuardrailMatchType(e.target.value as 'keywords' | 'phrase')}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="keywords">Anahtar kelimeler (virgülle ayırın)</option>
                  <option value="phrase">Tek ifade (metin içinde geçince tetiklenir)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  {guardrailMatchType === 'keywords' ? 'Anahtar kelimeler *' : 'İfade *'}
                </label>
                <input
                  type="text"
                  value={guardrailValue}
                  onChange={(e) => setGuardrailValue(e.target.value)}
                  placeholder={guardrailMatchType === 'keywords' ? 'rakip, fiyat, indirim' : 'Bu ürün iyileştirir'}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Eylem</label>
                <select
                  value={guardrailAction}
                  onChange={(e) => setGuardrailAction(e.target.value as 'block' | 'escalate')}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="block">Engelle (güvenli yanıt göster)</option>
                  <option value="escalate">Engelle + insan yönlendir</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Önerilen yanıt (isteğe bağlı)</label>
                <textarea
                  value={guardrailSuggestedResponse}
                  onChange={(e) => setGuardrailSuggestedResponse(e.target.value)}
                  placeholder="Kural tetiklenince gösterilecek metin. Boş bırakılırsa varsayılan metin kullanılır."
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
                {savingGuardrails ? 'Kaydediliyor...' : (editingGuardrail ? 'Güncelle' : 'Ekle')}
              </Button>
              <Button
                variant="outline"
                onClick={closeGuardrailModal}
                disabled={savingGuardrails}
              >
                İptal
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
                Hesap Silme Onayı
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium mb-2">
                  Bu işlem geri alınamaz!
                </p>
                <ul className="text-sm text-destructive/80 space-y-1 list-disc list-inside">
                  <li>Tüm verileriniz silinecek</li>
                  <li>30 gün içinde kalıcı olarak silinir</li>
                  <li>Bu süre içinde destek ekibine ulaşarak iptal edebilirsiniz</li>
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
                  {deletingData ? 'Siliniyor...' : '30 Gün Sonra Sil (Önerilen)'}
                </Button>
                <Button
                  variant="destructive"
                  className="w-full opacity-80"
                  onClick={() => handleDeleteData(true)}
                  disabled={deletingData}
                >
                  {deletingData ? 'Siliniyor...' : 'Hemen Kalıcı Olarak Sil'}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deletingData}
                >
                  İptal
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
                API Key Oluşturuldu!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Önemli:</strong> Bu key sadece bir kez gösterilir. Güvenli bir yere kaydedin!
                </p>
              </div>

              <div className="space-y-2">
                <label className="form-label">API Key</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={newApiKey}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <Button onClick={copyApiKey}>
                    <Copy className="w-4 h-4 mr-2" />
                    Kopyala
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
                Kapat
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
