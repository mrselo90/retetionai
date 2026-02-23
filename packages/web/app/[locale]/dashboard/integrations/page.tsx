'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest, getApiUrl, getApiBaseUrlForDisplay } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Trash2, Pencil, Plug, Upload, Code, MessageSquare, ShoppingBag, MessageCircle, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useTranslations, useLocale } from 'next-intl';

interface Integration {
  id: string;
  provider: 'shopify' | 'woocommerce' | 'ticimax' | 'manual' | 'whatsapp';
  status: 'pending' | 'active' | 'error' | 'disabled';
  auth_type: 'oauth' | 'api_key' | 'token';
  created_at: string;
  updated_at: string;
  phone_number_display?: string;
  /** Shopify store domain (e.g. store.myshopify.com) when provider is shopify */
  shop_domain?: string;
}

/** Manual integration is not in plan for now; API keys are still used for webhooks/API auth in Settings. */
const ENABLE_MANUAL_INTEGRATION = false;

export default function IntegrationsPage() {
  const t = useTranslations('Integrations');
  const locale = useLocale();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShopifyModal, setShowShopifyModal] = useState(false);
  const [shopifyShop, setShopifyShop] = useState('');
  const [connectingShopify, setConnectingShopify] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [connectingWhatsApp, setConnectingWhatsApp] = useState(false);
  const [whatsappPhoneDisplay, setWhatsappPhoneDisplay] = useState('');
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('');
  const [whatsappAccessToken, setWhatsappAccessToken] = useState('');
  const [whatsappVerifyToken, setWhatsappVerifyToken] = useState('');
  const [editingWhatsAppId, setEditingWhatsAppId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Array<{ id: number; hash: string }>>([]);
  const [platformWhatsApp, setPlatformWhatsApp] = useState<string>('');

  useEffect(() => {
    loadIntegrations();
    if (ENABLE_MANUAL_INTEGRATION) loadApiKeys();
    loadPlatformContact();
  }, []);

  // Reload integrations when page becomes visible (e.g. after OAuth redirect)
  useEffect(() => {
    const onFocus = () => loadIntegrations();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const loadPlatformContact = async () => {
    try {
      const res = await fetch(getApiUrl('/api/config/platform-contact'));
      if (res.ok) {
        const data = await res.json();
        setPlatformWhatsApp(data.whatsapp_number || '');
      }
    } catch {
      setPlatformWhatsApp('+905545736900');
    }
  };

  const loadApiKeys = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const response = await authenticatedRequest<{ apiKeys: Array<{ id: number; hash: string }> }>(
          '/api/merchants/me/api-keys',
          session.access_token
        );
        setApiKeys(response.apiKeys);
      }
    } catch (err) {
      console.error('Failed to load API keys:', err);
    }
  };

  const loadIntegrations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const response = await authenticatedRequest<{ integrations: Integration[] }>(
        '/api/integrations',
        session.access_token
      );
      setIntegrations(response.integrations);
    } catch (err: any) {
      console.error('Failed to load integrations:', err);
      if (err.status === 401) {
        toast.error(t('toasts.sessionExpired.title'), t('toasts.sessionExpired.message'));
        window.location.href = '/login';
      } else {
        toast.error(t('toasts.loadError.title'), t('toasts.loadError.message'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectShopify = async () => {
    if (!shopifyShop) {
      toast.warning(t('toasts.missingShop.title'), t('toasts.missingShop.message'));
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setConnectingShopify(true);

      const response = await authenticatedRequest<{ authUrl: string }>(
        '/api/integrations/shopify/auth',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify({ shop: shopifyShop }),
        }
      );

      // Redirect to Shopify OAuth
      window.location.href = response.authUrl;
    } catch (err: any) {
      console.error('Failed to connect Shopify:', err);
      toast.error(t('toasts.shopifyError.title'), err.message || t('toasts.shopifyError.message'));
      setConnectingShopify(false);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    toast.info(t('toasts.fileSelected.title'), t('toasts.fileSelected.message', { name: file.name }));
  };

  const handleImportCsv = async () => {
    if (!csvFile) {
      toast.warning(t('toasts.missingFile.title'), t('toasts.missingFile.message'));
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setImporting(true);

      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch(getApiUrl('/api/csv/import'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('CSV import failed');
      }

      const result = await response.json();
      toast.success(t('toasts.importSuccess.title'), t('toasts.importSuccess.message', { count: result.imported }));

      setShowCsvModal(false);
      setCsvFile(null);
      await loadIntegrations();
    } catch (err: any) {
      console.error('Failed to import CSV:', err);
      toast.error(t('toasts.importError.title'), err.message || t('toasts.importError.message'));
    } finally {
      setImporting(false);
    }
  };

  const handleCreateManualIntegration = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await authenticatedRequest(
        '/api/integrations',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify({
            provider: 'manual',
            auth_type: 'api_key',
            auth_data: {},
          }),
        }
      );

      toast.success(t('toasts.manualSuccess.title'), t('toasts.manualSuccess.message'));
      setShowManualModal(false);
      await loadIntegrations();
    } catch (err: any) {
      console.error('Failed to create manual integration:', err);
      toast.error(t('toasts.manualError.title'), err.message || t('toasts.manualError.message'));
    }
  };

  const openWhatsAppModal = (integration?: Integration) => {
    if (integration?.provider === 'whatsapp') {
      setEditingWhatsAppId(integration.id);
      setWhatsappPhoneDisplay(integration.phone_number_display || '');
      setWhatsappPhoneNumberId('');
      setWhatsappAccessToken('');
      setWhatsappVerifyToken('');
    } else {
      setEditingWhatsAppId(null);
      setWhatsappPhoneDisplay('');
      setWhatsappPhoneNumberId('');
      setWhatsappAccessToken('');
      setWhatsappVerifyToken('');
    }
    setShowWhatsAppModal(true);
  };

  const handleSaveWhatsApp = async () => {
    if (!whatsappPhoneNumberId.trim() || !whatsappAccessToken.trim() || !whatsappVerifyToken.trim()) {
      toast.warning(t('toasts.missingWhatsapp.title'), t('toasts.missingWhatsapp.message'));
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setConnectingWhatsApp(true);
      const auth_data = {
        phone_number_id: whatsappPhoneNumberId.trim(),
        access_token: whatsappAccessToken.trim(),
        verify_token: whatsappVerifyToken.trim(),
        phone_number_display: whatsappPhoneDisplay.trim() || undefined,
      };
      if (editingWhatsAppId) {
        await authenticatedRequest(
          `/api/integrations/${editingWhatsAppId}`,
          session.access_token,
          { method: 'PUT', body: JSON.stringify({ auth_data, status: 'active' }) }
        );
        toast.success(t('toasts.whatsappUpdateSuccess.title'), t('toasts.whatsappUpdateSuccess.message'));
      } else {
        await authenticatedRequest(
          '/api/integrations',
          session.access_token,
          {
            method: 'POST',
            body: JSON.stringify({
              provider: 'whatsapp',
              auth_type: 'token',
              auth_data,
            }),
          }
        );
        toast.success(t('toasts.whatsappSuccess.title'), t('toasts.whatsappSuccess.message'));
      }
      setShowWhatsAppModal(false);
      setEditingWhatsAppId(null);
      setWhatsappPhoneDisplay('');
      setWhatsappPhoneNumberId('');
      setWhatsappAccessToken('');
      setWhatsappVerifyToken('');
      await loadIntegrations();
    } catch (err: any) {
      toast.error(t('toasts.whatsappError.title'), err.message || t('toasts.whatsappError.message'));
    } finally {
      setConnectingWhatsApp(false);
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await authenticatedRequest(
        `/api/integrations/${integrationId}`,
        session.access_token,
        {
          method: 'DELETE',
        }
      );

      toast.success(t('toasts.deleteSuccess.title'), t('toasts.deleteSuccess.message'));
      await loadIntegrations();
    } catch (err: any) {
      console.error('Failed to delete integration:', err);
      toast.error(t('toasts.deleteError.title'), err.message || t('toasts.deleteError.message'));
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'shopify':
        return '🛍️';
      case 'woocommerce':
        return '🛒';
      case 'ticimax':
        return '🏪';
      case 'manual':
        return '📝';
      case 'whatsapp':
        return '💬';
      default:
        return '🔌';
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'shopify':
        return t('providers.shopify.title');
      case 'woocommerce':
        return 'WooCommerce';
      case 'ticimax':
        return 'Ticimax';
      case 'manual':
        return t('providers.manual.title');
      case 'whatsapp':
        return t('providers.whatsapp.title');
      default:
        return provider;
    }
  };

  const hasWhatsApp = integrations.some((i) => i.provider === 'whatsapp');
  const hasShopify = integrations.some((i) => i.provider === 'shopify');
  const hasManual = integrations.some((i) => i.provider === 'manual');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'disabled':
        return 'bg-zinc-100 text-zinc-800';
      default:
        return 'bg-zinc-100 text-zinc-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return t('active.status.active');
      case 'error':
        return t('active.status.error');
      case 'pending':
        return t('active.status.pending');
      case 'disabled':
        return t('active.status.disabled');
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in pb-8">
        <div className="space-y-1.5">
          <div className="h-8 w-48 bg-zinc-200 rounded-md animate-pulse" />
          <div className="h-4 w-96 bg-zinc-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white shadow-sm ring-1 ring-black/5 rounded-xl p-5 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="h-12 w-12 bg-zinc-100 rounded-lg mb-4" />
              <div className="h-5 w-24 bg-zinc-200 rounded mb-2" />
              <div className="h-10 w-full bg-zinc-100 rounded" />
              <div className="mt-4 h-8 w-full bg-zinc-200 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8 font-sans text-[#303030]">
      <div className="space-y-1">
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-description">{t('description')}</p>
      </div>

      {/* Platform support number as an Alert Banner */}
      {platformWhatsApp && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-blue-800">
            <Info className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">{t('platformSupport.title')}</p>
              <p className="text-sm opacity-90">{t('platformSupport.subtitle')}</p>
            </div>
          </div>
          <a
            href={`https://wa.me/${platformWhatsApp.replace(/^\+/, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center flex-shrink-0 gap-2 px-3 py-1.5 bg-white hover:bg-zinc-50 text-blue-900 border border-blue-200 shadow-sm rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            {platformWhatsApp}
          </a>
        </div>
      )}

      {/* Discover Integrations (Polaris List Style) */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">Discover integrations</h2>
        <div className="bg-white shadow-sm ring-1 ring-zinc-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-zinc-100">
            {/* Shopify */}
            <div className="p-4 hover:bg-zinc-50/50 transition-colors flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg shadow-sm border border-black/5 bg-[#95BF47]/10 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-5 h-5 text-[#95BF47]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#1a1a1a]">{t('providers.shopify.title')}</h3>
                    {hasShopify && <Badge variant="secondary" className="bg-[#AEE9D1] text-[#005E39] hover:bg-[#AEE9D1]">Connected</Badge>}
                  </div>
                  <p className="text-sm text-[#616161] mt-0.5 max-w-[400px]">
                    {hasShopify
                      ? (integrations.find((i) => i.provider === 'shopify')?.shop_domain
                        ? `${t('active.storeLabel')}: ${integrations.find((i) => i.provider === 'shopify')?.shop_domain}`
                        : t('providers.shopify.connected'))
                      : t('providers.shopify.description')}
                  </p>
                </div>
              </div>
              <div>
                <button
                  onClick={() => setShowShopifyModal(true)}
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg shadow-sm transition-colors whitespace-nowrap ${hasShopify
                    ? 'bg-white text-[#1a1a1a] ring-1 ring-zinc-200 hover:bg-zinc-50'
                    : 'bg-[#1a1a1a] text-white hover:bg-[#303030]'
                    }`}
                >
                  {hasShopify ? t('providers.shopify.action.connected') : t('providers.shopify.action.connect')}
                </button>
              </div>
            </div>

            {/* WhatsApp Business */}
            <div className="p-4 hover:bg-zinc-50/50 transition-colors flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg shadow-sm border border-black/5 bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-5 h-5 text-[#25D366]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#1a1a1a]">{t('providers.whatsapp.title')}</h3>
                    {hasWhatsApp && <Badge variant="secondary" className="bg-[#AEE9D1] text-[#005E39] hover:bg-[#AEE9D1]">Connected</Badge>}
                  </div>
                  <p className="text-sm text-[#616161] mt-0.5 max-w-[400px]">
                    {hasWhatsApp ? t('providers.whatsapp.connected') : t('providers.whatsapp.description')}
                  </p>
                </div>
              </div>
              <div>
                <button
                  onClick={() => openWhatsAppModal(integrations.find((i) => i.provider === 'whatsapp'))}
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg shadow-sm transition-colors whitespace-nowrap ${hasWhatsApp
                    ? 'bg-white text-[#1a1a1a] ring-1 ring-zinc-200 hover:bg-zinc-50'
                    : 'bg-[#1a1a1a] text-white hover:bg-[#303030]'
                    }`}
                >
                  {hasWhatsApp ? t('providers.whatsapp.action.update') : t('providers.whatsapp.action.connect')}
                </button>
              </div>
            </div>

            {/* CSV Import */}
            <div className="p-4 hover:bg-zinc-50/50 transition-colors flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg shadow-sm border border-black/5 bg-zinc-100 flex items-center justify-center flex-shrink-0">
                  <Upload className="w-5 h-5 text-zinc-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1a1a1a]">{t('providers.csv.title')}</h3>
                  <p className="text-sm text-[#616161] mt-0.5 max-w-[400px]">
                    {t('providers.csv.description')}
                  </p>
                </div>
              </div>
              <div>
                <button
                  onClick={() => setShowCsvModal(true)}
                  className="bg-white hover:bg-zinc-50 text-[#1a1a1a] shadow-sm ring-1 ring-zinc-200 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors inline-flex items-center whitespace-nowrap"
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  {t('providers.csv.action')}
                </button>
              </div>
            </div>

            {ENABLE_MANUAL_INTEGRATION && (
              /* Manual / API */
              <div className="p-4 hover:bg-zinc-50/50 transition-colors flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg shadow-sm border border-black/5 bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Code className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#1a1a1a]">{t('providers.manual.title')}</h3>
                      {hasManual && <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Connected</Badge>}
                    </div>
                    <p className="text-sm text-[#616161] mt-0.5 max-w-[400px]">
                      {hasManual ? t('providers.manual.connected') : t('providers.manual.description')}
                    </p>
                  </div>
                </div>
                <div>
                  <button
                    onClick={() => setShowManualModal(true)}
                    className={`text-sm font-medium px-3 py-1.5 rounded-lg shadow-sm transition-colors whitespace-nowrap ${hasManual
                      ? 'bg-white text-[#1a1a1a] ring-1 ring-zinc-200 hover:bg-zinc-50'
                      : 'bg-white text-[#1a1a1a] ring-1 ring-zinc-200 hover:bg-zinc-50'
                      }`}
                  >
                    <Code className="w-4 h-4 mr-1.5 inline" />
                    {hasManual ? t('providers.manual.action.connected') : t('providers.manual.action.setup')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Integrations */}
      <div className="pt-8">
        <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">{t('active.title')}</h2>
        {integrations.length > 0 ? (
          <div className="bg-white shadow-sm ring-1 ring-zinc-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-zinc-100">
              {integrations.map((integration, idx) => (
                <div key={integration.id} className="p-4 hover:bg-zinc-50/50 transition-all group" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {integration.provider === 'shopify' && (
                        <div className="w-10 h-10 rounded-lg shadow-sm border border-black/5 bg-[#95BF47]/10 flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="w-5 h-5 text-[#95BF47]" />
                        </div>
                      )}
                      {integration.provider === 'whatsapp' && (
                        <div className="w-10 h-10 rounded-lg shadow-sm border border-black/5 bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                          <MessageCircle className="w-5 h-5 text-[#25D366]" />
                        </div>
                      )}
                      {integration.provider === 'manual' && (
                        <div className="w-10 h-10 rounded-lg shadow-sm border border-black/5 bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <Code className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      {integration.provider !== 'shopify' && integration.provider !== 'whatsapp' && integration.provider !== 'manual' && (
                        <div className="w-10 h-10 rounded-lg shadow-sm border border-black/5 bg-zinc-100 flex items-center justify-center flex-shrink-0">
                          <Plug className="w-5 h-5 text-zinc-600" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-semibold text-[#1a1a1a]">
                          {getProviderName(integration.provider)}
                          {integration.provider === 'whatsapp' && integration.phone_number_display && (
                            <span className="ml-2 font-normal text-[#616161]">
                              • {integration.phone_number_display}
                            </span>
                          )}
                          {integration.provider === 'shopify' && integration.shop_domain && (
                            <span className="ml-2 font-normal text-[#616161]">
                              • {integration.shop_domain}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-[#616161] mt-0.5">
                          {t('createdLabel')} {new Date(integration.created_at).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={integration.status === 'active' ? 'success' : integration.status === 'error' ? 'destructive' : 'secondary'} className="shadow-sm font-medium">
                        {getStatusText(integration.status)}
                      </Badge>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {integration.provider === 'whatsapp' && (
                          <button
                            onClick={() => openWhatsAppModal(integration)}
                            title={t('providers.whatsapp.action.update')}
                            className="p-1.5 text-[#616161] hover:text-[#1a1a1a] hover:bg-zinc-100 rounded transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          onClick={() => {
                            if (confirm(t('active.deleteConfirm'))) {
                              handleDeleteIntegration(integration.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-sm ring-1 ring-zinc-200 rounded-xl py-12 px-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 mb-4 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shadow-sm">
              <Plug className="w-6 h-6 text-zinc-400" />
            </div>
            <h3 className="text-sm font-semibold text-[#1a1a1a] mb-1">
              {t('active.empty.title')}
            </h3>
            <p className="text-sm text-[#616161] max-w-sm">
              No integrations are currently active. Discover apps above to automate your workflows.
            </p>
          </div>
        )}
      </div>

      {/* Shopify Modal */}
      <Dialog open={showShopifyModal} onOpenChange={(open) => {
        if (!connectingShopify) setShowShopifyModal(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('modals.shopify.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t('modals.shopify.shopLabel')}
              </label>
              <Input
                type="text"
                value={shopifyShop}
                onChange={(e) => setShopifyShop(e.target.value)}
                placeholder={t('modals.shopify.shopPlaceholder')}
                disabled={connectingShopify}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                {t('modals.shopify.helper')}
              </p>
            </div>

            <DialogFooter className="gap-3 sm:gap-3">
              <button
                onClick={() => setShowShopifyModal(false)}
                disabled={connectingShopify}
                className="bg-white hover:bg-zinc-50 text-[#1a1a1a] shadow-sm ring-1 ring-black/5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {t('modals.shopify.cancel')}
              </button>
              <button
                onClick={handleConnectShopify}
                disabled={connectingShopify}
                className="bg-[#1a1a1a] hover:bg-[#303030] text-white shadow-sm ring-1 ring-transparent rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center"
              >
                {connectingShopify && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {connectingShopify ? t('modals.shopify.connecting') : t('modals.shopify.connect')}
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV Modal */}
      <Dialog open={showCsvModal} onOpenChange={(open) => {
        if (!importing) setShowCsvModal(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('modals.csv.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t('modals.csv.fileLabel')}
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                disabled={importing}
                className="w-full px-3 py-2 rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 text-sm"
              />
              {csvFile && (
                <p className="text-sm text-emerald-600">
                  {t('modals.csv.fileSelected', { name: csvFile.name })}
                </p>
              )}
            </div>

            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <strong>{t('modals.csv.format')}</strong>
              </p>
            </div>

            <DialogFooter className="gap-3 sm:gap-3">
              <button
                onClick={() => setShowCsvModal(false)}
                disabled={importing}
                className="bg-white hover:bg-zinc-50 text-[#1a1a1a] shadow-sm ring-1 ring-black/5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {t('modals.csv.cancel')}
              </button>
              <button
                onClick={handleImportCsv}
                disabled={importing || !csvFile}
                className="bg-[#1a1a1a] hover:bg-[#303030] text-white shadow-sm ring-1 ring-transparent rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center"
              >
                {importing && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {importing ? t('modals.csv.importing') : t('modals.csv.import')}
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Integration Modal */}
      <Dialog open={showManualModal} onOpenChange={setShowManualModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('modals.manual.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <p className="text-sm font-medium mb-2">
                {t('modals.manual.webhookLabel')}
              </p>
              <code className="block bg-white px-3 py-2 rounded border text-sm font-mono">
                {getApiBaseUrlForDisplay()}/api/webhooks/manual
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                {t('modals.manual.webhookHelper')}
              </p>
            </div>

            {apiKeys.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('modals.manual.apiKeyLabel')}</p>
                <code className="block bg-muted px-3 py-2 rounded border text-sm font-mono">
                  {apiKeys[0]?.hash.substring(0, 20)}...
                </code>
              </div>
            )}

            <DialogFooter className="gap-3 sm:gap-3">
              <button
                onClick={() => setShowManualModal(false)}
                className="bg-white hover:bg-zinc-50 text-[#1a1a1a] shadow-sm ring-1 ring-black/5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              >
                {t('modals.manual.cancel')}
              </button>
              <button
                onClick={handleCreateManualIntegration}
                className="bg-[#1a1a1a] hover:bg-[#303030] text-white shadow-sm ring-1 ring-transparent rounded-lg px-3 py-1.5 text-sm font-medium transition-colors inline-flex items-center justify-center"
              >
                {t('modals.manual.create')}
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Business Modal */}
      <Dialog open={showWhatsAppModal} onOpenChange={(open) => {
        if (!connectingWhatsApp) setShowWhatsAppModal(open);
      }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWhatsAppId ? t('modals.whatsapp.updateTitle') : t('modals.whatsapp.title')}
            </DialogTitle>
            <DialogDescription>
              {t('modals.whatsapp.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('modals.whatsapp.displayLabel')}</label>
              <Input
                type="text"
                value={whatsappPhoneDisplay}
                onChange={(e) => setWhatsappPhoneDisplay(e.target.value)}
                placeholder={t('modals.whatsapp.displayPlaceholder')}
                disabled={connectingWhatsApp}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('modals.whatsapp.phoneIdLabel')}</label>
              <Input
                type="text"
                value={whatsappPhoneNumberId}
                onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
                placeholder={t('modals.whatsapp.phoneIdPlaceholder')}
                disabled={connectingWhatsApp}
                className="h-11 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('modals.whatsapp.tokenLabel')}</label>
              <Input
                type="password"
                value={whatsappAccessToken}
                onChange={(e) => setWhatsappAccessToken(e.target.value)}
                placeholder={t('modals.whatsapp.tokenPlaceholder')}
                disabled={connectingWhatsApp}
                className="h-11 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{t('modals.whatsapp.verifyLabel')}</label>
              <Input
                type="text"
                value={whatsappVerifyToken}
                onChange={(e) => setWhatsappVerifyToken(e.target.value)}
                placeholder={t('modals.whatsapp.verifyPlaceholder')}
                disabled={connectingWhatsApp}
                className="h-11 font-mono text-sm"
              />
            </div>

            <DialogFooter className="gap-3 sm:gap-3">
              <button
                onClick={() => setShowWhatsAppModal(false)}
                disabled={connectingWhatsApp}
                className="bg-white hover:bg-zinc-50 text-[#1a1a1a] shadow-sm ring-1 ring-black/5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {t('modals.whatsapp.cancel')}
              </button>
              <button
                onClick={handleSaveWhatsApp}
                disabled={connectingWhatsApp || !whatsappPhoneNumberId.trim() || !whatsappAccessToken.trim() || !whatsappVerifyToken.trim()}
                className="bg-[#1a1a1a] hover:bg-[#303030] text-white shadow-sm ring-1 ring-transparent rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center"
              >
                {connectingWhatsApp && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {connectingWhatsApp ? t('modals.whatsapp.saving') : editingWhatsAppId ? t('modals.whatsapp.update') : t('modals.whatsapp.save')}
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}