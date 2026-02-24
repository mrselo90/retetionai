'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { Link } from '@/i18n/routing';
import { Badge as PolarisBadge, Banner, BlockStack, Box, Card as PolarisCard, InlineGrid, InlineStack, Layout, Page, SkeletonPage, Text } from '@shopify/polaris';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, TrendingDown, Users, Package, Calendar, ArrowRight, ShieldCheck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslations, useLocale } from 'next-intl';

interface AnalyticsData {
  period: {
    startDate: string;
    endDate: string;
  };
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

export default function AnalyticsPage() {
  const t = useTranslations('Analytics');
  const rp = useTranslations('ReturnPrevention');
  const locale = useLocale();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [roi, setRoi] = useState<ROIData | null>(null);
  const [prevention, setPrevention] = useState<PreventionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const [analyticsRes, roiRes, preventionRes] = await Promise.all([
        authenticatedRequest<AnalyticsData>(
          `/api/analytics/dashboard?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
          session.access_token
        ),
        authenticatedRequest<{ roi: ROIData }>('/api/analytics/roi', session.access_token).catch(() => null),
        authenticatedRequest<PreventionData>('/api/analytics/return-prevention', session.access_token).catch(() => null),
      ]);
      setAnalytics(analyticsRes);
      if (roiRes) setRoi(roiRes.roi);
      if (preventionRes) setPrevention(preventionRes);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      if (err.status === 401) {
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (score: number) => {
    if (score >= 4) return 'text-emerald-600';
    if (score >= 3) return 'text-amber-600';
    return 'text-red-500';
  };

  const getSentimentLabel = (score: number) => {
    if (score >= 4) return t('sentiment.positive');
    if (score >= 3) return t('sentiment.neutral');
    return t('sentiment.negative');
  };

  const getSentimentBadgeVariant = (score: number): 'default' | 'secondary' | 'destructive' => {
    if (score >= 4) return 'default';
    if (score >= 3) return 'secondary';
    return 'destructive';
  };

  const getSentimentBadgeTone = (score: number): Parameters<typeof PolarisBadge>[0]['tone'] => {
    if (score >= 4) return 'success';
    if (score >= 3) return 'attention';
    return 'critical';
  };

  if (loading) {
    return (
      <SkeletonPage title={t('title')}>
        <Layout>
          <Layout.Section>
      <BlockStack gap="500">
        <PolarisCard>
          <Box padding="400">
            <div className="space-y-2 animate-pulse">
              <div className="h-8 w-40 bg-zinc-200 rounded-lg" />
              <div className="h-4 w-64 bg-zinc-100 rounded" />
            </div>
          </Box>
        </PolarisCard>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-zinc-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-white border border-zinc-200 rounded-xl animate-pulse" />
          <div className="h-72 bg-white border border-zinc-200 rounded-xl animate-pulse" />
        </div>
      </BlockStack>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page title={t('title')} subtitle={t('description')} fullWidth>
      <Layout>
        <Layout.Section>
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <PolarisCard>
        <Box padding="400">
          <InlineGrid columns={{ xs: '1fr', md: '1fr auto' }} gap="300" alignItems="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">{t('title')}</Text>
              <Text as="p" tone="subdued">{t('description')}</Text>
            </BlockStack>
            <Box borderWidth="025" borderColor="border" borderRadius="300" padding="200">
              <InlineStack gap="200" blockAlign="center" wrap>
                <InlineStack gap="100" blockAlign="center">
                  <Calendar className="w-4 h-4 text-zinc-500" />
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    className="text-sm border-0 bg-transparent focus:outline-none focus:ring-0 py-2 font-medium"
                  />
                </InlineStack>
                <Text as="span" tone="subdued">–</Text>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="text-sm border-0 bg-transparent focus:outline-none focus:ring-0 py-2 font-medium"
                />
              </InlineStack>
            </Box>
          </InlineGrid>
        </Box>
      </PolarisCard>

      {/* Key Metrics */}
      {analytics ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <PolarisCard>
              <Box padding="400">
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" variant="bodySm" tone="subdued">{t('metrics.avgSentiment')}</Text>
                    <Box background="bg-fill-success-secondary" borderRadius="300" padding="200">
                      <TrendingUp className="h-5 w-5 text-emerald-700" />
                    </Box>
                  </InlineStack>
                  <Text as="p" variant="headingLg">{analytics.metrics.avgSentiment.toFixed(2)}</Text>
                  <InlineStack>
                    <PolarisBadge tone={getSentimentBadgeTone(analytics.metrics.avgSentiment)}>
                      {getSentimentLabel(analytics.metrics.avgSentiment)}
                    </PolarisBadge>
                  </InlineStack>
                </BlockStack>
              </Box>
            </PolarisCard>

            <PolarisCard>
              <Box padding="400">
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" variant="bodySm" tone="subdued">{t('metrics.interactionRate')}</Text>
                    <Box background="bg-fill-info-secondary" borderRadius="300" padding="200">
                      <BarChart3 className="h-5 w-5 text-sky-700" />
                    </Box>
                  </InlineStack>
                  <Text as="p" variant="headingLg">{`${analytics.metrics.interactionRate}%`}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {analytics.metrics.totalUsers} {t('metrics.activeUsers')}
                  </Text>
                </BlockStack>
              </Box>
            </PolarisCard>

            <PolarisCard>
              <Box padding="400">
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" variant="bodySm" tone="subdued">{t('metrics.returnRate')}</Text>
                    <Box background="bg-fill-critical-secondary" borderRadius="300" padding="200">
                      <TrendingDown className="h-5 w-5 text-red-700" />
                    </Box>
                  </InlineStack>
                  <Text as="p" variant="headingLg">{`${analytics.metrics.returnRate}%`}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {analytics.metrics.totalOrders} {t('metrics.orders')}
                  </Text>
                </BlockStack>
              </Box>
            </PolarisCard>

            <PolarisCard>
              <Box padding="400">
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="p" variant="bodySm" tone="subdued">{t('metrics.totalUsers')}</Text>
                    <Box background="bg-fill-secondary" borderRadius="300" padding="200">
                      <Users className="h-5 w-5 text-indigo-700" />
                    </Box>
                  </InlineStack>
                  <Text as="p" variant="headingLg">{String(analytics.metrics.totalUsers)}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">{t('metrics.activeUsers')}</Text>
                </BlockStack>
              </Box>
            </PolarisCard>
          </div>

          {/* ROI Section */}
          {roi && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <PolarisCard><Box padding="400"><BlockStack gap="300"><InlineStack align="space-between"><Text as="p" variant="bodySm">{t('roi.savedReturns')}</Text><Box background="bg-fill-success-secondary" borderRadius="300" padding="200"><TrendingUp className="h-5 w-5 text-emerald-700" /></Box></InlineStack><Text as="p" variant="headingMd">{String(roi.savedReturns)}</Text><Text as="p" variant="bodySm" tone="subdued">{t('roi.savedReturnsDesc')}</Text></BlockStack></Box></PolarisCard>

              <PolarisCard><Box padding="400"><BlockStack gap="300"><InlineStack align="space-between"><Text as="p" variant="bodySm">{t('roi.repeatPurchases')}</Text><Box background="bg-fill-info-secondary" borderRadius="300" padding="200"><Users className="h-5 w-5 text-sky-700" /></Box></InlineStack><Text as="p" variant="headingMd">{String(roi.repeatPurchases)}</Text><Text as="p" variant="bodySm" tone="subdued">{t('roi.repeatPurchasesDesc')}</Text></BlockStack></Box></PolarisCard>

              <PolarisCard><Box padding="400"><BlockStack gap="300"><InlineStack align="space-between"><Text as="p" variant="bodySm">{t('roi.resolvedConversations')}</Text><Box background="bg-fill-secondary" borderRadius="300" padding="200"><TrendingUp className="h-5 w-5 text-indigo-700" /></Box></InlineStack><Text as="p" variant="headingMd">{String(roi.resolvedConversations)}</Text><Text as="p" variant="bodySm" tone="subdued">{t('roi.resolvedTotalDesc', { total: roi.totalConversations })}</Text></BlockStack></Box></PolarisCard>

              <PolarisCard><Box padding="400"><BlockStack gap="300"><InlineStack align="space-between"><Text as="p" variant="bodySm">{t('roi.messagesTotalLabel')}</Text><Box background="bg-fill-caution-secondary" borderRadius="300" padding="200"><BarChart3 className="h-5 w-5 text-amber-700" /></Box></InlineStack><Text as="p" variant="headingMd">{String(roi.messagesTotal)}</Text><Text as="p" variant="bodySm" tone="subdued">{t('roi.interactionRateDesc', { withConv: roi.usersWithConversations, total: roi.totalUsers })}</Text></BlockStack></Box></PolarisCard>
            </div>
          )}

          {/* Return Prevention Section */}
          {prevention && prevention.totalAttempts > 0 && (
            <div className="space-y-4">
              <InlineStack gap="200" blockAlign="center">
                <ShieldCheck className="w-6 h-6 text-amber-600" />
                <Text as="h2" variant="headingMd">{rp('analyticsTitle')}</Text>
              </InlineStack>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <PolarisCard><Box padding="400"><BlockStack gap="300"><InlineStack align="space-between"><Text as="p" variant="bodySm">{rp('returnsPrevented')}</Text><Box background="bg-fill-success-secondary" borderRadius="300" padding="200"><ShieldCheck className="h-5 w-5 text-emerald-700" /></Box></InlineStack><Text as="p" variant="headingMd">{String(prevention.prevented)}</Text><Text as="p" variant="bodySm" tone="subdued">{prevention.totalAttempts} {rp('totalAttempts').toLowerCase()}</Text></BlockStack></Box></PolarisCard>

                <PolarisCard><Box padding="400"><BlockStack gap="300"><InlineStack align="space-between"><Text as="p" variant="bodySm">{rp('preventionRate')}</Text><Box background="bg-fill-info-secondary" borderRadius="300" padding="200"><TrendingUp className="h-5 w-5 text-sky-700" /></Box></InlineStack><Text as="p" variant="headingMd">{`${prevention.preventionRate}%`}</Text></BlockStack></Box></PolarisCard>

                <PolarisCard><Box padding="400"><BlockStack gap="300"><InlineStack align="space-between"><Text as="p" variant="bodySm">{rp('escalated')}</Text><Box background="bg-fill-caution-secondary" borderRadius="300" padding="200"><Users className="h-5 w-5 text-amber-700" /></Box></InlineStack><Text as="p" variant="headingMd">{String(prevention.escalated)}</Text></BlockStack></Box></PolarisCard>

                <PolarisCard><Box padding="400"><BlockStack gap="300"><InlineStack align="space-between"><Text as="p" variant="bodySm">{rp('returned')}</Text><Box background="bg-fill-critical-secondary" borderRadius="300" padding="200"><TrendingDown className="h-5 w-5 text-red-700" /></Box></InlineStack><Text as="p" variant="headingMd">{String(prevention.returned)}</Text></BlockStack></Box></PolarisCard>
              </div>

              {prevention.topProducts.length > 0 && (
                <PolarisCard>
                  <Box padding="400">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">{rp('topProducts')}</Text>
                      <div className="divide-y divide-zinc-100">
                      {prevention.topProducts.map((product) => (
                        <div key={product.productId} className="flex items-center justify-between py-3">
                          <Text as="span" variant="bodySm" fontWeight="medium">{product.productName}</Text>
                          <InlineStack gap="300" blockAlign="center">
                            <Text as="span" variant="bodySm" tone="subdued">{product.attempts} {rp('attempts')}</Text>
                            <PolarisBadge tone="success">{`${product.prevented} ${rp('prevented')}`}</PolarisBadge>
                          </InlineStack>
                        </div>
                      ))}
                    </div>
                    </BlockStack>
                  </Box>
                </PolarisCard>
              )}
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* DAU Chart */}
            <PolarisCard>
              <Box padding="400">
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">{t('charts.dau.title')}</Text>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.dau} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date) => new Date(date).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' })}
                        tick={{ fontSize: 12, fill: '#71717A' }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#71717A' }}
                      />
                      <Tooltip
                        cursor={{ fill: '#F4F4F5' }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E4E4E7', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                        labelStyle={{ color: '#18181B', fontWeight: 600, marginBottom: '4px' }}
                        labelFormatter={(date) => new Date(date).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                      />
                      <Bar
                        dataKey="count"
                        name={t('charts.dau.users')}
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={50}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                </BlockStack>
              </Box>
            </PolarisCard>

            {/* Message Volume Chart */}
            <PolarisCard>
              <Box padding="400">
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">{t('charts.volume.title')}</Text>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.messageVolume} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date) => new Date(date).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' })}
                        tick={{ fontSize: 12, fill: '#71717A' }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#71717A' }}
                      />
                      <Tooltip
                        cursor={{ fill: '#F4F4F5' }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #E4E4E7', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                        labelStyle={{ color: '#18181B', fontWeight: 600, marginBottom: '4px' }}
                        labelFormatter={(date) => new Date(date).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                      />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '12px', fontWeight: 500 }}
                      />
                      <Bar
                        dataKey="sent"
                        name={t('charts.volume.sent')}
                        fill="#10b981"
                        radius={[0, 0, 4, 4]}
                        stackId="a"
                        maxBarSize={50}
                      />
                      <Bar
                        dataKey="received"
                        name={t('charts.volume.received')}
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                        stackId="a"
                        maxBarSize={50}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                </BlockStack>
              </Box>
            </PolarisCard>
          </div>
        </>
      ) : (
        <PolarisCard>
          <Box padding="300">
            <Banner tone="info">
              <p>{t('empty.description')}</p>
            </Banner>
          </Box>
          <Box padding="800">
            <BlockStack gap="300" inlineAlign="center">
              <Box background="bg-surface-secondary" borderRadius="full" padding="400">
                <BarChart3 className="w-8 h-8 text-zinc-500" />
              </Box>
              <Text as="h3" variant="headingMd">{t('empty.title')}</Text>
              <Text as="p" tone="subdued" alignment="center">
                {t('empty.description')}
              </Text>
              <div className="flex justify-center gap-3">
              <Button asChild>
                <Link href="/dashboard/products">
                  <Package className="w-4 h-4 mr-2" />
                  {t('empty.addProduct')}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/integrations">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  {t('empty.setupIntegration')}
                </Link>
              </Button>
              </div>
            </BlockStack>
          </Box>
        </PolarisCard>
      )}
    </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
