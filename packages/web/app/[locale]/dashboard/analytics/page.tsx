'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { Link } from '@/i18n/routing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, TrendingDown, Users, Package, Calendar, ArrowRight } from 'lucide-react';
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

export default function AnalyticsPage() {
  const t = useTranslations('Analytics');
  const locale = useLocale();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [roi, setRoi] = useState<ROIData | null>(null);
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

      const [analyticsRes, roiRes] = await Promise.all([
        authenticatedRequest<AnalyticsData>(
          `/api/analytics/dashboard?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
          session.access_token
        ),
        authenticatedRequest<{ roi: ROIData }>('/api/analytics/roi', session.access_token).catch(() => null),
      ]);
      setAnalytics(analyticsRes);
      if (roiRes) setRoi(roiRes.roi);
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
      <div className="space-y-8 animate-fade-in">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-zinc-200 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-zinc-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-zinc-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-white border border-zinc-200 rounded-xl animate-pulse" />
          <div className="h-72 bg-white border border-zinc-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground text-base font-medium">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2 bg-white border-2 border-zinc-200 rounded-xl p-1.5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 px-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="text-sm border-0 bg-transparent focus:outline-none focus:ring-0 py-2 font-medium"
            />
          </div>
          <span className="text-muted-foreground text-sm font-bold">–</span>
          <div className="flex items-center px-3">
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="text-sm border-0 bg-transparent focus:outline-none focus:ring-0 py-2 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      {analytics ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <Card hover className="group overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground">{t('metrics.avgSentiment')}</CardTitle>
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
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
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center group-hover:bg-info/20 transition-colors">
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
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
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
              <Card hover className="border-2 border-success/20 bg-gradient-to-br from-success/5 to-transparent overflow-hidden group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold">Kurtarılan İadeler</CardTitle>
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success tracking-tight">{roi.savedReturns}</div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">Şikayet → olumlu biten konuşmalar</p>
                </CardContent>
              </Card>

              <Card hover className="border-2 border-info/20 bg-gradient-to-br from-info/5 to-transparent overflow-hidden group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold">Tekrar Alım</CardTitle>
                  <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center group-hover:bg-info/20 transition-colors">
                    <Users className="h-5 w-5 text-info" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-info tracking-tight">{roi.repeatPurchases}</div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">Konuşması olan tekrar alıcılar</p>
                </CardContent>
              </Card>

              <Card hover className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold">Çözülen Konuşmalar</CardTitle>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary tracking-tight">{roi.resolvedConversations}</div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">/ {roi.totalConversations} toplam</p>
                </CardContent>
              </Card>

              <Card hover className="border-2 border-warning/20 bg-gradient-to-br from-warning/5 to-transparent overflow-hidden group">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold">Toplam Mesaj</CardTitle>
                  <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center group-hover:bg-warning/20 transition-colors">
                    <BarChart3 className="h-5 w-5 text-warning" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-warning tracking-tight">{roi.messagesTotal}</div>
                  <p className="text-xs text-muted-foreground mt-2 font-medium">{roi.usersWithConversations}/{roi.totalUsers} müşteri etkileşimde</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* DAU Chart */}
            <Card hover className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-muted/30 to-transparent pb-4">
                <CardTitle className="text-lg font-bold">{t('charts.dau.title')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-64 flex items-end gap-[2px]">
                  {analytics.dau.map((day, index) => {
                    const maxCount = Math.max(...analytics.dau.map((d) => d.count), 1);
                    const height = (day.count / maxCount) * 100;
                    return (
                      <div key={index} className="flex-1 group relative">
                        <div
                          className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t-md transition-all group-hover:from-primary group-hover:to-primary/80 shadow-sm"
                          style={{ height: `${Math.max(height, 3)}%` }}
                        />
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 animate-scale-in">
                          <div className="bg-zinc-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap font-medium">
                            {new Date(day.date).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' })} · {day.count} {t('charts.dau.users')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-4 px-1 font-medium">
                  {analytics.dau.length > 0 && (
                    <>
                      <span>{new Date(analytics.dau[0].date).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' })}</span>
                      <span>{new Date(analytics.dau[analytics.dau.length - 1].date).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' })}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Message Volume Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('charts.volume.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 flex items-end gap-[2px]">
                  {analytics.messageVolume.map((day, index) => {
                    const maxVolume = Math.max(
                      ...analytics.messageVolume.map((d) => Math.max(d.sent, d.received)),
                      1
                    );
                    const sentHeight = (day.sent / maxVolume) * 100;
                    const receivedHeight = (day.received / maxVolume) * 100;
                    return (
                      <div key={index} className="flex-1 flex gap-[1px] group relative">
                        <div
                          className="flex-1 bg-emerald-500/80 rounded-t-sm transition-all group-hover:bg-emerald-500"
                          style={{ height: `${Math.max(sentHeight, 2)}%` }}
                        />
                        <div
                          className="flex-1 bg-primary/60 rounded-t-sm transition-all group-hover:bg-primary/80"
                          style={{ height: `${Math.max(receivedHeight, 2)}%` }}
                        />
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                          <div className="bg-zinc-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                            {t('charts.volume.sent')}: {day.sent} · {t('charts.volume.received')}: {day.received}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-6 mt-4 justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                    <span className="text-xs text-muted-foreground">{t('charts.volume.sent')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary/70 rounded-sm" />
                    <span className="text-xs text-muted-foreground">{t('charts.volume.received')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
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
        </Card>
      )}
    </div>
  );
}
