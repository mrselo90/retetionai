'use client';

import { useEffect, useId, useState } from 'react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest, getApiUrl, getApiBaseUrlForDisplay } from '@/lib/api';
import { toast } from '@/lib/toast';
import { PageFeedbackCard } from '@/components/ui/PageFeedbackCard';
import { Badge, EmptyState } from '@/components/recete';
import type { BadgeTone } from '@/components/recete';
import { Trash2, Pencil, Plug, Upload, Code, ShoppingBag, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';

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

interface PageFeedbackState {
  tone: 'success' | 'critical' | 'info';
  title: string;
  message: string;
  actionLabel?: string;
  targetId?: string;
}

/** Manual integration is not in plan for now. */
const ENABLE_MANUAL_INTEGRATION = false;

export default function IntegrationsPage() {
  const t = useTranslations('Integrations');
  const fieldPrefix = useId();
  const shopifyTitleId = useId();
  const csvTitleId = useId();
  const manualTitleId = useId();
  const whatsappTitleId = useId();
  const { confirm, ConfirmDialogNode } = useConfirm();
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
  const [pageFeedback, setPageFeedback] = useState<PageFeedbackState | null>(null);

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const response = await authenticatedRequest<{ integrations: Integration[] }>(
        '/api/integrations',
        session.access_token
      );
      setIntegrations(response.integrations);
    } catch (err) {
      console.error('Failed to load integrations:', err);
      if (getErrorStatus(err) === 401) {
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
    } catch (err) {
      console.error('Failed to connect Shopify:', err);
      toast.error(
        t('toasts.shopifyError.title'),
        getErrorMessage(err, t('toasts.shopifyError.message'))
      );
      setConnectingShopify(false);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    toast.info(
      t('toasts.fileSelected.title'),
      t('toasts.fileSelected.message', { name: file.name })
    );
  };

  const handleImportCsv = async () => {
    if (!csvFile) {
      toast.warning(t('toasts.missingFile.title'), t('toasts.missingFile.message'));
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      setImporting(true);

      // The import endpoint is scoped to an integration and verifies it belongs
      // to the caller. Reuse the merchant's manual integration, creating one on
      // first import — without this there is no non-Shopify path to get orders in.
      let targetIntegrationId = integrations.find((item) => item.provider === 'manual')?.id;

      if (!targetIntegrationId) {
        const created = await authenticatedRequest<{ integration?: { id?: string } }>(
          '/api/integrations',
          session.access_token,
          {
            method: 'POST',
            body: JSON.stringify({ provider: 'manual', auth_type: 'api_key', auth_data: {} }),
          }
        );
        targetIntegrationId = created?.integration?.id;
      }

      if (!targetIntegrationId) {
        throw new Error('Could not resolve an integration to import into.');
      }

      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch(
        getApiUrl(`/api/integrations/${targetIntegrationId}/import/csv`),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error || `CSV import failed (${response.status})`);
      }

      // Response shape is { parse: {...}, import: { inserted, duplicates, failed } }.
      // The previous code read result.imported, which does not exist.
      const result = await response.json();
      const inserted = Number(result?.import?.inserted ?? 0);
      const duplicates = Number(result?.import?.duplicates ?? 0);
      const invalidRows = Number(result?.parse?.invalidRows ?? 0);

      toast.success(
        t('toasts.importSuccess.title'),
        t('toasts.importSuccess.message', { count: inserted })
      );
      setPageFeedback({
        tone: invalidRows > 0 || duplicates > 0 ? 'info' : 'success',
        title: t('feedback.importSavedTitle'),
        message: t('feedback.importSavedMessage', { count: inserted }),
        actionLabel: t('feedback.reviewActive'),
        targetId: 'active-integrations',
      });

      setShowCsvModal(false);
      setCsvFile(null);
      await loadIntegrations();
    } catch (err) {
      console.error('Failed to import CSV:', err);
      setPageFeedback({
        tone: 'critical',
        title: t('feedback.importErrorTitle'),
        message: getErrorMessage(err, t('toasts.importError.message')),
        actionLabel: t('feedback.reviewDiscover'),
        targetId: 'discover-integrations',
      });
      toast.error(
        t('toasts.importError.title'),
        getErrorMessage(err, t('toasts.importError.message'))
      );
    } finally {
      setImporting(false);
    }
  };

  const handleCreateManualIntegration = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      await authenticatedRequest('/api/integrations', session.access_token, {
        method: 'POST',
        body: JSON.stringify({
          provider: 'manual',
          auth_type: 'api_key',
          auth_data: {},
        }),
      });

      toast.success(t('toasts.manualSuccess.title'), t('toasts.manualSuccess.message'));
      setPageFeedback({
        tone: 'success',
        title: t('feedback.manualSavedTitle'),
        message: t('feedback.manualSavedMessage'),
        actionLabel: t('feedback.reviewActive'),
        targetId: 'active-integrations',
      });
      setShowManualModal(false);
      await loadIntegrations();
    } catch (err) {
      console.error('Failed to create manual integration:', err);
      setPageFeedback({
        tone: 'critical',
        title: t('feedback.manualErrorTitle'),
        message: getErrorMessage(err, t('toasts.manualError.message')),
        actionLabel: t('feedback.reviewDiscover'),
        targetId: 'discover-integrations',
      });
      toast.error(
        t('toasts.manualError.title'),
        getErrorMessage(err, t('toasts.manualError.message'))
      );
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
      (isTwilio &&
        (!whatsappTwilioAccountSid.trim() ||
          !whatsappTwilioAuthToken.trim() ||
          !whatsappTwilioFromNumber.trim())) ||
      (!isTwilio &&
        (!whatsappPhoneNumberId.trim() ||
          !whatsappAccessToken.trim() ||
          !whatsappVerifyToken.trim()))
    ) {
      toast.warning(t('toasts.missingWhatsapp.title'), t('toasts.missingWhatsapp.message'));
      return;
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
        await authenticatedRequest(`/api/integrations/${editingWhatsAppId}`, session.access_token, {
          method: 'PUT',
          body: JSON.stringify({ auth_data, status: 'active' }),
        });
        toast.success(
          t('toasts.whatsappUpdateSuccess.title'),
          t('toasts.whatsappUpdateSuccess.message')
        );
        setPageFeedback({
          tone: 'success',
          title: t('feedback.whatsappUpdatedTitle'),
          message: t('feedback.whatsappUpdatedMessage'),
          actionLabel: t('feedback.reviewActive'),
          targetId: 'active-integrations',
        });
      } else {
        await authenticatedRequest('/api/integrations', session.access_token, {
          method: 'POST',
          body: JSON.stringify({
            provider: 'whatsapp',
            auth_type: 'token',
            auth_data,
          }),
        });
        toast.success(t('toasts.whatsappSuccess.title'), t('toasts.whatsappSuccess.message'));
        setPageFeedback({
          tone: 'success',
          title: t('feedback.whatsappConnectedTitle'),
          message: t('feedback.whatsappConnectedMessage'),
          actionLabel: t('feedback.reviewActive'),
          targetId: 'active-integrations',
        });
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
    } catch (err) {
      setPageFeedback({
        tone: 'critical',
        title: t('feedback.whatsappErrorTitle'),
        message: getErrorMessage(err, t('toasts.whatsappError.message')),
        actionLabel: t('feedback.reviewDiscover'),
        targetId: 'discover-integrations',
      });
      toast.error(
        t('toasts.whatsappError.title'),
        getErrorMessage(err, t('toasts.whatsappError.message'))
      );
    } finally {
      setConnectingWhatsApp(false);
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      await authenticatedRequest(`/api/integrations/${integrationId}`, session.access_token, {
        method: 'DELETE',
      });

      toast.success(t('toasts.deleteSuccess.title'), t('toasts.deleteSuccess.message'));
      setPageFeedback({
        tone: 'success',
        title: t('feedback.integrationRemovedTitle'),
        message: t('feedback.integrationRemovedMessage'),
        actionLabel: t('feedback.reviewDiscover'),
        targetId: 'discover-integrations',
      });
      await loadIntegrations();
    } catch (err) {
      console.error('Failed to delete integration:', err);
      setPageFeedback({
        tone: 'critical',
        title: t('feedback.deleteErrorTitle'),
        message: getErrorMessage(err, t('toasts.deleteError.message')),
        actionLabel: t('feedback.reviewActive'),
        targetId: 'active-integrations',
      });
      toast.error(
        t('toasts.deleteError.title'),
        getErrorMessage(err, t('toasts.deleteError.message'))
      );
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

  const STATUS_TONE: Record<Integration['status'], BadgeTone> = {
    active: 'success',
    error: 'danger',
    pending: 'warning',
    disabled: 'neutral',
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
      <div className="d-page">
        <div className="d-page-header" role="status" aria-live="polite" aria-label={t('loading')}>
          <div className="r-skeleton" style={{ height: 26, width: 200, marginBottom: 8 }} />
          <div className="r-skeleton" style={{ height: 16, width: 340 }} />
        </div>
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="r-skeleton"
            style={{ height: 100, marginBottom: 16 }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="d-page">
      {ConfirmDialogNode}

      <div className="d-page-header">
        <h1 className="r-page-title">{t('title')}</h1>
        <p className="r-page-sub">{t('description')}</p>
      </div>

      {pageFeedback ? (
        <div style={{ marginBottom: 16 }}>
          <PageFeedbackCard
            tone={pageFeedback.tone}
            title={pageFeedback.title}
            message={pageFeedback.message}
            actionLabel={pageFeedback.actionLabel}
            onAction={
              pageFeedback.targetId
                ? () => {
                    document
                      .getElementById(pageFeedback.targetId!)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                : undefined
            }
            dismissLabel={t('feedback.dismiss')}
            onDismiss={() => setPageFeedback(null)}
          />
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {platformWhatsApp ? (
          <div className="r-alert r-alert-info">
            <div style={{ minWidth: 0 }}>
              <p className="r-alert-title">{t('platformSupport.title')}</p>
              <p className="r-alert-body">{t('platformSupport.subtitle')}</p>
              <a
                href={`https://wa.me/${platformWhatsApp.replace(/^\+/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="r-btn r-btn-secondary r-btn-sm"
              >
                {platformWhatsApp}
              </a>
            </div>
          </div>
        ) : null}

        <div id="discover-integrations">
          <p className="r-eyebrow" style={{ display: 'block', marginBottom: 10 }}>
            {t('discoverTitle')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Shopify */}
            <div
              className="r-card"
              style={{
                padding: 'var(--r-space-7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--r-radius-md)',
                    background: '#95BF4720',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ShoppingBag size={18} color="#5C8A2A" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="r-table-strong">{t('providers.shopify.title')}</span>
                    {hasShopify ? <Badge tone="success">{t('active.connected')}</Badge> : null}
                  </div>
                  <p className="r-hint" style={{ marginTop: 3 }}>
                    {hasShopify
                      ? integrations.find((i) => i.provider === 'shopify')?.shop_domain
                        ? `${t('active.storeLabel')}: ${integrations.find((i) => i.provider === 'shopify')?.shop_domain}`
                        : t('providers.shopify.connected')
                      : t('providers.shopify.description')}
                  </p>
                </div>
              </div>
              <button
                className={
                  hasShopify ? 'r-btn r-btn-secondary r-btn-sm' : 'r-btn r-btn-primary r-btn-sm'
                }
                onClick={() => setShowShopifyModal(true)}
              >
                {hasShopify
                  ? t('providers.shopify.action.connected')
                  : t('providers.shopify.action.connect')}
              </button>
            </div>

            {/* WhatsApp Business */}
            <div
              className="r-card"
              style={{
                padding: 'var(--r-space-7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--r-radius-md)',
                    background: '#25D36620',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <MessageCircle size={18} color="#128C53" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="r-table-strong">{t('providers.whatsapp.title')}</span>
                    {hasWhatsApp ? <Badge tone="success">{t('active.connected')}</Badge> : null}
                  </div>
                  <p className="r-hint" style={{ marginTop: 3 }}>
                    {hasWhatsApp
                      ? t('providers.whatsapp.connected')
                      : t('providers.whatsapp.description')}
                  </p>
                </div>
              </div>
              <button
                className={
                  hasWhatsApp ? 'r-btn r-btn-secondary r-btn-sm' : 'r-btn r-btn-primary r-btn-sm'
                }
                onClick={() =>
                  openWhatsAppModal(integrations.find((i) => i.provider === 'whatsapp'))
                }
              >
                {hasWhatsApp
                  ? t('providers.whatsapp.action.update')
                  : t('providers.whatsapp.action.connect')}
              </button>
            </div>

            {/* CSV Import */}
            <div
              className="r-card"
              style={{
                padding: 'var(--r-space-7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--r-radius-md)',
                    background: 'var(--r-surface-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Upload size={18} color="var(--r-text-muted)" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <span className="r-table-strong">{t('providers.csv.title')}</span>
                  <p className="r-hint" style={{ marginTop: 3 }}>
                    {t('providers.csv.description')}
                  </p>
                </div>
              </div>
              <button
                className="r-btn r-btn-secondary r-btn-sm"
                onClick={() => setShowCsvModal(true)}
              >
                {t('providers.csv.action')}
              </button>
            </div>

            {ENABLE_MANUAL_INTEGRATION && (
              <div
                className="r-card"
                style={{
                  padding: 'var(--r-space-7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--r-radius-md)',
                      background: 'var(--r-brand-tint)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Code size={18} color="var(--r-brand)" />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                    >
                      <span className="r-table-strong">{t('providers.manual.title')}</span>
                      {hasManual ? <Badge tone="brand">{t('active.connected')}</Badge> : null}
                    </div>
                    <p className="r-hint" style={{ marginTop: 3 }}>
                      {hasManual
                        ? t('providers.manual.connected')
                        : t('providers.manual.description')}
                    </p>
                  </div>
                </div>
                <button
                  className="r-btn r-btn-secondary r-btn-sm"
                  onClick={() => setShowManualModal(true)}
                >
                  {hasManual
                    ? t('providers.manual.action.connected')
                    : t('providers.manual.action.setup')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div id="active-integrations">
          <p className="r-eyebrow" style={{ display: 'block', marginBottom: 10 }}>
            {t('active.title')}
          </p>
          {integrations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="r-card"
                  style={{ padding: 'var(--r-space-7)' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                      {integration.provider === 'shopify' && (
                        <span
                          aria-hidden="true"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 'var(--r-radius-md)',
                            background: '#95BF4720',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <ShoppingBag size={18} color="#5C8A2A" />
                        </span>
                      )}
                      {integration.provider === 'whatsapp' && (
                        <span
                          aria-hidden="true"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 'var(--r-radius-md)',
                            background: '#25D36620',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <MessageCircle size={18} color="#128C53" />
                        </span>
                      )}
                      {integration.provider === 'manual' && (
                        <span
                          aria-hidden="true"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 'var(--r-radius-md)',
                            background: 'var(--r-brand-tint)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Code size={18} color="var(--r-brand)" />
                        </span>
                      )}
                      {integration.provider !== 'shopify' &&
                        integration.provider !== 'whatsapp' &&
                        integration.provider !== 'manual' && (
                          <span
                            aria-hidden="true"
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 'var(--r-radius-md)',
                              background: 'var(--r-surface-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Plug size={18} color="var(--r-text-muted)" />
                          </span>
                        )}
                      <div style={{ minWidth: 0 }}>
                        <h3 className="r-table-strong" style={{ margin: 0 }}>
                          {getProviderName(integration.provider)}
                          {integration.provider === 'whatsapp' &&
                            integration.phone_number_display && (
                              <span className="r-hint" style={{ fontWeight: 400 }}>
                                {' '}
                                • {integration.phone_number_display}
                              </span>
                            )}
                          {integration.provider === 'shopify' && integration.shop_domain && (
                            <span className="r-hint" style={{ fontWeight: 400 }}>
                              {' '}
                              • {integration.shop_domain}
                            </span>
                          )}
                        </h3>
                        <p className="r-hint" style={{ marginTop: 3 }}>
                          {t('createdLabel')}{' '}
                          {new Date(integration.created_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <Badge tone={STATUS_TONE[integration.status]}>
                        {getStatusText(integration.status)}
                      </Badge>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {integration.provider === 'whatsapp' && (
                          <button
                            onClick={() => openWhatsAppModal(integration)}
                            title={t('providers.whatsapp.action.update')}
                            aria-label={t('providers.whatsapp.action.update')}
                            className="r-btn r-btn-ghost r-btn-sm"
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        )}
                        <button
                          className="r-btn r-btn-ghost r-btn-sm"
                          title={t('active.delete')}
                          aria-label={t('active.delete')}
                          onClick={async () => {
                            const ok = await confirm({
                              title: t('active.deleteConfirmTitle'),
                              message: t('active.deleteConfirm'),
                              confirmLabel: t('active.delete'),
                              destructive: true,
                            });
                            if (ok) handleDeleteIntegration(integration.id);
                          }}
                        >
                          <Trash2 size={14} aria-hidden="true" color="var(--r-danger)" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="r-card">
              <EmptyState title={t('active.empty.title')} body={t('active.empty.description')} />
            </div>
          )}
        </div>
      </div>

      {/* Shopify Modal */}
      {showShopifyModal ? (
        <div
          className="r-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !connectingShopify) setShowShopifyModal(false);
          }}
        >
          <div className="r-modal" role="dialog" aria-modal="true" aria-labelledby={shopifyTitleId}>
            <div className="r-modal-head">
              <h2 className="r-modal-title" id={shopifyTitleId}>
                {t('modals.shopify.title')}
              </h2>
            </div>
            <div
              className="r-modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div>
                <label className="r-label" htmlFor={`${fieldPrefix}-shop`}>
                  {t('modals.shopify.shopLabel')}
                </label>
                <input
                  id={`${fieldPrefix}-shop`}
                  className="r-input"
                  value={shopifyShop}
                  onChange={(e) => setShopifyShop(e.target.value)}
                  placeholder={t('modals.shopify.shopPlaceholder')}
                  disabled={connectingShopify}
                  autoComplete="off"
                />
                <p className="r-field-help">{t('modals.shopify.helper')}</p>
              </div>
            </div>
            <div className="r-modal-foot">
              <button
                className="r-btn r-btn-secondary"
                onClick={() => setShowShopifyModal(false)}
                disabled={connectingShopify}
              >
                {t('modals.shopify.cancel')}
              </button>
              <button
                className="r-btn r-btn-primary"
                onClick={handleConnectShopify}
                disabled={connectingShopify}
                aria-busy={connectingShopify || undefined}
              >
                {connectingShopify ? t('modals.shopify.connecting') : t('modals.shopify.connect')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* CSV Modal */}
      {showCsvModal ? (
        <div
          className="r-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !importing) setShowCsvModal(false);
          }}
        >
          <div className="r-modal" role="dialog" aria-modal="true" aria-labelledby={csvTitleId}>
            <div className="r-modal-head">
              <h2 className="r-modal-title" id={csvTitleId}>
                {t('modals.csv.title')}
              </h2>
            </div>
            <div
              className="r-modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div>
                <label className="r-label" htmlFor="csv-file-input">
                  {t('modals.csv.fileLabel')}
                </label>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  disabled={importing}
                  className="r-input"
                />
                {csvFile ? (
                  <p className="r-field-help">
                    {t('modals.csv.fileSelected', { name: csvFile.name })}
                  </p>
                ) : null}
              </div>
              <div
                className="r-card"
                style={{ background: 'var(--r-surface-muted)', padding: 'var(--r-space-6)' }}
              >
                <p className="r-hint" style={{ margin: 0 }}>
                  {t('modals.csv.format')}
                </p>
              </div>
            </div>
            <div className="r-modal-foot">
              <button
                className="r-btn r-btn-secondary"
                onClick={() => setShowCsvModal(false)}
                disabled={importing}
              >
                {t('modals.csv.cancel')}
              </button>
              <button
                className="r-btn r-btn-primary"
                onClick={handleImportCsv}
                disabled={importing || !csvFile}
                aria-busy={importing || undefined}
              >
                {importing ? t('modals.csv.importing') : t('modals.csv.import')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Manual Integration Modal */}
      {showManualModal ? (
        <div
          className="r-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowManualModal(false);
          }}
        >
          <div className="r-modal" role="dialog" aria-modal="true" aria-labelledby={manualTitleId}>
            <div className="r-modal-head">
              <h2 className="r-modal-title" id={manualTitleId}>
                {t('modals.manual.title')}
              </h2>
            </div>
            <div
              className="r-modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div
                className="r-card"
                style={{
                  background: 'var(--r-surface-muted)',
                  padding: 'var(--r-space-6)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <p className="r-label" style={{ margin: 0 }}>
                  {t('modals.manual.webhookLabel')}
                </p>
                <code
                  className="r-hint"
                  style={{
                    display: 'block',
                    background: 'var(--r-surface)',
                    padding: 'var(--r-space-5)',
                    borderRadius: 'var(--r-radius-sm)',
                    border: '1px solid var(--r-border)',
                  }}
                >
                  {getApiBaseUrlForDisplay()}/api/webhooks/manual
                </code>
                <p className="r-field-help">{t('modals.manual.webhookHelper')}</p>
              </div>
            </div>
            <div className="r-modal-foot">
              <button className="r-btn r-btn-secondary" onClick={() => setShowManualModal(false)}>
                {t('modals.manual.cancel')}
              </button>
              <button className="r-btn r-btn-primary" onClick={handleCreateManualIntegration}>
                {t('modals.manual.create')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* WhatsApp Business Modal */}
      {showWhatsAppModal ? (
        <div
          className="r-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !connectingWhatsApp) setShowWhatsAppModal(false);
          }}
        >
          <div
            className="r-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={whatsappTitleId}
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="r-modal-head">
              <h2 className="r-modal-title" id={whatsappTitleId}>
                {editingWhatsAppId ? t('modals.whatsapp.updateTitle') : t('modals.whatsapp.title')}
              </h2>
              <p className="r-hint" style={{ marginTop: 4 }}>
                {t('modals.whatsapp.description')}
              </p>
            </div>
            <div
              className="r-modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div>
                <label className="r-label" htmlFor={`${fieldPrefix}-wa-display`}>
                  {t('modals.whatsapp.displayLabel')}
                </label>
                <input
                  id={`${fieldPrefix}-wa-display`}
                  className="r-input"
                  value={whatsappPhoneDisplay}
                  onChange={(e) => setWhatsappPhoneDisplay(e.target.value)}
                  placeholder={t('modals.whatsapp.displayPlaceholder')}
                  disabled={connectingWhatsApp}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="r-label" htmlFor={`${fieldPrefix}-wa-provider`}>
                  {t('modals.whatsapp.providerLabel')}
                </label>
                <select
                  id={`${fieldPrefix}-wa-provider`}
                  className="r-select"
                  value={whatsappProviderType}
                  onChange={(e) => setWhatsappProviderType(e.target.value as 'meta' | 'twilio')}
                  disabled={connectingWhatsApp}
                >
                  <option value="twilio">{t('modals.whatsapp.providerOptions.twilio')}</option>
                  <option value="meta">{t('modals.whatsapp.providerOptions.meta')}</option>
                </select>
              </div>

              {whatsappProviderType === 'twilio' ? (
                <>
                  <div>
                    <label className="r-label" htmlFor={`${fieldPrefix}-wa-sid`}>
                      {t('modals.whatsapp.twilioSidLabel')}
                    </label>
                    <input
                      id={`${fieldPrefix}-wa-sid`}
                      className="r-input"
                      value={whatsappTwilioAccountSid}
                      onChange={(e) => setWhatsappTwilioAccountSid(e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      disabled={connectingWhatsApp}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="r-label" htmlFor={`${fieldPrefix}-wa-token`}>
                      {t('modals.whatsapp.twilioTokenLabel')}
                    </label>
                    <input
                      id={`${fieldPrefix}-wa-token`}
                      type="password"
                      className="r-input"
                      value={whatsappTwilioAuthToken}
                      onChange={(e) => setWhatsappTwilioAuthToken(e.target.value)}
                      placeholder={t('modals.whatsapp.twilioTokenLabel')}
                      disabled={connectingWhatsApp}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="r-label" htmlFor={`${fieldPrefix}-wa-from`}>
                      {t('modals.whatsapp.twilioFromLabel')}
                    </label>
                    <input
                      id={`${fieldPrefix}-wa-from`}
                      className="r-input"
                      value={whatsappTwilioFromNumber}
                      onChange={(e) => setWhatsappTwilioFromNumber(e.target.value)}
                      placeholder="+14155238886"
                      disabled={connectingWhatsApp}
                      autoComplete="off"
                    />
                    <p className="r-field-help">{t('modals.whatsapp.twilioFromHelper')}</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="r-label" htmlFor={`${fieldPrefix}-wa-phoneid`}>
                      {t('modals.whatsapp.phoneIdLabel')}
                    </label>
                    <input
                      id={`${fieldPrefix}-wa-phoneid`}
                      className="r-input"
                      value={whatsappPhoneNumberId}
                      onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
                      placeholder={t('modals.whatsapp.phoneIdPlaceholder')}
                      disabled={connectingWhatsApp}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="r-label" htmlFor={`${fieldPrefix}-wa-access`}>
                      {t('modals.whatsapp.tokenLabel')}
                    </label>
                    <input
                      id={`${fieldPrefix}-wa-access`}
                      type="password"
                      className="r-input"
                      value={whatsappAccessToken}
                      onChange={(e) => setWhatsappAccessToken(e.target.value)}
                      placeholder={t('modals.whatsapp.tokenPlaceholder')}
                      disabled={connectingWhatsApp}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="r-label" htmlFor={`${fieldPrefix}-wa-verify`}>
                      {t('modals.whatsapp.verifyLabel')}
                    </label>
                    <input
                      id={`${fieldPrefix}-wa-verify`}
                      className="r-input"
                      value={whatsappVerifyToken}
                      onChange={(e) => setWhatsappVerifyToken(e.target.value)}
                      placeholder={t('modals.whatsapp.verifyPlaceholder')}
                      disabled={connectingWhatsApp}
                      autoComplete="off"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="r-modal-foot">
              <button
                className="r-btn r-btn-secondary"
                onClick={() => setShowWhatsAppModal(false)}
                disabled={connectingWhatsApp}
              >
                {t('modals.whatsapp.cancel')}
              </button>
              <button
                className="r-btn r-btn-primary"
                onClick={handleSaveWhatsApp}
                disabled={
                  connectingWhatsApp ||
                  (whatsappProviderType === 'twilio'
                    ? !whatsappTwilioAccountSid.trim() ||
                      !whatsappTwilioAuthToken.trim() ||
                      !whatsappTwilioFromNumber.trim()
                    : !whatsappPhoneNumberId.trim() ||
                      !whatsappAccessToken.trim() ||
                      !whatsappVerifyToken.trim())
                }
                aria-busy={connectingWhatsApp || undefined}
              >
                {connectingWhatsApp
                  ? t('modals.whatsapp.saving')
                  : editingWhatsAppId
                    ? t('modals.whatsapp.update')
                    : t('modals.whatsapp.save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
