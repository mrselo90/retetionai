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
      <div className="space-y-6 p-1 animate-fade-in">
        <div className="space-y-3">
          <div className="h-10 w-56 bg-gradient-to-r from-zinc-200 to-zinc-100 rounded-xl animate-pulse" />
          <div className="h-5 w-80 bg-gradient-to-r from-zinc-100 to-zinc-50 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white border-2 border-zinc-100 rounded-xl animate-pulse shadow-sm" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-white border-2 border-zinc-100 rounded-xl animate-pulse shadow-sm" />
          <div className="h-96 bg-white border-2 border-zinc-100 rounded-xl animate-pulse shadow-sm" />
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
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 px-8 py-10 text-primary-foreground shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bS0yIDJ2LTJoLTJ2Mmgyem0tNCAydi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bTI4IDMydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptLTIgMnYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            {t('greeting', { name: merchant?.name || 'Merchant' })}
          </h1>
          <p className="text-primary-foreground/90 text-lg max-w-2xl">
            {t.rich('summary', {
              activeUsers: displayStats.kpis.activeUsers ?? 0,
              responseRate: displayStats.kpis.responseRate ?? 0,
              bold: (chunks) => <span className="font-bold text-primary-foreground">{chunks}</span>
            })}
          </p>
        </div>
      </div>

      {/* Critical Alerts */}
      {hasErrorAlerts && (
        <div className="rounded-xl border-2 border-destructive/30 bg-gradient-to-r from-destructive/10 to-destructive/5 px-5 py-5 shadow-sm animate-slide-down">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card hover className="group overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">{t('kpi.totalOrders')}</CardTitle>
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{displayStats.kpis.totalOrders ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-2 font-medium">{t('kpi.lifetime')}</p>
          </CardContent>
        </Card>
        <Card hover className="group overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">{t('kpi.activeUsers')}</CardTitle>
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
              <ArrowRight className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-success">{displayStats.kpis.activeUsers ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-2 font-medium">{t('kpi.last30Days')}</p>
          </CardContent>
        </Card>
        <Card hover className="group overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">{t('kpi.messagesSent')}</CardTitle>
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center group-hover:bg-info/20 transition-colors">
              <MessageSquare className="h-5 w-5 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-info">{displayStats.kpis.messagesSent ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-2 font-medium">{t('kpi.autoManual')}</p>
          </CardContent>
        </Card>
        <Card hover className="group overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">{t('kpi.responseRate')}</CardTitle>
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center group-hover:bg-warning/20 transition-colors">
              <BarChart3 className="h-5 w-5 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-warning">{displayStats.kpis.responseRate ?? 0}%</div>
            <p className="text-xs text-muted-foreground mt-2 font-medium">{t('kpi.feedback')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Alerts */}
      {hasAlerts && displayStats.alerts!.filter((a) => a.severity === 'info').length > 0 && (
        <div className="space-y-3">
          {displayStats.alerts!.filter((a) => a.severity === 'info').map((alert, index) => (
            <div key={index} className="flex items-start gap-4 bg-gradient-to-r from-info/10 to-info/5 p-5 rounded-xl border border-info/20 shadow-sm animate-slide-down">
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
        <Card className="col-span-1 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4 bg-gradient-to-r from-muted/30 to-muted/10">
            <CardTitle className="text-lg font-bold">{t('recentOrders.title')}</CardTitle>
            <Button variant="ghost" size="sm" asChild className="hover:bg-primary/15">
              <Link href="/dashboard/products">{t('recentOrders.viewAll')}</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {displayStats.recentActivity.orders && displayStats.recentActivity.orders.length > 0 ? (
                displayStats.recentActivity.orders.map((order, idx) => (
                  <div key={order.id} className="p-4 hover:bg-muted/30 transition-all duration-200 flex items-center justify-between group" style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                        <ShoppingBag className="w-5 h-5 text-primary" />
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
        <Card className="col-span-1 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4 bg-gradient-to-r from-muted/30 to-muted/10">
            <CardTitle className="text-lg font-bold">{t('recentConversations.title')}</CardTitle>
            <Button variant="ghost" size="sm" asChild className="hover:bg-primary/15">
              <Link href="/dashboard/conversations">{t('recentConversations.viewAll')}</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {displayStats.recentActivity.conversations && displayStats.recentActivity.conversations.length > 0 ? (
                displayStats.recentActivity.conversations.map((conv, idx) => (
                  <Link key={conv.id} href={`/dashboard/conversations/${conv.id}`} className="block">
                    <div className="p-4 hover:bg-muted/30 transition-all duration-200 flex items-center justify-between group" style={{ animationDelay: `${idx * 50}ms` }}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center group-hover:bg-info/20 transition-colors">
                          <MessageSquare className="w-5 h-5 text-info" />
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
        <h2 className="text-xl font-bold tracking-tight">{t('quickActions.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Link href="/dashboard/products" className="group">
            <Card hover className="h-full cursor-pointer border-2 border-dashed hover:border-primary/50 hover:border-solid">
              <CardContent className="p-6 flex items-start gap-5">
                <div className="flex-shrink-0 p-4 rounded-xl bg-primary text-primary-foreground group-hover:scale-105 transition-transform duration-200 shadow-lg">
                  <Package className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-base mb-1 group-hover:text-primary transition-colors">{t('quickActions.addProduct')}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t('quickActions.addProductDesc')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/integrations" className="group">
            <Card hover className="h-full cursor-pointer border-2 border-dashed hover:border-primary/50 hover:border-solid">
              <CardContent className="p-6 flex items-start gap-5">
                <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-info to-info/80 text-info-foreground group-hover:scale-110 transition-transform duration-200 shadow-lg">
                  <ArrowRight className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-base mb-1 group-hover:text-info transition-colors">{t('quickActions.integration')}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t('quickActions.integrationDesc')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/settings" className="group">
            <Card hover className="h-full cursor-pointer border-2 border-dashed hover:border-primary/50 hover:border-solid">
              <CardContent className="p-6 flex items-start gap-5">
                <div className="flex-shrink-0 p-4 rounded-xl bg-gradient-to-br from-warning to-warning/80 text-warning-foreground group-hover:scale-110 transition-transform duration-200 shadow-lg">
                  <BarChart3 className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-base mb-1 group-hover:text-warning transition-colors">{t('quickActions.settings')}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t('quickActions.settingsDesc')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
