'use client';

import { useEffect, useId, useState } from 'react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest, getApiUrl, getApiBaseUrlForDisplay } from '@/lib/api';
import { toast } from '@/lib/toast';
import { PageFeedbackCard } from '@/components/ui/PageFeedbackCard';
import { Badge, EmptyState } from '@/components/recete';
import type { BadgeTone } from '@/components/recete';
import { Trash2, Plug, Upload, Code, ShoppingBag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';
import { WhatsAppConnectCard } from '@/components/recete/WhatsAppConnectCard';

interface Integration {
  id: string;
  provider: 'shopify' | 'woocommerce' | 'ticimax' | 'manual';
  status: 'pending' | 'active' | 'error' | 'disabled';
  auth_type: 'oauth' | 'api_key' | 'token';
  created_at: string;
  updated_at: string;
  phone_number_display?: string;
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
      default:
        return provider;
    }
  };

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

            {/* WhatsApp: the store's own number, linked by QR (packages/wa-worker) */}
            <WhatsAppConnectCard />

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
                      {integration.provider !== 'shopify' && integration.provider !== 'manual' && (
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
    </div>
  );
}
