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
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-3">
          <div className="h-10 w-48 bg-zinc-200 rounded-xl animate-pulse" />
          <div className="h-5 w-96 bg-zinc-100 rounded-lg animate-pulse" />
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
        <Card className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-3xl">💬</div>
            <div>
              <p className="font-semibold text-zinc-900">{t('platformSupport.title')}</p>
              <p className="text-sm text-zinc-600">{t('platformSupport.subtitle')}</p>
            </div>
          </div>
          <a
            href={`https://wa.me/${platformWhatsApp.replace(/^\+/, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-success text-success-foreground rounded-lg font-semibold text-sm whitespace-nowrap"
          >
            {platformWhatsApp}
          </a>
        </Card>
      )}

      {/* Integration Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* WhatsApp Business */}
        <Card className={`p-5 ${hasWhatsApp ? 'border-success/30 bg-success/5' : ''}`}>
          <div className="text-center relative">
            {hasWhatsApp && (
              <Badge variant="success" size="sm" className="absolute -top-1 -right-1">
                ✓ {t('active.connected')}
              </Badge>
            )}
            <div className="text-5xl mb-4">💬</div>
            <h3 className="text-base font-semibold text-zinc-900 mb-2">{t('providers.whatsapp.title')}</h3>
            <p className="text-sm text-zinc-600 mb-5 min-h-[40px]">
              {hasWhatsApp ? t('providers.whatsapp.connected') : t('providers.whatsapp.description')}
            </p>
            <Button
              onClick={() => openWhatsAppModal(integrations.find((i) => i.provider === 'whatsapp'))}
              className="w-full"
              variant={hasWhatsApp ? 'outline' : 'default'}
            >
              {hasWhatsApp ? t('providers.whatsapp.action.update') : t('providers.whatsapp.action.connect')}
            </Button>
          </div>
        </Card>

        {/* Shopify */}
        <Card className={`p-5 ${hasShopify ? 'border-success/30 bg-success/5' : ''}`}>
          <div className="text-center relative">
            {hasShopify && (
              <Badge variant="success" size="sm" className="absolute -top-1 -right-1">
                ✓ {t('active.connected')}
              </Badge>
            )}
            <div className="text-5xl mb-4">🛍️</div>
            <h3 className="text-base font-semibold text-zinc-900 mb-2">{t('providers.shopify.title')}</h3>
            <p className="text-sm text-zinc-600 mb-5 min-h-[40px]">
              {hasShopify
                ? (integrations.find((i) => i.provider === 'shopify')?.shop_domain
                  ? `${t('active.storeLabel')}: ${integrations.find((i) => i.provider === 'shopify')?.shop_domain}`
                  : t('providers.shopify.connected'))
                : t('providers.shopify.description')}
            </p>
            <Button
              onClick={() => setShowShopifyModal(true)}
              variant={hasShopify ? 'outline' : 'default'}
              className="w-full"
            >
              {hasShopify ? t('providers.shopify.action.connected') : t('providers.shopify.action.connect')}
            </Button>
          </div>
        </Card>

        {/* CSV Import */}
        <Card className="p-5">
          <div className="text-center">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-base font-semibold text-zinc-900 mb-2">{t('providers.csv.title')}</h3>
            <p className="text-sm text-zinc-600 mb-5 min-h-[40px]">
              {t('providers.csv.description')}
            </p>
            <Button
              onClick={() => setShowCsvModal(true)}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {t('providers.csv.action')}
            </Button>
          </div>
        </Card>

        {ENABLE_MANUAL_INTEGRATION && (
          /* Manual / API - not in plan for now */
          <Card className={`p-5 ${hasManual ? 'border-primary/30 bg-primary/5' : ''}`}>
            <div className="text-center relative">
              {hasManual && (
                <Badge variant="secondary" size="sm" className="absolute -top-1 -right-1">
                  ✓ {t('active.connected')}
                </Badge>
              )}
              <div className="text-5xl mb-4">📝</div>
              <h3 className="text-base font-semibold text-zinc-900 mb-2">{t('providers.manual.title')}</h3>
              <p className="text-sm text-zinc-600 mb-5 min-h-[40px]">
                {hasManual ? t('providers.manual.connected') : t('providers.manual.description')}
              </p>
              <Button
                onClick={() => setShowManualModal(true)}
                variant={hasManual ? 'outline' : 'default'}
                className="w-full"
              >
                <Code className="w-4 h-4 mr-2" />
                {hasManual ? t('providers.manual.action.connected') : t('providers.manual.action.setup')}
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Active Integrations */}
      <div className="pt-2">
        <h2 className="text-2xl font-extrabold tracking-tight mb-4">{t('active.title')}</h2>
        {integrations.length > 0 ? (
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {integrations.map((integration, idx) => (
                <div key={integration.id} className="p-7 hover:bg-gradient-to-r hover:from-muted/30 hover:to-transparent transition-all group" style={{ animationDelay: `${idx * 50}ms` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="text-5xl ">{getProviderIcon(integration.provider)}</div>
                      <div>
                        <h3 className="text-xl font-bold text-zinc-900">
                          {getProviderName(integration.provider)}
                          {integration.provider === 'whatsapp' && integration.phone_number_display && (
                            <span className="ml-3 text-base font-medium text-zinc-500">
                              — {integration.phone_number_display}
                            </span>
                          )}
                          {integration.provider === 'shopify' && integration.shop_domain && (
                            <span className="ml-3 text-base font-medium text-zinc-500">
                              — {integration.shop_domain}
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
                          if (confirm(t('active.deleteConfirm'))) {
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
          <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center min-h-[400px] py-12">
            <CardContent className="p-0 flex flex-col items-center justify-center text-center w-full">
              <div className="w-20 h-20 mb-6 rounded-2xl bg-zinc-100 flex items-center justify-center ">
                <Plug className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">
                {t('active.empty.title')}
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md text-base text-center">
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
                {ENABLE_MANUAL_INTEGRATION && (
                  <Button variant="outline" onClick={() => setShowManualModal(true)} size="lg">
                    <Code className="w-5 h-5 mr-2" />
                    {t('modals.manual.title')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
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

            <DialogFooter className="gap-3 sm:gap-0">
              <Button variant="outline" onClick={() => setShowShopifyModal(false)} disabled={connectingShopify}>
                {t('modals.shopify.cancel')}
              </Button>
              <Button onClick={handleConnectShopify} disabled={connectingShopify}>
                {connectingShopify && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {connectingShopify ? t('modals.shopify.connecting') : t('modals.shopify.connect')}
              </Button>
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

            <DialogFooter className="gap-3 sm:gap-0">
              <Button variant="outline" onClick={() => setShowCsvModal(false)} disabled={importing}>
                {t('modals.csv.cancel')}
              </Button>
              <Button onClick={handleImportCsv} disabled={importing || !csvFile}>
                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {importing ? t('modals.csv.importing') : t('modals.csv.import')}
              </Button>
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

            <DialogFooter className="gap-3 sm:gap-0">
              <Button variant="outline" onClick={() => setShowManualModal(false)}>
                {t('modals.manual.cancel')}
              </Button>
              <Button onClick={handleCreateManualIntegration}>
                {t('modals.manual.create')}
              </Button>
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

            <DialogFooter className="gap-3 sm:gap-0">
              <Button variant="outline" onClick={() => setShowWhatsAppModal(false)} disabled={connectingWhatsApp}>
                {t('modals.whatsapp.cancel')}
              </Button>
              <Button
                onClick={handleSaveWhatsApp}
                disabled={connectingWhatsApp || !whatsappPhoneNumberId.trim() || !whatsappAccessToken.trim() || !whatsappVerifyToken.trim()}
              >
                {connectingWhatsApp ? t('modals.whatsapp.saving') : editingWhatsAppId ? t('modals.whatsapp.update') : t('modals.whatsapp.save')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}