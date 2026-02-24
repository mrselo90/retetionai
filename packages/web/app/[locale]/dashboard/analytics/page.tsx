'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { Link } from '@/i18n/routing';
import { Banner, BlockStack, Box, Card as PolarisCard, InlineGrid, InlineStack, Layout, Page, SkeletonPage, Text } from '@shopify/polaris';
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
            <Card hover className="group overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground">{t('metrics.avgSentiment')}</CardTitle>
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center ">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold tracking-tight ${getSentimentColor(analytics.metrics.avgSentiment)}`}>
                  {analytics.metrics.avgSentiment.toFixed(2)}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={getSentimentBadgeVariant(analytics.metrics.avgSentiment)} size="sm">
                    {getSentimentLabel(analytics.metrics.avgSentiment)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card hover className="group overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground">{t('metrics.interactionRate')}</CardTitle>
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center ">
                  <BarChart3 className="h-5 w-5 text-info" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-info">{analytics.metrics.interactionRate}%</div>
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  {analytics.metrics.totalUsers} {t('metrics.activeUsers')}
                </p>
              </CardContent>
            </Card>

            <Card hover className="group overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground">{t('metrics.returnRate')}</CardTitle>
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/20 transition-colors">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-destructive">{analytics.metrics.returnRate}%</div>
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  {analytics.metrics.totalOrders} {t('metrics.orders')}
                </p>
              </CardContent>
            </Card>

            <Card hover className="group overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground">{t('metrics.totalUsers')}</CardTitle>
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center ">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{analytics.metrics.totalUsers}</div>
                <p className="text-xs text-muted-foreground mt-2 font-medium">{t('metrics.activeUsers')}</p>
              </CardContent>
            </Card>
          </div>

          {/* ROI Section */}
          {roi && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <Card hover className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold">{t('roi.savedReturns')}</CardTitle>
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center ">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{roi.savedReturns}</div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">{t('roi.savedReturnsDesc')}</p>
                </CardContent>
              </Card>

              <Card hover className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold">{t('roi.repeatPurchases')}</CardTitle>
                  <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center ">
                    <Users className="h-5 w-5 text-info" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{roi.repeatPurchases}</div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">{t('roi.repeatPurchasesDesc')}</p>
                </CardContent>
              </Card>

              <Card hover className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold">{t('roi.resolvedConversations')}</CardTitle>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center ">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{roi.resolvedConversations}</div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">{t('roi.resolvedTotalDesc', { total: roi.totalConversations })}</p>
                </CardContent>
              </Card>

              <Card hover className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold">{t('roi.messagesTotalLabel')}</CardTitle>
                  <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center ">
                    <BarChart3 className="h-5 w-5 text-warning" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{roi.messagesTotal}</div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">{t('roi.interactionRateDesc', { withConv: roi.usersWithConversations, total: roi.totalUsers })}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Return Prevention Section */}
          {prevention && prevention.totalAttempts > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-amber-600" />
                <h2 className="text-xl font-bold">{rp('analyticsTitle')}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <Card hover className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-semibold">{rp('returnsPrevented')}</CardTitle>
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <ShieldCheck className="h-5 w-5 text-success" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{prevention.prevented}</div>
                    <p className="text-xs text-muted-foreground mt-2 font-medium">
                      {prevention.totalAttempts} {rp('totalAttempts').toLowerCase()}
                    </p>
                  </CardContent>
                </Card>

                <Card hover className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-semibold">{rp('preventionRate')}</CardTitle>
                    <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-info" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{prevention.preventionRate}%</div>
                  </CardContent>
                </Card>

                <Card hover className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-semibold">{rp('escalated')}</CardTitle>
                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-warning" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{prevention.escalated}</div>
                  </CardContent>
                </Card>

                <Card hover className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-semibold">{rp('returned')}</CardTitle>
                    <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <TrendingDown className="h-5 w-5 text-destructive" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{prevention.returned}</div>
                  </CardContent>
                </Card>
              </div>

              {prevention.topProducts.length > 0 && (
                <Card hover className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg">{rp('topProducts')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y divide-zinc-100">
                      {prevention.topProducts.map((product) => (
                        <div key={product.productId} className="flex items-center justify-between py-3">
                          <span className="font-medium text-sm">{product.productName}</span>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground">{product.attempts} {rp('attempts')}</span>
                            <Badge variant="default" size="sm">{product.prevented} {rp('prevented')}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* DAU Chart */}
            <Card hover className="overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold">{t('charts.dau.title')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
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
              </CardContent>
            </Card>

            {/* Message Volume Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('charts.volume.title')}</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <PolarisCard>
          <div className="p-4">
            <Banner tone="info">
              <p>{t('empty.description')}</p>
            </Banner>
          </div>
          <CardContent className="p-12 pt-2 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('empty.title')}</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {t('empty.description')}
            </p>
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
          </CardContent>
        </PolarisCard>
      )}
    </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
