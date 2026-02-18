'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest, getApiUrl, getApiBaseUrlForDisplay } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Trash2, Pencil, Plug, Upload, Code, MessageSquare, ShoppingBag } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

interface Integration {
  id: string;
  provider: 'shopify' | 'woocommerce' | 'ticimax' | 'manual' | 'whatsapp';
  status: 'pending' | 'active' | 'error' | 'disabled';
  auth_type: 'oauth' | 'api_key' | 'token';
  created_at: string;
  updated_at: string;
  phone_number_display?: string;
}

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
    loadApiKeys();
    loadPlatformContact();
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
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-3">
          <div className="h-10 w-48 bg-gradient-to-r from-zinc-200 to-zinc-100 rounded-xl animate-pulse" />
          <div className="h-5 w-96 bg-gradient-to-r from-zinc-100 to-zinc-50 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 bg-white border-2 border-zinc-100 rounded-xl animate-pulse shadow-sm" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground text-base font-medium">
          {t('description')}
        </p>
      </div>

      {/* Platform support number */}
      {platformWhatsApp && (
        <div className="rounded-xl border-2 border-success/30 bg-gradient-to-r from-success/10 to-success/5 p-6 flex items-center justify-between gap-4 shadow-lg animate-scale-in">
          <div className="flex items-center gap-4">
            <div className="text-4xl">💬</div>
            <div>
              <p className="font-bold text-zinc-900 text-lg">{t('platformSupport.title')}</p>
              <p className="text-sm text-zinc-600 font-medium">{t('platformSupport.subtitle')}</p>
            </div>
          </div>
          <a
            href={`https://wa.me/${platformWhatsApp.replace(/^\+/, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-success to-success/90 text-success-foreground rounded-xl hover:shadow-xl transition-all font-bold text-sm whitespace-nowrap hover:scale-105"
          >
            {platformWhatsApp}
          </a>
        </div>
      )}

      {/* Integration Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">{/* WhatsApp Business */}
        <div className={`rounded-xl shadow-lg p-7 transition-all duration-300 hover:scale-105 ${hasWhatsApp ? 'bg-gradient-to-br from-success/15 to-success/5 border-2 border-success/40 shadow-success/20' : 'bg-white border-2 border-zinc-200/80 hover:border-success/30'}`}>
          <div className="text-center relative">
            {hasWhatsApp && (
              <span className="absolute -top-2 -right-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-success text-success-foreground shadow-lg animate-scale-in">
                ✓ {t('active.connected')}
              </span>
            )}
            <div className="text-6xl mb-5">💬</div>
            <h3 className="text-xl font-extrabold text-zinc-900 mb-3">{t('providers.whatsapp.title')}</h3>
            <p className="text-sm text-zinc-600 mb-6 font-medium min-h-[40px]">
              {hasWhatsApp ? t('providers.whatsapp.connected') : t('providers.whatsapp.description')}
            </p>
            <Button
              onClick={() => openWhatsAppModal(integrations.find((i) => i.provider === 'whatsapp'))}
              className="w-full shadow-lg"
              size="lg"
              variant={hasWhatsApp ? 'outline' : 'default'}
            >
              {hasWhatsApp ? t('providers.whatsapp.action.update') : t('providers.whatsapp.action.connect')}
            </Button>
          </div>
        </div>

        {/* Shopify */}
        <div className={`rounded-xl shadow-lg p-7 transition-all duration-300 hover:scale-105 ${hasShopify ? 'bg-gradient-to-br from-green-100/80 to-green-50/50 border-2 border-green-400/40 shadow-green-200/50' : 'bg-white border-2 border-zinc-200/80 hover:border-green-300'}`}>
          <div className="text-center relative">
            {hasShopify && (
              <span className="absolute -top-2 -right-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-600 text-white shadow-lg animate-scale-in">
                ✓ {t('active.connected')}
              </span>
            )}
            <div className="text-6xl mb-5">🛍️</div>
            <h3 className="text-xl font-extrabold text-zinc-900 mb-3">{t('providers.shopify.title')}</h3>
            <p className="text-sm text-zinc-600 mb-6 font-medium min-h-[40px]">
              {hasShopify ? t('providers.shopify.connected') : t('providers.shopify.description')}
            </p>
            <Button
              onClick={() => setShowShopifyModal(true)}
              variant={hasShopify ? 'outline' : 'default'}
              className="w-full shadow-lg"
              size="lg"
            >
              {hasShopify ? t('providers.shopify.action.connected') : t('providers.shopify.action.connect')}
            </Button>
          </div>
        </div>

        {/* CSV Import */}
        <div className="bg-white border-2 border-zinc-200/80 rounded-xl shadow-lg p-7 hover:scale-105 transition-all duration-300 hover:border-primary/30">
          <div className="text-center">
            <div className="text-6xl mb-5">📊</div>
            <h3 className="text-xl font-extrabold text-zinc-900 mb-3">{t('providers.csv.title')}</h3>
            <p className="text-sm text-zinc-600 mb-6 font-medium min-h-[40px]">
              {t('providers.csv.description')}
            </p>
            <Button
              onClick={() => setShowCsvModal(true)}
              className="w-full shadow-lg"
              size="lg"
            >
              <Upload className="w-5 h-5 mr-2" />
              {t('providers.csv.action')}
            </Button>
          </div>
        </div>

        {/* Manual / API */}
        <div className={`rounded-xl shadow-lg p-7 transition-all duration-300 hover:scale-105 ${hasManual ? 'bg-gradient-to-br from-purple-100/80 to-purple-50/50 border-2 border-purple-400/40 shadow-purple-200/50' : 'bg-white border-2 border-zinc-200/80 hover:border-purple-300'}`}>
          <div className="text-center relative">
            {hasManual && (
              <span className="absolute -top-2 -right-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-600 text-white shadow-lg animate-scale-in">
                ✓ {t('active.connected')}
              </span>
            )}
            <div className="text-6xl mb-5">📝</div>
            <h3 className="text-xl font-extrabold text-zinc-900 mb-3">{t('providers.manual.title')}</h3>
            <p className="text-sm text-zinc-600 mb-6 font-medium min-h-[40px]">
              {hasManual ? t('providers.manual.connected') : t('providers.manual.description')}
            </p>
            <Button
              onClick={() => setShowManualModal(true)}
              variant={hasManual ? 'outline' : 'default'}
              className="w-full shadow-lg"
              size="lg"
            >
              <Code className="w-5 h-5 mr-2" />
              {hasManual ? t('providers.manual.action.connected') : t('providers.manual.action.setup')}
            </Button>
          </div>
        </div>
      </div>

      {/* Active Integrations */}
      <div className="pt-2">
        <h2 className="text-2xl font-extrabold tracking-tight mb-4">{t('active.title')}</h2>
        {integrations.length > 0 ? (
          <Card className="overflow-hidden shadow-lg">
            <div className="divide-y divide-border">
              {integrations.map((integration, idx) => (
                <div key={integration.id} className="p-7 hover:bg-gradient-to-r hover:from-muted/30 hover:to-transparent transition-all group" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="text-5xl group-hover:scale-110 transition-transform">{getProviderIcon(integration.provider)}</div>
                      <div>
                        <h3 className="text-xl font-bold text-zinc-900">
                          {getProviderName(integration.provider)}
                          {integration.provider === 'whatsapp' && integration.phone_number_display && (
                            <span className="ml-3 text-base font-medium text-zinc-500">
                              — {integration.phone_number_display}
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-zinc-600 mt-2 font-medium">
                          {t('createdLabel')} {new Date(integration.created_at).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={integration.status === 'active' ? 'success' : integration.status === 'error' ? 'destructive' : 'secondary'} size="lg" className="shadow-sm font-bold">
                        {getStatusText(integration.status)}
                      </Badge>
                      {integration.provider === 'whatsapp' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openWhatsAppModal(integration)}
                          title={t('providers.whatsapp.action.update')}
                          className="hover:bg-primary/10"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this integration?')) {
                            handleDeleteIntegration(integration.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors">
            <CardContent className="p-16 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-inner">
                <Plug className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">
                {t('active.empty.title')}
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto text-base">
                {t('active.empty.description')}
              </p>
              <div className="flex justify-center gap-3 flex-wrap">
                <Button onClick={() => setShowShopifyModal(true)} size="lg" className="shadow-lg">
                  <ShoppingBag className="w-5 h-5 mr-2" />
                  {t('modals.shopify.title')}
                </Button>
                <Button variant="outline" onClick={() => setShowCsvModal(true)} size="lg">
                  <Upload className="w-5 h-5 mr-2" />
                  {t('modals.csv.title')}
                </Button>
                <Button variant="outline" onClick={() => setShowManualModal(true)} size="lg">
                  <Code className="w-5 h-5 mr-2" />
                  {t('modals.manual.title')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Shopify Modal */}
      {showShopifyModal && (
        <div className="modal-overlay">
          <Card className="max-w-md w-full animate-slide-up shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('modals.shopify.title')}</CardTitle>
                <button
                  onClick={() => !connectingShopify && setShowShopifyModal(false)}
                  disabled={connectingShopify}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="form-label">
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
                <p className="form-helper">
                  {t('modals.shopify.helper')}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowShopifyModal(false)} disabled={connectingShopify}>
                  {t('modals.shopify.cancel')}
                </Button>
                <Button className="flex-1" onClick={handleConnectShopify} disabled={connectingShopify}>
                  {connectingShopify && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {connectingShopify ? t('modals.shopify.connecting') : t('modals.shopify.connect')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CSV Modal */}
      {showCsvModal && (
        <div className="modal-overlay">
          <Card className="max-w-md w-full animate-slide-up shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('modals.csv.title')}</CardTitle>
                <button
                  onClick={() => !importing && setShowCsvModal(false)}
                  disabled={importing}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="form-label">
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

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCsvModal(false)} disabled={importing}>
                  {t('modals.csv.cancel')}
                </Button>
                <Button className="flex-1" onClick={handleImportCsv} disabled={importing || !csvFile}>
                  {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {importing ? t('modals.csv.importing') : t('modals.csv.import')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Manual Integration Modal */}
      {showManualModal && (
        <div className="modal-overlay">
          <Card className="max-w-2xl w-full animate-slide-up shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('modals.manual.title')}</CardTitle>
                <button
                  onClick={() => setShowManualModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <p className="form-label">{t('modals.manual.apiKeyLabel')}</p>
                  <code className="block bg-muted px-3 py-2 rounded border text-sm font-mono">
                    {apiKeys[0]?.hash.substring(0, 20)}...
                  </code>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowManualModal(false)}>
                  {t('modals.manual.cancel')}
                </Button>
                <Button className="flex-1" onClick={handleCreateManualIntegration}>
                  {t('modals.manual.create')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* WhatsApp Business Modal */}
      {showWhatsAppModal && (
        <div className="modal-overlay">
          <Card className="max-w-md w-full animate-slide-up shadow-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {editingWhatsAppId ? t('modals.whatsapp.updateTitle') : t('modals.whatsapp.title')}
                </CardTitle>
                <button
                  onClick={() => !connectingWhatsApp && setShowWhatsAppModal(false)}
                  disabled={connectingWhatsApp}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t('modals.whatsapp.description')}
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="form-label">{t('modals.whatsapp.displayLabel')}</label>
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
                  <label className="form-label">{t('modals.whatsapp.phoneIdLabel')}</label>
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
                  <label className="form-label">{t('modals.whatsapp.tokenLabel')}</label>
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
                  <label className="form-label">{t('modals.whatsapp.verifyLabel')}</label>
                  <Input
                    type="text"
                    value={whatsappVerifyToken}
                    onChange={(e) => setWhatsappVerifyToken(e.target.value)}
                    placeholder={t('modals.whatsapp.verifyPlaceholder')}
                    disabled={connectingWhatsApp}
                    className="h-11 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowWhatsAppModal(false)} disabled={connectingWhatsApp}>
                  {t('modals.whatsapp.cancel')}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSaveWhatsApp}
                  disabled={connectingWhatsApp || !whatsappPhoneNumberId.trim() || !whatsappAccessToken.trim() || !whatsappVerifyToken.trim()}
                >
                  {connectingWhatsApp ? t('modals.whatsapp.saving') : editingWhatsAppId ? t('modals.whatsapp.update') : t('modals.whatsapp.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}