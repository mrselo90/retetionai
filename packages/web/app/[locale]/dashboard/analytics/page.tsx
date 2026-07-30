'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';
import { Link } from '@/i18n/routing';
import { BarChart3, TrendingUp, TrendingDown, Users, Package, Calendar, ArrowRight, ShieldCheck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, Button, EmptyState } from '@/components/recete';
import type { BadgeTone } from '@/components/recete';

interface AnalyticsData {
  period: { startDate: string; endDate: string };
  dau: Array<{ date: string; count: number }>;
  messageVolume: Array<{ date: string; sent: number; received: number }>;
  metrics: {
    avgSentiment: number;
    interactionRate: number;
    returnRate: number;
    totalUsers: number;
    totalOrders: number;
  };
}

interface ROIData {
  savedReturns: number;
  repeatPurchases: number;
  totalConversations: number;
  resolvedConversations: number;
  messagesTotal: number;
  avgSentiment: number;
  interactionRate: number;
  usersWithConversations: number;
  totalUsers: number;
}

interface PreventionData {
  totalAttempts: number;
  prevented: number;
  returned: number;
  escalated: number;
  pending: number;
  preventionRate: number;
  preventedRevenue: number;
  topProducts: Array<{ productId: string; productName: string; attempts: number; prevented: number }>;
}

/** Chart chrome pulled from the design tokens rather than hardcoded hex/Tailwind values. */
const CHART_GRID = '#E4E7E4';
const CHART_TICK = '#5C6B62';
const CHART_BRAND = '#123D2C';
const CHART_BRAND_TINT = '#EEF2EF';
const CHART_SUCCESS = '#16A34A';

export default function AnalyticsPage() {
  const t = useTranslations('Analytics');
  const rp = useTranslations('ReturnPrevention');
  const locale = useLocale();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [roi, setRoi] = useState<ROIData | null>(null);
  const [prevention, setPrevention] = useState<PreventionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const loadAnalytics = useCallback(async () => {
    setLoadError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const [analyticsRes, roiRes, preventionRes] = await Promise.all([
        authenticatedRequest<AnalyticsData>(
          `/api/analytics/dashboard?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
          session.access_token,
        ),
        authenticatedRequest<{ roi: ROIData }>('/api/analytics/roi', session.access_token).catch(() => null),
        authenticatedRequest<PreventionData>('/api/analytics/return-prevention', session.access_token).catch(() => null),
      ]);
      setAnalytics(analyticsRes);
      if (roiRes) setRoi(roiRes.roi);
      if (preventionRes) setPrevention(preventionRes);
    } catch (err) {
      if (getErrorStatus(err) === 401) {
        window.location.href = '/login';
        return;
      }
      setLoadError(getErrorMessage(err, t('loadError.message')));
    } finally {
      setLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate, t]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  // An all-zero payload is still a truthy object, so presence of `analytics` is
  // not evidence of data. Gate the charts on actual activity instead.
  const hasData = Boolean(
    analytics && (
      analytics.metrics.totalUsers > 0 ||
      analytics.metrics.totalOrders > 0 ||
      analytics.metrics.interactionRate > 0
    ),
  );

  // avgSentiment is sourced from analytics_events, which currently has no
  // writer (the worker is a stub), so the value is always 0 — which would
  // render as a confident red "Negative" badge for every merchant. Show the
  // tile only once the source actually produces values.
  const hasSentimentData = Boolean(analytics && analytics.metrics.avgSentiment > 0);

  const sentimentLabel = (score: number) => (score >= 4 ? t('sentiment.positive') : score >= 3 ? t('sentiment.neutral') : t('sentiment.negative'));
  const sentimentTone = (score: number): BadgeTone => (score >= 4 ? 'success' : score >= 3 ? 'caution' : 'danger');

  const tickFormatter = (date: string) => new Date(date).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  // Recharts types this as (label: ReactNode) => ReactNode; the label is
  // always the bar's date string in practice, so this is a safe narrowing.
  const labelFormatter = (date: unknown) => new Date(date as string).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 16 }} role="status" aria-label={t('loading')}>
        <div className="r-skeleton" style={{ height: 26, width: 240 }} />
        <div className="r-kpi-grid">
          {[0, 1, 2, 3].map((i) => <div key={i} className="r-skeleton" style={{ height: 110 }} aria-hidden="true" />)}
        </div>
        <div className="r-two-col">
          <div className="r-skeleton" style={{ height: 300 }} aria-hidden="true" />
          <div className="r-skeleton" style={{ height: 300 }} aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="r-card" style={{ maxWidth: 480 }}>
        <EmptyState
          title={t('loadError.title')}
          body={loadError}
          action={
            <Button variant="primary" onClick={() => { setLoading(true); void loadAnalytics(); }}>
              {t('loadError.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="r-page-title">{t('title')}</h1>
          <p className="r-page-sub">{t('description')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--r-border)', borderRadius: 'var(--r-radius)', padding: '6px 10px', background: 'var(--r-surface)' }}>
          <Calendar size={14} aria-hidden="true" style={{ color: 'var(--r-text-subtle)' }} />
          <label className="sr-only" htmlFor="analytics-start">{t('dateRange.start')}</label>
          <input
            id="analytics-start"
            type="date"
            value={dateRange.startDate}
            max={dateRange.endDate}
            onChange={(e) => setDateRange((r) => ({ ...r, startDate: e.target.value }))}
            style={{ border: 0, background: 'transparent', fontSize: 'var(--r-text-sm-plus)', fontWeight: 'var(--r-weight-semibold)', color: 'var(--r-text)' }}
          />
          <span aria-hidden="true" style={{ color: 'var(--r-text-subtle)' }}>–</span>
          <label className="sr-only" htmlFor="analytics-end">{t('dateRange.end')}</label>
          <input
            id="analytics-end"
            type="date"
            value={dateRange.endDate}
            min={dateRange.startDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => setDateRange((r) => ({ ...r, endDate: e.target.value }))}
            style={{ border: 0, background: 'transparent', fontSize: 'var(--r-text-sm-plus)', fontWeight: 'var(--r-weight-semibold)', color: 'var(--r-text)' }}
          />
        </div>
      </div>

      {analytics && hasData ? (
        <>
          {/* Key metrics */}
          <div className="r-kpi-grid">
            {hasSentimentData ? (
              <div className="r-kpi-card">
                <span className="r-kpi-icon"><TrendingUp size={17} aria-hidden="true" /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="r-kpi-label" style={{ marginTop: 0 }}>{t('metrics.avgSentiment')}</div>
                  <div className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)', marginTop: 4 }}>{analytics.metrics.avgSentiment.toFixed(2)}</div>
                  <div style={{ marginTop: 4 }}>
                    <Badge tone={sentimentTone(analytics.metrics.avgSentiment)}>{sentimentLabel(analytics.metrics.avgSentiment)}</Badge>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="r-kpi-card">
              <span className="r-kpi-icon"><BarChart3 size={17} aria-hidden="true" /></span>
              <div style={{ minWidth: 0 }}>
                <div className="r-kpi-label" style={{ marginTop: 0 }}>{t('metrics.interactionRate')}</div>
                <div className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)', marginTop: 4 }}>{analytics.metrics.interactionRate}%</div>
                <div className="r-kpi-hint">{analytics.metrics.totalUsers} {t('metrics.activeUsers')}</div>
              </div>
            </div>

            <div className="r-kpi-card">
              <span className="r-kpi-icon" style={{ background: 'var(--r-danger-bg)', color: 'var(--r-danger)' }}><TrendingDown size={17} aria-hidden="true" /></span>
              <div style={{ minWidth: 0 }}>
                <div className="r-kpi-label" style={{ marginTop: 0 }}>{t('metrics.returnRate')}</div>
                <div className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)', marginTop: 4 }}>{analytics.metrics.returnRate}%</div>
                <div className="r-kpi-hint">{analytics.metrics.totalOrders} {t('metrics.orders')}</div>
              </div>
            </div>

            <div className="r-kpi-card">
              <span className="r-kpi-icon"><Users size={17} aria-hidden="true" /></span>
              <div style={{ minWidth: 0 }}>
                <div className="r-kpi-label" style={{ marginTop: 0 }}>{t('metrics.totalUsers')}</div>
                <div className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)', marginTop: 4 }}>{analytics.metrics.totalUsers}</div>
                <div className="r-kpi-hint">{t('metrics.activeUsers')}</div>
              </div>
            </div>
          </div>

          {/* ROI */}
          {roi ? (
            <div className="r-kpi-grid">
              <div className="r-kpi-card">
                <span className="r-kpi-icon"><TrendingUp size={17} aria-hidden="true" /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="r-kpi-label" style={{ marginTop: 0 }}>{t('roi.savedReturns')}</div>
                  <div className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)', marginTop: 4 }}>{roi.savedReturns}</div>
                  <div className="r-kpi-hint">{t('roi.savedReturnsDesc')}</div>
                </div>
              </div>
              <div className="r-kpi-card">
                <span className="r-kpi-icon"><Users size={17} aria-hidden="true" /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="r-kpi-label" style={{ marginTop: 0 }}>{t('roi.repeatPurchases')}</div>
                  <div className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)', marginTop: 4 }}>{roi.repeatPurchases}</div>
                  <div className="r-kpi-hint">{t('roi.repeatPurchasesDesc')}</div>
                </div>
              </div>
              <div className="r-kpi-card">
                <span className="r-kpi-icon"><TrendingUp size={17} aria-hidden="true" /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="r-kpi-label" style={{ marginTop: 0 }}>{t('roi.resolvedConversations')}</div>
                  <div className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)', marginTop: 4 }}>{roi.resolvedConversations}</div>
                  <div className="r-kpi-hint">{t('roi.resolvedTotalDesc', { total: roi.totalConversations })}</div>
                </div>
              </div>
              <div className="r-kpi-card">
                <span className="r-kpi-icon" style={{ background: 'var(--r-caution-bg)', color: 'var(--r-caution)' }}><BarChart3 size={17} aria-hidden="true" /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="r-kpi-label" style={{ marginTop: 0 }}>{t('roi.messagesTotalLabel')}</div>
                  <div className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)', marginTop: 4 }}>{roi.messagesTotal}</div>
                  <div className="r-kpi-hint">{t('roi.interactionRateDesc', { withConv: roi.usersWithConversations, total: roi.totalUsers })}</div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Return prevention */}
          {prevention && prevention.totalAttempts > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={20} aria-hidden="true" style={{ color: 'var(--r-caution)' }} />
                <p className="r-card-title" style={{ margin: 0 }}>{rp('analyticsTitle')}</p>
              </div>

              <div className="r-kpi-grid">
                <div className="r-kpi-card">
                  <span className="r-kpi-icon"><ShieldCheck size={17} aria-hidden="true" /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="r-kpi-label" style={{ marginTop: 0 }}>{rp('returnsPrevented')}</div>
                    <div className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)', marginTop: 4 }}>{prevention.prevented}</div>
                    <div className="r-kpi-hint">{prevention.totalAttempts} {rp('totalAttempts').toLowerCase()}</div>
                  </div>
                </div>
                <div className="r-kpi-card">
                  <span className="r-kpi-icon"><TrendingUp size={17} aria-hidden="true" /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="r-kpi-label" style={{ marginTop: 0 }}>{rp('preventionRate')}</div>
                    <div className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)', marginTop: 4 }}>{prevention.preventionRate}%</div>
                  </div>
                </div>
                <div className="r-kpi-card">
                  <span className="r-kpi-icon" style={{ background: 'var(--r-caution-bg)', color: 'var(--r-caution)' }}><Users size={17} aria-hidden="true" /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="r-kpi-label" style={{ marginTop: 0 }}>{rp('escalated')}</div>
                    <div className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)', marginTop: 4 }}>{prevention.escalated}</div>
                  </div>
                </div>
                <div className="r-kpi-card">
                  <span className="r-kpi-icon" style={{ background: 'var(--r-danger-bg)', color: 'var(--r-danger)' }}><TrendingDown size={17} aria-hidden="true" /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="r-kpi-label" style={{ marginTop: 0 }}>{rp('returned')}</div>
                    <div className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)', marginTop: 4 }}>{prevention.returned}</div>
                  </div>
                </div>
              </div>

              {prevention.topProducts.length > 0 ? (
                <div className="r-card">
                  <p className="r-card-title" style={{ marginBottom: 10 }}>{rp('topProducts')}</p>
                  <div>
                    {prevention.topProducts.map((product) => (
                      <div key={product.productId} className="r-activity-row">
                        <span className="r-table-strong">{product.productName}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="r-hint">{product.attempts} {rp('attempts')}</span>
                          <Badge tone="success">{product.prevented} {rp('prevented')}</Badge>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Charts */}
          <div className="r-two-col">
            <div className="r-card">
              <p className="r-card-title" style={{ marginBottom: 10 }}>{t('charts.dau.title')}</p>
              <div style={{ height: 300, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.dau} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                    <XAxis dataKey="date" tickFormatter={tickFormatter} tick={{ fontSize: 12, fill: CHART_TICK }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: CHART_TICK }} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: CHART_BRAND_TINT }}
                      contentStyle={{ borderRadius: 8, border: `1px solid ${CHART_GRID}`, boxShadow: '0 4px 12px rgba(14,21,18,0.08)' }}
                      labelStyle={{ color: '#0E1512', fontWeight: 600, marginBottom: 4 }}
                      labelFormatter={labelFormatter}
                    />
                    <Bar dataKey="count" name={t('charts.dau.users')} fill={CHART_BRAND} radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="r-card">
              <p className="r-card-title" style={{ marginBottom: 10 }}>{t('charts.volume.title')}</p>
              <div style={{ height: 300, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.messageVolume} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                    <XAxis dataKey="date" tickFormatter={tickFormatter} tick={{ fontSize: 12, fill: CHART_TICK }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: CHART_TICK }} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: CHART_BRAND_TINT }}
                      contentStyle={{ borderRadius: 8, border: `1px solid ${CHART_GRID}`, boxShadow: '0 4px 12px rgba(14,21,18,0.08)' }}
                      labelStyle={{ color: '#0E1512', fontWeight: 600, marginBottom: 4 }}
                      labelFormatter={labelFormatter}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, fontWeight: 500 }} />
                    <Bar dataKey="sent" name={t('charts.volume.sent')} fill={CHART_SUCCESS} radius={[0, 0, 4, 4]} stackId="a" maxBarSize={50} />
                    <Bar dataKey="received" name={t('charts.volume.received')} fill={CHART_BRAND} radius={[4, 4, 0, 0]} stackId="a" maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="r-card">
          <EmptyState
            icon={<BarChart3 size={18} />}
            title={t('empty.title')}
            body={t('empty.description')}
            action={
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/dashboard/products" className="r-btn r-btn-primary">
                  <Package size={14} aria-hidden="true" /> {t('empty.addProduct')}
                </Link>
                <Link href="/dashboard/integrations" className="r-btn r-btn-secondary">
                  <ArrowRight size={14} aria-hidden="true" /> {t('empty.setupIntegration')}
                </Link>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}
