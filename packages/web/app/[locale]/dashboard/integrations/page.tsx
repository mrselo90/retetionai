'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest, getApiUrl, getApiBaseUrlForDisplay } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Badge as PolarisBadge, Banner, BlockStack, Box, Button as PolarisButton, Card as PolarisCard, InlineStack, Layout, Page, Select, SkeletonPage, Text, TextField } from '@shopify/polaris';
import { Loader2, X, Trash2, Pencil, Plug, Upload, Code, MessageSquare, ShoppingBag, MessageCircle } from 'lucide-react';
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
  whatsapp_provider?: 'meta' | 'twilio';
  from_number?: string;
  /** Shopify store domain (e.g. store.myshopify.com) when provider is shopify */
  shop_domain?: string;
}

/** Manual integration is not in plan for now. */
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
  const [whatsappProviderType, setWhatsappProviderType] = useState<'meta' | 'twilio'>('twilio');
  const [whatsappPhoneDisplay, setWhatsappPhoneDisplay] = useState('');
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('');
  const [whatsappAccessToken, setWhatsappAccessToken] = useState('');
  const [whatsappVerifyToken, setWhatsappVerifyToken] = useState('');
  const [whatsappTwilioAccountSid, setWhatsappTwilioAccountSid] = useState('');
  const [whatsappTwilioAuthToken, setWhatsappTwilioAuthToken] = useState('');
  const [whatsappTwilioFromNumber, setWhatsappTwilioFromNumber] = useState('');
  const [editingWhatsAppId, setEditingWhatsAppId] = useState<string | null>(null);
  const [platformWhatsApp, setPlatformWhatsApp] = useState<string>('');

  useEffect(() => {
    loadIntegrations();
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
      setWhatsappProviderType(integration.whatsapp_provider === 'meta' ? 'meta' : 'twilio');
      setEditingWhatsAppId(integration.id);
      setWhatsappPhoneDisplay(integration.phone_number_display || '');
      setWhatsappTwilioFromNumber(integration.from_number || '');
      setWhatsappPhoneNumberId('');
      setWhatsappAccessToken('');
      setWhatsappVerifyToken('');
      setWhatsappTwilioAccountSid('');
      setWhatsappTwilioAuthToken('');
    } else {
      setWhatsappProviderType('twilio');
      setEditingWhatsAppId(null);
      setWhatsappPhoneDisplay('');
      setWhatsappTwilioFromNumber('');
      setWhatsappPhoneNumberId('');
      setWhatsappAccessToken('');
      setWhatsappVerifyToken('');
      setWhatsappTwilioAccountSid('');
      setWhatsappTwilioAuthToken('');
    }
    setShowWhatsAppModal(true);
  };

  const handleSaveWhatsApp = async () => {
    const isTwilio = whatsappProviderType === 'twilio';
    if (
      (isTwilio && (!whatsappTwilioAccountSid.trim() || !whatsappTwilioAuthToken.trim() || !whatsappTwilioFromNumber.trim())) ||
      (!isTwilio && (!whatsappPhoneNumberId.trim() || !whatsappAccessToken.trim() || !whatsappVerifyToken.trim()))
    ) {
      toast.warning(t('toasts.missingWhatsapp.title'), t('toasts.missingWhatsapp.message'));
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setConnectingWhatsApp(true);
      const auth_data = isTwilio
        ? {
            wa_provider: 'twilio' as const,
            account_sid: whatsappTwilioAccountSid.trim(),
            auth_token: whatsappTwilioAuthToken.trim(),
            from_number: whatsappTwilioFromNumber.trim(),
            phone_number_display: whatsappPhoneDisplay.trim() || undefined,
          }
        : {
            wa_provider: 'meta' as const,
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
      setWhatsappProviderType('twilio');
      setWhatsappPhoneDisplay('');
      setWhatsappPhoneNumberId('');
      setWhatsappAccessToken('');
      setWhatsappVerifyToken('');
      setWhatsappTwilioAccountSid('');
      setWhatsappTwilioAuthToken('');
      setWhatsappTwilioFromNumber('');
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
      <SkeletonPage title={t('title')}>
        <Layout>
          <Layout.Section>
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
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page title={t('title')} subtitle={t('description')} fullWidth>
      <Layout>
        <Layout.Section>
    <div className="space-y-6 animate-fade-in pb-8 font-sans text-[#303030]">
      <PolarisCard>
        <Box padding="400">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">{t('title')}</Text>
            <Text as="p" tone="subdued">{t('description')}</Text>
          </BlockStack>
        </Box>
      </PolarisCard>

      {/* Platform support number as an Alert Banner */}
      {platformWhatsApp && (
        <PolarisCard>
          <Box padding="300">
            <Banner tone="info" title={t('platformSupport.title')}>
              <p>{t('platformSupport.subtitle')}</p>
              <div className="mt-3">
                <a
                  href={`https://wa.me/${platformWhatsApp.replace(/^\+/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-medium"
                >
                  {platformWhatsApp}
                </a>
              </div>
            </Banner>
          </Box>
        </PolarisCard>
      )}

      {/* Discover Integrations (Polaris List Style) */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">Discover integrations</h2>
        <PolarisCard padding="0">
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
                    {hasShopify && <PolarisBadge tone="success">Connected</PolarisBadge>}
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
                <PolarisButton
                  onClick={() => setShowShopifyModal(true)}
                  variant={hasShopify ? 'secondary' : 'primary'}
                  size="slim"
                >
                  {hasShopify ? t('providers.shopify.action.connected') : t('providers.shopify.action.connect')}
                </PolarisButton>
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
                    {hasWhatsApp && <PolarisBadge tone="success">Connected</PolarisBadge>}
                    </div>
                  <p className="text-sm text-[#616161] mt-0.5 max-w-[400px]">
                    {hasWhatsApp ? t('providers.whatsapp.connected') : t('providers.whatsapp.description')}
                  </p>
                </div>
              </div>
              <div>
                <PolarisButton
                  onClick={() => openWhatsAppModal(integrations.find((i) => i.provider === 'whatsapp'))}
                  variant={hasWhatsApp ? 'secondary' : 'primary'}
                  size="slim"
                >
                  {hasWhatsApp ? t('providers.whatsapp.action.update') : t('providers.whatsapp.action.connect')}
                </PolarisButton>
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
                <PolarisButton
                  onClick={() => setShowCsvModal(true)}
                  variant="secondary"
                  size="slim"
                >
                  {t('providers.csv.action')}
                </PolarisButton>
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
                      {hasManual && <PolarisBadge tone="info">Connected</PolarisBadge>}
                    </div>
                    <p className="text-sm text-[#616161] mt-0.5 max-w-[400px]">
                      {hasManual ? t('providers.manual.connected') : t('providers.manual.description')}
                    </p>
                  </div>
                </div>
                <div>
                  <PolarisButton
                    onClick={() => setShowManualModal(true)}
                    variant="secondary"
                    size="slim"
                  >
                    {hasManual ? t('providers.manual.action.connected') : t('providers.manual.action.setup')}
                  </PolarisButton>
                </div>
              </div>
            )}
          </div>
        </PolarisCard>
      </div>

      {/* Active Integrations */}
      <div className="pt-8">
        <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">{t('active.title')}</h2>
        {integrations.length > 0 ? (
          <PolarisCard padding="0">
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
                      <PolarisBadge tone={integration.status === 'active' ? 'success' : integration.status === 'error' ? 'critical' : 'attention'}>
                        {getStatusText(integration.status)}
                      </PolarisBadge>
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
          </PolarisCard>
        ) : (
          <PolarisCard>
            <Box padding="800">
              <BlockStack gap="300" inlineAlign="center">
                <Box background="bg-surface-secondary" borderRadius="300" padding="300">
                  <Plug className="w-6 h-6 text-zinc-500" />
                </Box>
                <Text as="h3" variant="headingSm">{t('active.empty.title')}</Text>
                <Text as="p" tone="subdued" alignment="center">
                  No integrations are currently active. Discover apps above to automate your workflows.
                </Text>
              </BlockStack>
            </Box>
          </PolarisCard>
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
          <Box paddingBlockStart="200">
          <BlockStack gap="400">
            <TextField
              label={t('modals.shopify.shopLabel')}
              value={shopifyShop}
              onChange={setShopifyShop}
              placeholder={t('modals.shopify.shopPlaceholder')}
              disabled={connectingShopify}
              autoComplete="off"
              helpText={t('modals.shopify.helper')}
            />

            <DialogFooter className="gap-3 sm:gap-3">
              <PolarisButton
                onClick={() => setShowShopifyModal(false)}
                disabled={connectingShopify}
                variant="secondary"
              >
                {t('modals.shopify.cancel')}
              </PolarisButton>
              <PolarisButton
                onClick={handleConnectShopify}
                disabled={connectingShopify}
                variant="primary"
                loading={connectingShopify}
              >
                {connectingShopify ? t('modals.shopify.connecting') : t('modals.shopify.connect')}
              </PolarisButton>
            </DialogFooter>
          </BlockStack>
          </Box>
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
          <Box paddingBlockStart="200">
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" fontWeight="medium">
                {t('modals.csv.fileLabel')}
              </Text>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                disabled={importing}
                className="w-full px-3 py-2 rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 text-sm"
              />
              {csvFile && (
                <Text as="p" variant="bodySm" tone="success">
                  {t('modals.csv.fileSelected', { name: csvFile.name })}
                </Text>
              )}
            </BlockStack>

            <Box background="bg-surface-secondary" borderWidth="025" borderColor="border" borderRadius="300" padding="300">
              <Text as="p" variant="bodySm" tone="subdued">
                <strong>{t('modals.csv.format')}</strong>
              </Text>
            </Box>

            <DialogFooter className="gap-3 sm:gap-3">
              <PolarisButton
                onClick={() => setShowCsvModal(false)}
                disabled={importing}
                variant="secondary"
              >
                {t('modals.csv.cancel')}
              </PolarisButton>
              <PolarisButton
                onClick={handleImportCsv}
                disabled={importing || !csvFile}
                variant="primary"
                loading={importing}
              >
                {importing ? t('modals.csv.importing') : t('modals.csv.import')}
              </PolarisButton>
            </DialogFooter>
          </BlockStack>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Manual Integration Modal */}
      <Dialog open={showManualModal} onOpenChange={setShowManualModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('modals.manual.title')}</DialogTitle>
          </DialogHeader>
          <Box paddingBlockStart="200">
          <BlockStack gap="400">
            <Box padding="300" borderWidth="025" borderColor="border" borderRadius="300" background="bg-surface-secondary">
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="medium">{t('modals.manual.webhookLabel')}</Text>
                <Box padding="200" borderWidth="025" borderColor="border" borderRadius="200" background="bg-surface">
                  <code className="text-sm">{getApiBaseUrlForDisplay()}/api/webhooks/manual</code>
                </Box>
                <Text as="p" variant="bodySm" tone="subdued">{t('modals.manual.webhookHelper')}</Text>
              </BlockStack>
            </Box>

            <DialogFooter className="gap-3 sm:gap-3">
              <PolarisButton
                onClick={() => setShowManualModal(false)}
                variant="secondary"
              >
                {t('modals.manual.cancel')}
              </PolarisButton>
              <PolarisButton
                onClick={handleCreateManualIntegration}
                variant="primary"
              >
                {t('modals.manual.create')}
              </PolarisButton>
            </DialogFooter>
          </BlockStack>
          </Box>
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
          <Box paddingBlockStart="200">
          <BlockStack gap="400">
            <TextField
              label={t('modals.whatsapp.displayLabel')}
              value={whatsappPhoneDisplay}
              onChange={setWhatsappPhoneDisplay}
              placeholder={t('modals.whatsapp.displayPlaceholder')}
              disabled={connectingWhatsApp}
              autoComplete="off"
            />
            <Select
              label="WhatsApp Provider"
              options={[
                { label: 'Twilio (Recommended)', value: 'twilio' },
                { label: 'Meta Cloud API', value: 'meta' },
              ]}
              value={whatsappProviderType}
              onChange={(value) => setWhatsappProviderType(value as 'meta' | 'twilio')}
              disabled={connectingWhatsApp}
            />
            {whatsappProviderType === 'twilio' ? (
              <>
                <TextField
                  label="Twilio Account SID"
                  value={whatsappTwilioAccountSid}
                  onChange={setWhatsappTwilioAccountSid}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  disabled={connectingWhatsApp}
                  autoComplete="off"
                />
                <TextField
                  label="Twilio Auth Token"
                  type="password"
                  value={whatsappTwilioAuthToken}
                  onChange={setWhatsappTwilioAuthToken}
                  placeholder="Twilio Auth Token"
                  disabled={connectingWhatsApp}
                  autoComplete="off"
                />
                <TextField
                  label="Twilio WhatsApp From Number"
                  value={whatsappTwilioFromNumber}
                  onChange={setWhatsappTwilioFromNumber}
                  placeholder="+14155238886"
                  helpText="Use the sandbox number during testing, then switch to your approved Twilio WhatsApp sender."
                  disabled={connectingWhatsApp}
                  autoComplete="off"
                />
              </>
            ) : (
              <>
                <TextField
                  label={t('modals.whatsapp.phoneIdLabel')}
                  value={whatsappPhoneNumberId}
                  onChange={setWhatsappPhoneNumberId}
                  placeholder={t('modals.whatsapp.phoneIdPlaceholder')}
                  disabled={connectingWhatsApp}
                  autoComplete="off"
                />
                <TextField
                  label={t('modals.whatsapp.tokenLabel')}
                  type="password"
                  value={whatsappAccessToken}
                  onChange={setWhatsappAccessToken}
                  placeholder={t('modals.whatsapp.tokenPlaceholder')}
                  disabled={connectingWhatsApp}
                  autoComplete="off"
                />
                <TextField
                  label={t('modals.whatsapp.verifyLabel')}
                  value={whatsappVerifyToken}
                  onChange={setWhatsappVerifyToken}
                  placeholder={t('modals.whatsapp.verifyPlaceholder')}
                  disabled={connectingWhatsApp}
                  autoComplete="off"
                />
              </>
            )}

            <DialogFooter className="gap-3 sm:gap-3">
              <PolarisButton
                onClick={() => setShowWhatsAppModal(false)}
                disabled={connectingWhatsApp}
                variant="secondary"
              >
                {t('modals.whatsapp.cancel')}
              </PolarisButton>
              <PolarisButton
                onClick={handleSaveWhatsApp}
                disabled={
                  connectingWhatsApp ||
                  (whatsappProviderType === 'twilio'
                    ? !whatsappTwilioAccountSid.trim() || !whatsappTwilioAuthToken.trim() || !whatsappTwilioFromNumber.trim()
                    : !whatsappPhoneNumberId.trim() || !whatsappAccessToken.trim() || !whatsappVerifyToken.trim())
                }
                variant="primary"
                loading={connectingWhatsApp}
              >
                {connectingWhatsApp ? t('modals.whatsapp.saving') : editingWhatsAppId ? t('modals.whatsapp.update') : t('modals.whatsapp.save')}
              </PolarisButton>
            </DialogFooter>
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
