'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Link } from '@/i18n/routing';
import { LayoutDashboard, Package, ShoppingBag, MessageSquare, BarChart3, CheckCircle2, AlertTriangle, ArrowRight, Zap, Users } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

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
    topAtRiskProducts: Array<{
      id: string;
      name: string;
      score: number;
      answerRisk: 'low' | 'medium' | 'high';
    }>;
    weakProducts: number;
  };
  recentActivity: {
    orders: Array<{
      id: string;
      external_order_id: string;
      status: string;
      created_at: string;
      delivery_date?: string;
    }>;
    conversations: Array<{
      id: string;
      user_id: string;
      last_message_at: string;
      message_count: number;
      status: string;
    }>;
  };
  alerts: Array<{
    type: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
}

const DEFAULT_STATS: DashboardStats = {
  kpis: { totalOrders: 0, activeUsers: 0, messagesSent: 0, totalProducts: 0, responseRate: 0 },
  knowledgeHealth: {
    averageScore: 0,
    productsAtRisk: 0,
    strongProducts: 0,
    topMissingReasonCode: null,
    topMissingReasonCount: 0,
    topAtRiskProducts: [],
    weakProducts: 0,
  },
  recentActivity: { orders: [], conversations: [] },
  alerts: [],
};

function normalizeDashboardStats(input: Partial<DashboardStats> | null | undefined): DashboardStats {
  return {
    kpis: {
      ...DEFAULT_STATS.kpis,
      ...(input?.kpis || {}),
    },
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

function statusTone(status: string): 'success' | 'critical' | 'attention' | 'info' {
  if (status === 'delivered' || status === 'active') return 'success';
  if (status === 'failed' || status === 'error') return 'critical';
  if (status === 'pending' || status === 'processing') return 'attention';
  return 'info';
}

function healthTone(score: number): 'success' | 'attention' | 'critical' {
  if (score >= 80) return 'success';
  if (score >= 55) return 'attention';
  return 'critical';
}

export default function DashboardPage() {
  const t = useTranslations('Dashboard.home');
  const locale = useLocale();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const merchantData = await authenticatedRequest<{ merchant: Merchant }>(
        '/api/auth/me',
        session.access_token
      );
      setMerchant(merchantData.merchant);

      try {
        const statsData = await authenticatedRequest<Partial<DashboardStats>>(
          '/api/merchants/me/stats',
          session.access_token
        );
        setStats(normalizeDashboardStats(statsData));
      } catch (statsErr: unknown) {
        console.warn('Dashboard stats failed:', statsErr);
        setStats(DEFAULT_STATS);
        const statsStatus =
          typeof statsErr === 'object' && statsErr !== null && 'status' in statsErr
            ? (statsErr as { status?: number }).status
            : undefined;
        if (statsStatus === 401) {
          toast.error(t('toasts.sessionExpired.title'), t('toasts.sessionExpired.message'));
          window.location.href = '/login';
          return;
        }
        toast.error(t('toasts.statsLoadFailed.title'), t('toasts.statsLoadFailed.message'));
      }
    } catch (err: unknown) {
      console.error('Failed to load dashboard:', err);
      const errorStatus =
        typeof err === 'object' && err !== null && 'status' in err
          ? (err as { status?: number }).status
          : undefined;
      const errorMessage =
        typeof err === 'object' && err !== null && 'message' in err
          ? (err as { message?: string }).message
          : undefined;
      if (errorStatus === 401) {
        toast.error(t('toasts.sessionExpired.title'), t('toasts.sessionExpired.message'));
        window.location.href = '/login';
        return;
      }
      toast.error(t('toasts.dashboardLoadFailed.title'), errorMessage || t('toasts.dashboardLoadFailed.message'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="d-page">
        <div className="d-page-header">
          <div style={{ height: 26, width: 200, background: '#E8E6DF', borderRadius: 6, marginBottom: 8 }} />
          <div style={{ height: 16, width: 300, background: '#E8E6DF', borderRadius: 4 }} />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="d-card" style={{ marginBottom: 16, height: 120, background: '#F2F0E9', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="d-page">
        <div className="d-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ color: '#5A5D58', marginBottom: 16 }}>{t('loadError')}</p>
          <button
            className="d-btn d-btn-primary"
            onClick={() => { setLoading(true); void loadDashboard(); }}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  const displayStats = stats ?? DEFAULT_STATS;
  const hasIntegrationIssue = displayStats.alerts.some(
    (a) => a.type === 'no_integration' || a.type === 'integration_error'
  );
  const hasProducts = (displayStats.kpis.totalProducts ?? 0) > 0;
  const hasConversationActivity =
    (displayStats.kpis.messagesSent ?? 0) > 0 || displayStats.recentActivity.conversations.length > 0;
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
  ];
  const completedSteps = setupSteps.filter((step) => step.completed).length;
  const nextStep = setupSteps.find((step) => !step.completed);
  const topAlert = displayStats.alerts.find((a) => a.severity === 'error' || a.severity === 'warning') ??
    displayStats.alerts[0];
  const ordersEmptyActionUrl = '/dashboard/integrations';
  const ordersEmptyActionLabel = hasIntegrationIssue
    ? t('setup.steps.connectShopify.action')
    : t('recentOrders.emptyAction');
  const conversationsEmptyActionUrl = hasProducts ? '/dashboard/settings' : '/dashboard/products';
  const conversationsEmptyActionLabel = hasProducts
    ? t('setup.steps.sendFirstWhatsApp.action')
    : t('setup.steps.addProduct.action');

  const alertTypeLabel = (type: string) => {
    if (type === 'no_integration') return t('alerts.types.noIntegration');
    if (type === 'integration_error') return t('alerts.types.integrationError');
    if (type === 'no_products') return t('alerts.types.noProducts');
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

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

  return (
    <div className="d-page">
      {/* Page header */}
      <div className="d-page-header">
        <h1 className="d-page-title">{t('greeting', { name: merchant.name || 'Merchant' })}</h1>
        <p className="d-page-subtitle">
          {String(displayStats.kpis.activeUsers ?? 0)} {t('kpi.activeCustomers')} &bull; {displayStats.kpis.responseRate ?? 0}% {t('kpi.replyRate')}
        </p>
      </div>

      {/* Banner */}
      {(topAlert || nextStep) && (
        <div
          className={`d-banner ${topAlert?.severity === 'error' ? 'd-banner-error' : topAlert?.severity === 'warning' ? 'd-banner-warning' : 'd-banner-info'}`}
          style={{ marginBottom: 16 }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{nextStep ? t('setup.bannerTitle') : t('alerts.title')}</p>
            {nextStep && <p style={{ margin: '4px 0 8px', fontSize: 13 }}>{t('setup.bannerMessage', { step: nextStep.title })}</p>}
            {topAlert && <p style={{ margin: '4px 0 8px', fontSize: 13 }}><strong>{alertTypeLabel(topAlert.type)}:</strong> {topAlert.message}</p>}
            {nextStep && <a href={nextStep.actionUrl} className="d-btn d-btn-primary d-btn-sm">{nextStep.actionLabel}</a>}
          </div>
        </div>
      )}

      {/* Getting Started */}
      <div className="d-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p className="d-card-title">{t('setup.title')}</p>
          <span className={`d-badge ${nextStep ? 'd-badge-attention' : 'd-badge-success'}`}>{t('setup.progress', { completed: completedSteps, total: setupSteps.length })}</span>
        </div>
        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: nextStep ? 16 : 0 }}>
          {setupSteps.map((step, index) => (
            <div key={step.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {index < setupSteps.length - 1 && (
                <div style={{ position: 'absolute', top: 14, left: '50%', width: '100%', height: 2, background: step.completed ? '#2A6647' : '#E8E6DF' }} />
              )}
              <div className={`d-step-circle ${step.completed ? 'done' : (nextStep?.id === step.id ? 'current' : 'pending')}`} style={{ position: 'relative', zIndex: 1 }}>
                {step.completed ? <CheckCircle2 size={14} /> : <span>{index + 1}</span>}
              </div>
              <p style={{ fontSize: 11.5, color: '#5A5D58', textAlign: 'center', marginTop: 6, padding: '0 4px' }}>{step.title}</p>
            </div>
          ))}
        </div>
        {nextStep && (
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1E40AF' }}>{nextStep.title}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#3B82F6' }}>{nextStep.description}</p>
            </div>
            <a href={nextStep.actionUrl} className="d-btn d-btn-primary d-btn-sm" style={{ flexShrink: 0 }}>{nextStep.actionLabel}</a>
          </div>
        )}
      </div>

      {/* Knowledge Health */}
      <div className="d-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <p className="d-card-title">{t('knowledge.title')}</p>
            <p className="d-card-subtitle" style={{ marginTop: 2 }}>{t('knowledge.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', color: '#0A0B0A' }}>{displayStats.knowledgeHealth.averageScore}</span>
            <span className={`d-badge ${healthTone(displayStats.knowledgeHealth.averageScore) === 'success' ? 'd-badge-success' : healthTone(displayStats.knowledgeHealth.averageScore) === 'attention' ? 'd-badge-attention' : 'd-badge-error'}`}>{t('knowledge.averageBadge', { score: displayStats.knowledgeHealth.averageScore })}</span>
          </div>
        </div>
        <div className="d-grid-3" style={{ marginBottom: displayStats.knowledgeHealth.productsAtRisk > 0 ? 14 : 0 }}>
          {[
            { label: t('knowledge.productsAtRisk'), value: displayStats.knowledgeHealth.productsAtRisk, hint: t('knowledge.productsAtRiskHint') },
            { label: t('knowledge.strongProducts'), value: displayStats.knowledgeHealth.strongProducts, hint: t('knowledge.strongProductsHint') },
            { label: t('knowledge.primaryGap'), value: knowledgeReasonLabel(displayStats.knowledgeHealth.topMissingReasonCode), hint: displayStats.knowledgeHealth.topMissingReasonCount > 0 ? t('knowledge.primaryGapHint', { count: displayStats.knowledgeHealth.topMissingReasonCount }) : t('knowledge.noPrimaryGap') },
          ].map((item, i) => (
            <div key={i} style={{ border: '1px solid #E8E6DF', borderRadius: 8, padding: '12px 14px' }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, color: '#8E918C' }}>{item.label}</p>
              <p style={{ margin: '0 0 4px', fontSize: typeof item.value === 'number' ? 22 : 14, fontWeight: 600, color: '#0A0B0A', letterSpacing: typeof item.value === 'number' ? '-0.02em' : 'normal' }}>{item.value}</p>
              <p style={{ margin: 0, fontSize: 11.5, color: '#8E918C' }}>{item.hint}</p>
            </div>
          ))}
        </div>
        {displayStats.knowledgeHealth.productsAtRisk > 0 && (
          <div className="d-banner d-banner-warning" style={{ marginTop: 0 }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 13 }}>{t('knowledge.warningTitle')}</strong>
              <p style={{ margin: '2px 0 8px', fontSize: 12.5 }}>{t('knowledge.warningBody', { count: displayStats.knowledgeHealth.productsAtRisk, gap: knowledgeReasonLabel(displayStats.knowledgeHealth.topMissingReasonCode) })}</p>
              <a href="/dashboard/products" className="d-btn d-btn-outline d-btn-sm">{t('knowledge.warningAction')}</a>
            </div>
          </div>
        )}
      </div>

      {/* 4 KPI stats */}
      <div className="d-grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: t('kpi.ordersReceived'), value: displayStats.kpis.totalOrders ?? 0, hint: t('kpi.ordersReceivedHint'), icon: <ShoppingBag size={16} /> },
          { label: t('kpi.activeCustomers'), value: displayStats.kpis.activeUsers ?? 0, hint: t('kpi.activeCustomersHint'), icon: <Users size={16} /> },
          { label: t('kpi.whatsappMessages'), value: displayStats.kpis.messagesSent ?? 0, hint: t('kpi.whatsappMessagesHint'), icon: <MessageSquare size={16} /> },
          { label: t('kpi.replyRate'), value: `${displayStats.kpis.responseRate ?? 0}%`, hint: t('kpi.replyRateHint'), icon: <BarChart3 size={16} /> },
        ].map((item, i) => (
          <div key={i} className="d-stat">
            <div className="d-stat-icon">{item.icon}</div>
            <div>
              <div className="d-stat-value">{item.value}</div>
              <div className="d-stat-label">{item.label}</div>
              <div className="d-stat-hint">{item.hint}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="d-grid-2" style={{ marginBottom: 16 }}>
        {/* Recent Orders */}
        <div className="d-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p className="d-card-title">{t('recentOrders.title')}</p>
            <a href="/dashboard/conversations" className="d-btn d-btn-ghost d-btn-sm">{t('recentOrders.viewAll')} <ArrowRight size={12} /></a>
          </div>
          {displayStats.recentActivity.orders.length > 0 ? (
            <div>
              {displayStats.recentActivity.orders.map((order) => (
                <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #E8E6DF' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#0A0B0A' }}>#{order.external_order_id}</p>
                    <p style={{ margin: 0, fontSize: 11.5, color: '#8E918C' }}>{formatDateTime(order.created_at)}</p>
                  </div>
                  <span className={`d-badge ${statusTone(order.status) === 'success' ? 'd-badge-success' : statusTone(order.status) === 'critical' ? 'd-badge-error' : statusTone(order.status) === 'attention' ? 'd-badge-attention' : 'd-badge-info'}`}>{order.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="d-empty">
              <div className="d-empty-icon"><ShoppingBag size={18} /></div>
              <p className="d-empty-title">{t('recentOrders.emptyTitle')}</p>
              <p className="d-empty-desc">{t('recentOrders.emptyDescription')}</p>
              <a href={ordersEmptyActionUrl} className="d-btn d-btn-outline d-btn-sm">{ordersEmptyActionLabel}</a>
            </div>
          )}
        </div>

        {/* Recent Conversations */}
        <div className="d-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p className="d-card-title">{t('recentConversations.title')}</p>
            <a href="/dashboard/conversations" className="d-btn d-btn-ghost d-btn-sm">{t('recentConversations.viewAll')} <ArrowRight size={12} /></a>
          </div>
          {displayStats.recentActivity.conversations.length > 0 ? (
            <div>
              {displayStats.recentActivity.conversations.map((conv) => (
                <Link key={conv.id} href={`/dashboard/conversations/${conv.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #E8E6DF', textDecoration: 'none' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#0A0B0A' }}>Conversation #{conv.id.substring(0, 8)}</p>
                    <p style={{ margin: 0, fontSize: 11.5, color: '#8E918C' }}>{conv.message_count} messages &bull; {formatDateTime(conv.last_message_at)}</p>
                  </div>
                  <span className={`d-badge ${statusTone(conv.status) === 'success' ? 'd-badge-success' : statusTone(conv.status) === 'critical' ? 'd-badge-error' : statusTone(conv.status) === 'attention' ? 'd-badge-attention' : 'd-badge-info'}`}>{conv.status}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="d-empty">
              <div className="d-empty-icon"><MessageSquare size={18} /></div>
              <p className="d-empty-title">{t('recentConversations.emptyTitle')}</p>
              <p className="d-empty-desc">{t('recentConversations.emptyDescription')}</p>
              <a href={conversationsEmptyActionUrl} className="d-btn d-btn-outline d-btn-sm">{conversationsEmptyActionLabel}</a>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="d-section-label">{t('quickActions.title')}</p>
        <div className="d-grid-3">
          {[
            { href: '/dashboard/products', icon: <Package size={18} />, title: t('quickActions.addProduct'), desc: t('quickActions.addProductDesc') },
            { href: '/dashboard/integrations', icon: <Zap size={18} />, title: t('quickActions.integration'), desc: t('quickActions.integrationDesc') },
            { href: '/dashboard/settings', icon: <BarChart3 size={18} />, title: t('quickActions.settings'), desc: t('quickActions.settingsDesc') },
          ].map((action, i) => (
            <Link key={i} href={action.href as Parameters<typeof Link>[0]['href']} style={{ textDecoration: 'none' }}>
              <div
                className="d-card"
                style={{ display: 'flex', gap: 14, cursor: 'pointer', transition: 'background 120ms' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F2F0E9')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <div className="d-stat-icon" style={{ flexShrink: 0 }}>{action.icon}</div>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 600, color: '#0A0B0A' }}>{action.title}</p>
                  <p style={{ margin: 0, fontSize: 12.5, color: '#5A5D58' }}>{action.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
