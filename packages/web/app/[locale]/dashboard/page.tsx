'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';
import { Link } from '@/i18n/routing';
import { Package, ShoppingBag, MessageSquare, BarChart3, CheckCircle2, AlertTriangle, ArrowRight, Zap, Users } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Badge, Button, EmptyState } from '@/components/recete';
import type { BadgeTone } from '@/components/recete';

interface Merchant {
  id: string;
  name: string;
  created_at: string;
}

interface DashboardStats {
  kpis: {
    totalOrders: number;
    activeUsers: number;
    messagesSent: number;
    totalProducts: number;
    responseRate: number;
  };
  knowledgeHealth: {
    averageScore: number;
    productsAtRisk: number;
    strongProducts: number;
    topMissingReasonCode: string | null;
    topMissingReasonCount: number;
    topAtRiskProducts: Array<{ id: string; name: string; score: number; answerRisk: 'low' | 'medium' | 'high' }>;
    weakProducts: number;
  };
  recentActivity: {
    orders: Array<{ id: string; external_order_id: string; status: string; created_at: string; delivery_date?: string }>;
    conversations: Array<{ id: string; user_id: string; last_message_at: string; message_count: number; status: string }>;
  };
  alerts: Array<{ type: string; message: string; severity: 'error' | 'warning' | 'info'; provider?: string }>;
}

const DEFAULT_STATS: DashboardStats = {
  kpis: { totalOrders: 0, activeUsers: 0, messagesSent: 0, totalProducts: 0, responseRate: 0 },
  knowledgeHealth: {
    averageScore: 0, productsAtRisk: 0, strongProducts: 0,
    topMissingReasonCode: null, topMissingReasonCount: 0, topAtRiskProducts: [], weakProducts: 0,
  },
  recentActivity: { orders: [], conversations: [] },
  alerts: [],
};

function normalizeDashboardStats(input: Partial<DashboardStats> | null | undefined): DashboardStats {
  return {
    kpis: { ...DEFAULT_STATS.kpis, ...(input?.kpis || {}) },
    knowledgeHealth: {
      ...DEFAULT_STATS.knowledgeHealth,
      ...(input?.knowledgeHealth || {}),
      topAtRiskProducts: input?.knowledgeHealth?.topAtRiskProducts || DEFAULT_STATS.knowledgeHealth.topAtRiskProducts,
    },
    recentActivity: {
      orders: input?.recentActivity?.orders || DEFAULT_STATS.recentActivity.orders,
      conversations: input?.recentActivity?.conversations || DEFAULT_STATS.recentActivity.conversations,
    },
    alerts: input?.alerts || DEFAULT_STATS.alerts,
  };
}

function statusTone(status: string): BadgeTone {
  if (status === 'delivered' || status === 'active') return 'success';
  if (status === 'failed' || status === 'error') return 'danger';
  if (status === 'pending' || status === 'processing') return 'caution';
  return 'neutral';
}

function healthTone(score: number): BadgeTone {
  if (score >= 80) return 'success';
  if (score >= 50) return 'caution';
  return 'danger';
}

export default function DashboardPage() {
  const t = useTranslations('Dashboard.home');
  const locale = useLocale();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const merchantData = await authenticatedRequest<{ merchant: Merchant }>('/api/auth/me', session.access_token);
      setMerchant(merchantData.merchant);

      try {
        const statsData = await authenticatedRequest<Partial<DashboardStats>>('/api/merchants/me/stats', session.access_token);
        setStats(normalizeDashboardStats(statsData));
      } catch (statsErr) {
        setStats(DEFAULT_STATS);
        if (getErrorStatus(statsErr) === 401) {
          toast.error(t('toasts.sessionExpired.title'), t('toasts.sessionExpired.message'));
          window.location.href = '/login';
          return;
        }
        toast.error(t('toasts.statsLoadFailed.title'), t('toasts.statsLoadFailed.message'));
      }
    } catch (err) {
      if (getErrorStatus(err) === 401) {
        toast.error(t('toasts.sessionExpired.title'), t('toasts.sessionExpired.message'));
        window.location.href = '/login';
        return;
      }
      toast.error(t('toasts.dashboardLoadFailed.title'), getErrorMessage(err, t('toasts.dashboardLoadFailed.message')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 16 }} role="status" aria-label={t('loading')}>
        <div className="r-skeleton" style={{ height: 26, width: 240 }} />
        {[0, 1, 2].map((row) => (
          <div key={row} className="r-skeleton" style={{ height: 120 }} aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="r-card" style={{ maxWidth: 480 }}>
        <EmptyState
          title={t('loadError')}
          action={
            <Button variant="primary" onClick={() => { setLoading(true); void loadDashboard(); }}>
              {t('retry')}
            </Button>
          }
        />
      </div>
    );
  }

  const displayStats = stats ?? DEFAULT_STATS;
  const hasIntegrationIssue = displayStats.alerts.some((a) => a.type === 'no_integration' || a.type === 'integration_error');
  const hasProducts = (displayStats.kpis.totalProducts ?? 0) > 0;
  const hasConversationActivity = (displayStats.kpis.messagesSent ?? 0) > 0 || displayStats.recentActivity.conversations.length > 0;

  const setupSteps = [
    {
      id: 'connectShopify',
      title: t('setup.steps.connectShopify.title'),
      description: t('setup.steps.connectShopify.description'),
      actionLabel: t('setup.steps.connectShopify.action'),
      actionUrl: '/dashboard/integrations',
      completed: !hasIntegrationIssue,
    },
    {
      id: 'addProduct',
      title: t('setup.steps.addProduct.title'),
      description: t('setup.steps.addProduct.description'),
      actionLabel: t('setup.steps.addProduct.action'),
      actionUrl: '/dashboard/products',
      completed: hasProducts,
    },
    {
      id: 'sendFirstWhatsApp',
      title: t('setup.steps.sendFirstWhatsApp.title'),
      description: t('setup.steps.sendFirstWhatsApp.description'),
      actionLabel: t('setup.steps.sendFirstWhatsApp.action'),
      actionUrl: '/dashboard/settings',
      completed: hasConversationActivity,
    },
  ] as const;
  const completedSteps = setupSteps.filter((step) => step.completed).length;
  const nextStep = setupSteps.find((step) => !step.completed);
  const topAlert = displayStats.alerts.find((a) => a.severity === 'error' || a.severity === 'warning') ?? displayStats.alerts[0];

  /*
   * These sentences used to be the raw English strings the backend writes
   * ("No integrations added yet", "Integration error with shopify") — shown
   * verbatim inside an otherwise-localized banner regardless of interface
   * language. Built from `type` (+ `provider` for the one alert that needs it)
   * through real translations instead; `message` is kept only as a fallback for
   * an alert type this page does not yet recognise.
   */
  const alertMessage = (alert: DashboardStats['alerts'][number]) => {
    if (alert.type === 'no_integration') return t('alerts.messages.noIntegration');
    if (alert.type === 'no_products') return t('alerts.messages.noProducts');
    if (alert.type === 'integration_error') return t('alerts.messages.integrationError', { provider: alert.provider ?? '' });
    return alert.message;
  };
  const alertTypeLabel = (type: string) => {
    if (type === 'no_integration') return t('alerts.types.noIntegration');
    if (type === 'integration_error') return t('alerts.types.integrationError');
    if (type === 'no_products') return t('alerts.types.noProducts');
    return type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // No dedicated orders screen exists in this app — orders live inside customer
  // and conversation records — so "View all" for Recent Orders goes to Customers,
  // where per-customer order counts are visible, rather than to Conversations,
  // which shows something else entirely.
  const ordersEmptyActionUrl = '/dashboard/integrations';
  const ordersEmptyActionLabel = hasIntegrationIssue ? t('setup.steps.connectShopify.action') : t('recentOrders.emptyAction');
  const conversationsEmptyActionUrl = hasProducts ? '/dashboard/settings' : '/dashboard/products';
  const conversationsEmptyActionLabel = hasProducts ? t('setup.steps.sendFirstWhatsApp.action') : t('setup.steps.addProduct.action');

  const knowledgeReasonLabel = (reasonCode: string | null) => {
    if (!reasonCode) return t('knowledge.noPrimaryGap');
    const mapping: Record<string, string> = {
      missing_scraped_content: t('knowledge.reasonLabels.missingScrapedContent'),
      missing_enriched_content: t('knowledge.reasonLabels.missingEnrichedContent'),
      missing_usage_instructions: t('knowledge.reasonLabels.missingUsageInstructions'),
      thin_usage_instructions: t('knowledge.reasonLabels.thinUsageInstructions'),
      missing_return_tips: t('knowledge.reasonLabels.missingReturnTips'),
      missing_facts: t('knowledge.reasonLabels.missingFacts'),
      missing_embeddings: t('knowledge.reasonLabels.missingEmbeddings'),
    };
    return mapping[reasonCode] || reasonCode;
  };

  const kpiScore = healthTone(displayStats.knowledgeHealth.averageScore);

  return (
    <div style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 className="r-page-title">{t('greeting', { name: merchant.name || 'Merchant' })}</h1>
        <p className="r-page-sub">
          {displayStats.kpis.activeUsers ?? 0} {t('kpi.activeCustomers')} · {displayStats.kpis.responseRate ?? 0}% {t('kpi.replyRate')}
        </p>
      </div>

      {(topAlert || nextStep) ? (
        <div className={`r-alert r-alert-${nextStep ? 'info' : topAlert?.severity === 'error' ? 'error' : topAlert?.severity === 'warning' ? 'warning' : 'info'}`}>
          <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <p className="r-alert-title">{nextStep ? t('setup.bannerTitle') : t('alerts.title')}</p>
            {nextStep ? <p className="r-alert-body">{t('setup.bannerMessage', { step: nextStep.title })}</p> : null}
            {topAlert ? (
              <p className="r-alert-body">
                <strong>{alertTypeLabel(topAlert.type)}:</strong> {alertMessage(topAlert)}
              </p>
            ) : null}
            {nextStep ? (
              <Link href={nextStep.actionUrl as '/dashboard/integrations'} className="r-btn r-btn-primary r-btn-sm">
                {nextStep.actionLabel}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Getting started */}
      <div className="r-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p className="r-card-title">{t('setup.title')}</p>
          <Badge tone={nextStep ? 'caution' : 'success'}>{t('setup.progress', { completed: completedSteps, total: setupSteps.length })}</Badge>
        </div>

        <div className="r-stepper" style={{ marginBottom: nextStep ? 16 : 0 }}>
          {setupSteps.map((step, index) => (
            <div key={step.id} className="r-stepper-item">
              {index < setupSteps.length - 1 ? (
                <div className={`r-stepper-connector${step.completed ? ' done' : ''}`} />
              ) : null}
              <div className={`r-stepper-circle${step.completed ? ' done' : nextStep?.id === step.id ? ' current' : ''}`}>
                {step.completed ? <CheckCircle2 size={14} aria-hidden="true" /> : <span>{index + 1}</span>}
              </div>
              <p className="r-hint" style={{ textAlign: 'center', marginTop: 6, padding: '0 4px' }}>{step.title}</p>
            </div>
          ))}
        </div>

        {nextStep ? (
          <div style={{ background: 'var(--r-brand-tint)', borderRadius: 'var(--r-radius-md)', padding: 'var(--r-space-7) var(--r-space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontSize: 'var(--r-text-base-plus)', fontWeight: 'var(--r-weight-semibold)', color: 'var(--r-brand)' }}>{nextStep.title}</p>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--r-text-sm-plus)', color: 'var(--r-text-secondary)' }}>{nextStep.description}</p>
            </div>
            <Link href={nextStep.actionUrl as '/dashboard/integrations'} className="r-btn r-btn-primary r-btn-sm" style={{ flexShrink: 0 }}>
              {nextStep.actionLabel}
            </Link>
          </div>
        ) : null}
      </div>

      {/* Knowledge health */}
      <div className="r-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <p className="r-card-title">{t('knowledge.title')}</p>
            <p className="r-hint" style={{ marginTop: 2 }}>{t('knowledge.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--r-text-4xl)', fontWeight: 'var(--r-weight-bold)', letterSpacing: 'var(--r-tracking-tight)' }}>
              {displayStats.knowledgeHealth.averageScore}
            </span>
            <Badge tone={kpiScore}>{t('knowledge.averageBadge', { score: displayStats.knowledgeHealth.averageScore })}</Badge>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: displayStats.knowledgeHealth.productsAtRisk > 0 ? 14 : 0 }}>
          {[
            { label: t('knowledge.productsAtRisk'), value: displayStats.knowledgeHealth.productsAtRisk, hint: t('knowledge.productsAtRiskHint') },
            { label: t('knowledge.strongProducts'), value: displayStats.knowledgeHealth.strongProducts, hint: t('knowledge.strongProductsHint') },
            {
              label: t('knowledge.primaryGap'),
              value: knowledgeReasonLabel(displayStats.knowledgeHealth.topMissingReasonCode),
              hint: displayStats.knowledgeHealth.topMissingReasonCount > 0
                ? t('knowledge.primaryGapHint', { count: displayStats.knowledgeHealth.topMissingReasonCount })
                : t('knowledge.noPrimaryGap'),
            },
          ].map((item, i) => (
            <div key={i} style={{ border: '1px solid var(--r-border)', borderRadius: 'var(--r-radius-md)', padding: 'var(--r-space-6) var(--r-space-7)' }}>
              <p className="r-hint" style={{ margin: '0 0 6px' }}>{item.label}</p>
              <p style={{ margin: '0 0 4px', fontSize: typeof item.value === 'number' ? 'var(--r-text-2xl)' : 'var(--r-text-md)', fontWeight: 'var(--r-weight-bold)', letterSpacing: typeof item.value === 'number' ? 'var(--r-tracking-tight)' : 'normal' }}>
                {item.value}
              </p>
              <p className="r-hint" style={{ margin: 0 }}>{item.hint}</p>
            </div>
          ))}
        </div>

        {displayStats.knowledgeHealth.productsAtRisk > 0 ? (
          <div className="r-alert r-alert-warning" style={{ marginTop: 0 }}>
            <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p className="r-alert-title">{t('knowledge.warningTitle')}</p>
              <p className="r-alert-body">
                {t('knowledge.warningBody', { count: displayStats.knowledgeHealth.productsAtRisk, gap: knowledgeReasonLabel(displayStats.knowledgeHealth.topMissingReasonCode) })}
              </p>
              <Link href="/dashboard/products" className="r-btn r-btn-secondary r-btn-sm">{t('knowledge.warningAction')}</Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* KPIs */}
      <div className="r-kpi-grid">
        {[
          { label: t('kpi.ordersReceived'), value: displayStats.kpis.totalOrders ?? 0, hint: t('kpi.ordersReceivedHint'), icon: <ShoppingBag size={17} aria-hidden="true" /> },
          { label: t('kpi.activeCustomers'), value: displayStats.kpis.activeUsers ?? 0, hint: t('kpi.activeCustomersHint'), icon: <Users size={17} aria-hidden="true" /> },
          { label: t('kpi.whatsappMessages'), value: displayStats.kpis.messagesSent ?? 0, hint: t('kpi.whatsappMessagesHint'), icon: <MessageSquare size={17} aria-hidden="true" /> },
          { label: t('kpi.replyRate'), value: `${displayStats.kpis.responseRate ?? 0}%`, hint: t('kpi.replyRateHint'), icon: <BarChart3 size={17} aria-hidden="true" /> },
        ].map((item, i) => (
          <div key={i} className="r-kpi-card">
            <span className="r-kpi-icon">{item.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div className="r-kpi-value">{item.value}</div>
              <div className="r-kpi-label">{item.label}</div>
              <div className="r-kpi-hint">{item.hint}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="r-two-col">
        <div className="r-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p className="r-card-title">{t('recentOrders.title')}</p>
            <Link href="/dashboard/customers" className="r-btn r-btn-ghost r-btn-sm">
              {t('recentOrders.viewAll')} <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
          {displayStats.recentActivity.orders.length > 0 ? (
            <div>
              {displayStats.recentActivity.orders.map((order) => (
                <div key={order.id} className="r-activity-row">
                  <div style={{ minWidth: 0 }}>
                    <p className="r-table-strong" style={{ margin: 0 }}>#{order.external_order_id}</p>
                    <p className="r-hint" style={{ margin: 0 }}>{formatDateTime(order.created_at)}</p>
                  </div>
                  <Badge tone={statusTone(order.status)}>{order.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ShoppingBag size={18} />}
              title={t('recentOrders.emptyTitle')}
              body={t('recentOrders.emptyDescription')}
              action={<Link href={ordersEmptyActionUrl as '/dashboard/integrations'} className="r-btn r-btn-secondary r-btn-sm">{ordersEmptyActionLabel}</Link>}
            />
          )}
        </div>

        <div className="r-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p className="r-card-title">{t('recentConversations.title')}</p>
            <Link href="/dashboard/conversations" className="r-btn r-btn-ghost r-btn-sm">
              {t('recentConversations.viewAll')} <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
          {displayStats.recentActivity.conversations.length > 0 ? (
            <div>
              {displayStats.recentActivity.conversations.map((conv) => (
                <Link key={conv.id} href={`/dashboard/conversations/${conv.id}`} className="r-activity-row">
                  <div style={{ minWidth: 0 }}>
                    {/* Was hardcoded English ("Conversation #id · N messages"),
                        the only untranslated sentence on this card. */}
                    <p className="r-table-strong" style={{ margin: 0 }}>
                      {t('recentConversations.rowTitle', { id: conv.id.slice(0, 8) })}
                    </p>
                    <p className="r-hint" style={{ margin: 0 }}>
                      {t('recentConversations.rowMeta', { count: conv.message_count, time: formatDateTime(conv.last_message_at) })}
                    </p>
                  </div>
                  <Badge tone={statusTone(conv.status)}>{conv.status}</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<MessageSquare size={18} />}
              title={t('recentConversations.emptyTitle')}
              body={t('recentConversations.emptyDescription')}
              action={<Link href={conversationsEmptyActionUrl as '/dashboard/products'} className="r-btn r-btn-secondary r-btn-sm">{conversationsEmptyActionLabel}</Link>}
            />
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p className="r-eyebrow" style={{ display: 'block', marginBottom: 10 }}>{t('quickActions.title')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { href: '/dashboard/products', icon: <Package size={18} aria-hidden="true" />, title: t('quickActions.addProduct'), desc: t('quickActions.addProductDesc') },
            { href: '/dashboard/integrations', icon: <Zap size={18} aria-hidden="true" />, title: t('quickActions.integration'), desc: t('quickActions.integrationDesc') },
            { href: '/dashboard/settings', icon: <BarChart3 size={18} aria-hidden="true" />, title: t('quickActions.settings'), desc: t('quickActions.settingsDesc') },
          ].map((action, i) => (
            <Link key={i} href={action.href as '/dashboard/products'} className="r-card r-quick-action">
              <span className="r-kpi-icon" style={{ flexShrink: 0 }}>{action.icon}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--r-text-base-plus)', fontWeight: 'var(--r-weight-semibold)' }}>{action.title}</span>
                <span className="r-hint">{action.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
