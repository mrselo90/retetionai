'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, TrendingDown, Users, Package, Calendar, ArrowRight } from 'lucide-react';

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

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
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

      const response = await authenticatedRequest<AnalyticsData>(
        `/api/analytics/dashboard?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        session.access_token
      );
      setAnalytics(response);
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
    if (score >= 4) return 'Pozitif';
    if (score >= 3) return 'Nötr';
    return 'Negatif';
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
    <div className="space-y-8 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Sistem performansı ve metrikler</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg p-1">
          <div className="flex items-center gap-2 px-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="text-sm border-0 bg-transparent focus:outline-none focus:ring-0 py-1.5"
            />
          </div>
          <span className="text-muted-foreground text-sm">–</span>
          <div className="flex items-center px-2">
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="text-sm border-0 bg-transparent focus:outline-none focus:ring-0 py-1.5"
            />
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      {analytics ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ortalama Sentiment</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getSentimentColor(analytics.metrics.avgSentiment)}`}>
                  {analytics.metrics.avgSentiment.toFixed(2)}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getSentimentBadgeVariant(analytics.metrics.avgSentiment)}>
                    {getSentimentLabel(analytics.metrics.avgSentiment)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Etkileşim Oranı</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.metrics.interactionRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.metrics.totalUsers} toplam kullanıcı
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">İade Oranı</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{analytics.metrics.returnRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics.metrics.totalOrders} toplam sipariş
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Toplam Kullanıcı</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.metrics.totalUsers}</div>
                <p className="text-xs text-muted-foreground mt-1">Aktif kullanıcılar</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* DAU Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Günlük Aktif Kullanıcılar (DAU)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 flex items-end gap-[2px]">
                  {analytics.dau.map((day, index) => {
                    const maxCount = Math.max(...analytics.dau.map((d) => d.count), 1);
                    const height = (day.count / maxCount) * 100;
                    return (
                      <div key={index} className="flex-1 group relative">
                        <div
                          className="w-full bg-primary/80 rounded-t-sm transition-all group-hover:bg-primary"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                          <div className="bg-zinc-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                            {new Date(day.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} · {day.count} kullanıcı
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-3 px-1">
                  {analytics.dau.length > 0 && (
                    <>
                      <span>{new Date(analytics.dau[0].date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                      <span>{new Date(analytics.dau[analytics.dau.length - 1].date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Message Volume Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mesaj Hacmi</CardTitle>
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
                            Gönderilen: {day.sent} · Alınan: {day.received}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-6 mt-4 justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                    <span className="text-xs text-muted-foreground">Gönderilen</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary/70 rounded-sm" />
                    <span className="text-xs text-muted-foreground">Alınan</span>
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
            <h3 className="text-lg font-semibold mb-2">Henüz analitik veri yok</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Sistem kullanılmaya başladığında burada metrikler görünecek
            </p>
            <div className="flex justify-center gap-3">
              <Button asChild>
                <Link href="/dashboard/products">
                  <Package className="w-4 h-4 mr-2" />
                  Ürün Ekle
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/integrations">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Entegrasyon Kur
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
