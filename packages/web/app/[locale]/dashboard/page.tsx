'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Link } from '@/i18n/routing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowRight, BarChart3, MessageSquare, Package, ShoppingBag, Info, AlertTriangle } from 'lucide-react';
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

export default function DashboardPage() {
  const t = useTranslations('Dashboard.home');
  const locale = useLocale();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const defaultStats: DashboardStats = {
    kpis: { totalOrders: 0, activeUsers: 0, messagesSent: 0, totalProducts: 0, responseRate: 0 },
    recentActivity: { orders: [], conversations: [] },
    alerts: [],
  };

  const loadDashboard = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
        const statsData = await authenticatedRequest<DashboardStats>(
          '/api/merchants/me/stats',
          session.access_token
        );
        setStats(statsData);
      } catch (statsErr: any) {
        console.warn('Dashboard stats failed:', statsErr);
        setStats(defaultStats);
        if (statsErr?.status === 401) {
          toast.error('Session expired', 'Please login again');
          window.location.href = '/login';
          return;
        }
        toast.error('Failed to load stats', 'Showing dashboard with default values.');
      }
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      if (err?.status === 401) {
        toast.error('Session expired', 'Please login again');
        window.location.href = '/login';
        return;
      }
      toast.error('Failed to load dashboard', err?.message || 'Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

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
      <div className="space-y-8 p-1">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-zinc-200 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-zinc-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-zinc-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-white border border-zinc-200 rounded-xl animate-pulse" />
          <div className="h-80 bg-white border border-zinc-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-zinc-600">{t('loadError')}</p>
        <Button onClick={() => { setLoading(true); loadDashboard(); }}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  const displayStats = stats ?? defaultStats;
  const hasAlerts = displayStats.alerts && displayStats.alerts.length > 0;
  const hasErrorAlerts = hasAlerts && displayStats.alerts!.some((a) => a.severity === 'error' || a.severity === 'warning');

  return (
    <div className="space-y-8 animate-fade-in pb-8">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 px-6 py-8 text-primary-foreground shadow-lg">
        <h1 className="text-3xl font-bold tracking-tight">
          {t('greeting', { name: merchant?.name || 'Merchant' })}
        </h1>
        <p className="mt-2 text-primary-foreground/90 text-lg">
          {t.rich('summary', {
            activeUsers: displayStats.kpis.activeUsers ?? 0,
            responseRate: displayStats.kpis.responseRate ?? 0,
            bold: (chunks) => <span className="font-semibold">{chunks}</span>
          })}
        </p>
      </div>

      {/* Critical Alerts */}
      {hasErrorAlerts && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="font-semibold text-destructive">{t('actionRequired')}</p>
          </div>
          <div className="space-y-2 pl-7">
            {displayStats.alerts!.filter((a) => a.severity === 'error' || a.severity === 'warning').map((alert, index) => (
              <p key={index} className="text-sm text-destructive-foreground">
                <span className="font-medium">{alert.type}:</span> {alert.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('kpi.totalOrders')}</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.kpis.totalOrders ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('kpi.lifetime')}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('kpi.activeUsers')}</CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.kpis.activeUsers ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('kpi.last30Days')}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('kpi.messagesSent')}</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.kpis.messagesSent ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('kpi.autoManual')}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('kpi.responseRate')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.kpis.responseRate ?? 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">{t('kpi.feedback')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Alerts */}
      {hasAlerts && displayStats.alerts!.filter((a) => a.severity === 'info').length > 0 && (
        <div className="space-y-2">
          {displayStats.alerts!.filter((a) => a.severity === 'info').map((alert, index) => (
            <div key={index} className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-lg border border-blue-100 text-blue-900">
              <Info className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="text-sm">
                <span className="font-semibold">{alert.type}:</span> {alert.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20">
            <CardTitle className="text-lg">{t('recentOrders.title')}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/products">{t('recentOrders.viewAll')}</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {displayStats.recentActivity.orders && displayStats.recentActivity.orders.length > 0 ? (
                displayStats.recentActivity.orders.map((order) => (
                  <div key={order.id} className="p-4 hover:bg-muted/50 transition-colors flex items-center justify-between">
                    <div>
                      <p className="font-medium">#{order.external_order_id}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
                    </div>
                    <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                      {order.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>{t('recentOrders.empty')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Conversations */}
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20">
            <CardTitle className="text-lg">{t('recentConversations.title')}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/conversations">{t('recentConversations.viewAll')}</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {displayStats.recentActivity.conversations && displayStats.recentActivity.conversations.length > 0 ? (
                displayStats.recentActivity.conversations.map((conv) => (
                  <Link key={conv.id} href={`/dashboard/conversations/${conv.id}`} className="block">
                    <div className="p-4 hover:bg-muted/50 transition-colors flex items-center justify-between">
                      <div>
                        <p className="font-medium">Conversation #{conv.id.substring(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{conv.message_count} messages • {formatDateTime(conv.last_message_at)}</p>
                      </div>
                      <Badge variant={conv.status === 'active' ? 'default' : 'secondary'}>
                        {conv.status}
                      </Badge>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>{t('recentConversations.empty')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <h2 className="text-lg font-semibold">{t('quickActions.title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/dashboard/products" className="group">
          <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer border-dashed hover:border-solid hover:border-primary/50">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold">{t('quickActions.addProduct')}</p>
                <p className="text-sm text-muted-foreground">{t('quickActions.addProductDesc')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/integrations" className="group">
          <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer border-dashed hover:border-solid hover:border-primary/50">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <ArrowRight className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold">{t('quickActions.integration')}</p>
                <p className="text-sm text-muted-foreground">{t('quickActions.integrationDesc')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/settings" className="group">
          <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer border-dashed hover:border-solid hover:border-primary/50">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold">{t('quickActions.settings')}</p>
                <p className="text-sm text-muted-foreground">{t('quickActions.settingsDesc')}</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
