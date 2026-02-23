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
      <div className="space-y-6 p-1">
        <div className="space-y-3">
          <div className="h-10 w-56 bg-muted rounded-lg animate-pulse" />
          <div className="h-5 w-80 bg-gradient-to-r from-zinc-100 to-zinc-50 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-card border border-border rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-card border border-border rounded-lg animate-pulse" />
          <div className="h-96 bg-card border border-border rounded-lg animate-pulse" />
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
    <div className="space-y-6 pb-8">
      {/* Welcome Banner — Polaris-like card */}
      <Card className="overflow-hidden">
        <CardContent className="px-6 py-6">
          <h1 className="page-title mb-2">
            {t('greeting', { name: merchant?.name || 'Merchant' })}
          </h1>
          <p className="page-description max-w-2xl">
            {t.rich('summary', {
              activeUsers: displayStats.kpis.activeUsers ?? 0,
              responseRate: displayStats.kpis.responseRate ?? 0,
              bold: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>
            })}
          </p>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {hasErrorAlerts && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <p className="font-bold text-destructive text-lg">{t('actionRequired')}</p>
          </div>
          <div className="space-y-2.5 pl-13">
            {displayStats.alerts!.filter((a) => a.severity === 'error' || a.severity === 'warning').map((alert, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 flex-shrink-0"></div>
                <p className="text-sm text-destructive-foreground flex-1">
                  <span className="font-semibold">{alert.type}:</span> {alert.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('kpi.totalOrders')}</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-zinc-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.kpis.totalOrders ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('kpi.lifetime')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('kpi.activeUsers')}</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ArrowRight className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.kpis.activeUsers ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('kpi.last30Days')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('kpi.messagesSent')}</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.kpis.messagesSent ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('kpi.autoManual')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('kpi.responseRate')}</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{displayStats.kpis.responseRate ?? 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">{t('kpi.feedback')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Alerts */}
      {hasAlerts && displayStats.alerts!.filter((a) => a.severity === 'info').length > 0 && (
        <div className="space-y-3">
          {displayStats.alerts!.filter((a) => a.severity === 'info').map((alert, index) => (
            <div key={index} className="flex items-start gap-4 bg-info/5 p-4 rounded-lg border border-info/20 shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-info/20 flex items-center justify-center">
                <Info className="w-5 h-5 text-info" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-info text-sm mb-0.5">{alert.type}</p>
                <p className="text-sm text-foreground/80">{alert.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold">{t('recentOrders.title')}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/products">{t('recentOrders.viewAll')}</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {displayStats.recentActivity.orders && displayStats.recentActivity.orders.length > 0 ? (
                displayStats.recentActivity.orders.map((order, idx) => (
                  <div key={order.id} className="p-4 hover:bg-zinc-50 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4 text-zinc-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">#{order.external_order_id}</p>
                        <p className="text-xs text-muted-foreground font-medium">{formatDateTime(order.created_at)}</p>
                      </div>
                    </div>
                    <Badge variant={order.status === 'delivered' ? 'success' : 'secondary'} className="shadow-sm">
                      {order.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 opacity-40" />
                  </div>
                  <p className="font-medium">{t('recentOrders.empty')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Conversations */}
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold">{t('recentConversations.title')}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/conversations">{t('recentConversations.viewAll')}</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {displayStats.recentActivity.conversations && displayStats.recentActivity.conversations.length > 0 ? (
                displayStats.recentActivity.conversations.map((conv, idx) => (
                  <Link key={conv.id} href={`/dashboard/conversations/${conv.id}`} className="block">
                    <div className="p-4 hover:bg-zinc-50 transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                          <MessageSquare className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">Conversation #{conv.id.substring(0, 8)}</p>
                          <p className="text-xs text-muted-foreground font-medium">{conv.message_count} messages • {formatDateTime(conv.last_message_at)}</p>
                        </div>
                      </div>
                      <Badge variant={conv.status === 'active' ? 'info' : 'secondary'} className="shadow-sm">
                        {conv.status}
                      </Badge>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 opacity-40" />
                  </div>
                  <p className="font-medium">{t('recentConversations.empty')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold">{t('quickActions.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/dashboard/products">
            <Card hover className="h-full cursor-pointer">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="flex-shrink-0 p-3 rounded-lg bg-zinc-100">
                  <Package className="w-5 h-5 text-zinc-700" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">{t('quickActions.addProduct')}</p>
                  <p className="text-sm text-muted-foreground">{t('quickActions.addProductDesc')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/integrations">
            <Card hover className="h-full cursor-pointer">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="flex-shrink-0 p-3 rounded-lg bg-blue-50">
                  <ArrowRight className="w-5 h-5 text-blue-700" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">{t('quickActions.integration')}</p>
                  <p className="text-sm text-muted-foreground">{t('quickActions.integrationDesc')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/settings">
            <Card hover className="h-full cursor-pointer">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="flex-shrink-0 p-3 rounded-lg bg-amber-50">
                  <BarChart3 className="w-5 h-5 text-amber-700" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">{t('quickActions.settings')}</p>
                  <p className="text-sm text-muted-foreground">{t('quickActions.settingsDesc')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
