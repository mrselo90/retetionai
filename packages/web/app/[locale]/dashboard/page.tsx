'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Link } from '@/i18n/routing';
import {
  Badge as PolarisBadge,
  Banner,
  BlockStack,
  Box,
  Button as PolarisButton,
  Card as PolarisCard,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Text,
} from '@shopify/polaris';
import { ArrowRight, BarChart3, MessageSquare, Package, ShoppingBag } from 'lucide-react';
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

const DEFAULT_STATS: DashboardStats = {
  kpis: { totalOrders: 0, activeUsers: 0, messagesSent: 0, totalProducts: 0, responseRate: 0 },
  recentActivity: { orders: [], conversations: [] },
  alerts: [],
};

function statusTone(status: string): Parameters<typeof PolarisBadge>[0]['tone'] {
  if (status === 'delivered' || status === 'active') return 'success';
  if (status === 'failed' || status === 'error') return 'critical';
  if (status === 'pending' || status === 'processing') return 'attention';
  return 'info';
}

function MetricCard({
  title,
  value,
  hint,
  icon,
  iconBgClassName,
  iconClassName,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
  iconBgClassName?: string;
  iconClassName?: string;
}) {
  return (
    <PolarisCard>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start" gap="200">
          <Text as="p" variant="bodySm" tone="subdued">
            {title}
          </Text>
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center bg-[hsl(var(--muted))] ${iconBgClassName ?? ''}`}
          >
            <span className={iconClassName}>{icon}</span>
          </div>
        </InlineStack>
        <BlockStack gap="100">
          <Text as="p" variant="headingLg" fontWeight="semibold">
            {String(value)}
          </Text>
          <Text as="p" variant="bodyXs" tone="subdued">
            {hint}
          </Text>
        </BlockStack>
      </BlockStack>
    </PolarisCard>
  );
}

function ListEmptyPolaris({ message }: { message: string }) {
  return (
    <Box padding="400">
      <BlockStack gap="200" inlineAlign="center">
        <Text as="p" variant="bodySm" tone="subdued" alignment="center">
          {message}
        </Text>
      </BlockStack>
    </Box>
  );
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
        const statsData = await authenticatedRequest<DashboardStats>(
          '/api/merchants/me/stats',
          session.access_token
        );
        setStats(statsData);
      } catch (statsErr: unknown) {
        console.warn('Dashboard stats failed:', statsErr);
        setStats(DEFAULT_STATS);
        const statsStatus =
          typeof statsErr === 'object' && statsErr !== null && 'status' in statsErr
            ? (statsErr as { status?: number }).status
            : undefined;
        if (statsStatus === 401) {
          toast.error('Session expired', 'Please login again');
          window.location.href = '/login';
          return;
        }
        toast.error('Failed to load stats', 'Showing dashboard with default values.');
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
        toast.error('Session expired', 'Please login again');
        window.location.href = '/login';
        return;
      }
      toast.error('Failed to load dashboard', errorMessage || 'Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      <SkeletonPage title="Dashboard" primaryAction>
        <Layout>
          <Layout.Section>
            <PolarisCard>
              <BlockStack gap="300">
                <SkeletonDisplayText size="small" maxWidth="24ch" />
                <SkeletonBodyText lines={2} />
              </BlockStack>
            </PolarisCard>
          </Layout.Section>
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, sm: 2, xl: 4 }} gap="400">
              {Array.from({ length: 4 }).map((_, idx) => (
                <PolarisCard key={idx}>
                  <BlockStack gap="300">
                    <SkeletonBodyText lines={1} />
                    <SkeletonDisplayText size="small" maxWidth="8ch" />
                    <SkeletonBodyText lines={1} />
                  </BlockStack>
                </PolarisCard>
              ))}
            </InlineGrid>
          </Layout.Section>
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
              <PolarisCard>
                <SkeletonBodyText lines={5} />
              </PolarisCard>
              <PolarisCard>
                <SkeletonBodyText lines={5} />
              </PolarisCard>
            </InlineGrid>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  if (!merchant) {
    return (
      <Page title="Dashboard">
        <Layout>
          <Layout.Section>
            <PolarisCard>
              <BlockStack gap="300" inlineAlign="center">
                <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                  {t('loadError')}
                </Text>
                <InlineStack align="center">
                  <PolarisButton onClick={() => { setLoading(true); void loadDashboard(); }} variant="primary">
                    {t('retry')}
                  </PolarisButton>
                </InlineStack>
              </BlockStack>
            </PolarisCard>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const displayStats = stats ?? DEFAULT_STATS;
  const hasAlerts = displayStats.alerts.length > 0;
  const criticalAlerts = displayStats.alerts.filter((a) => a.severity === 'error' || a.severity === 'warning');
  const infoAlerts = displayStats.alerts.filter((a) => a.severity === 'info');

  return (
    <Page
      title={t('greeting', { name: merchant.name || 'Merchant' })}
      subtitle={t('summary', {
        activeUsers: displayStats.kpis.activeUsers ?? 0,
        responseRate: displayStats.kpis.responseRate ?? 0,
      })}
    >
      <Layout>
        {criticalAlerts.length > 0 && (
          <Layout.Section>
            <Banner title={t('actionRequired')} tone="critical">
              <BlockStack gap="200">
                {criticalAlerts.map((alert, index) => (
                  <Text as="p" variant="bodySm" key={`${alert.type}-${index}`}>
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      {alert.type}:
                    </Text>{' '}
                    {alert.message}
                  </Text>
                ))}
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, xl: 4 }} gap="400">
            <MetricCard
              title={t('kpi.totalOrders')}
              value={displayStats.kpis.totalOrders ?? 0}
              hint={t('kpi.lifetime')}
              icon={<ShoppingBag className="h-4 w-4 text-zinc-700" />}
            />
            <MetricCard
              title={t('kpi.activeUsers')}
              value={displayStats.kpis.activeUsers ?? 0}
              hint={t('kpi.last30Days')}
              icon={<ArrowRight className="h-4 w-4 text-emerald-700" />}
              iconBgClassName="bg-emerald-100"
            />
            <MetricCard
              title={t('kpi.messagesSent')}
              value={displayStats.kpis.messagesSent ?? 0}
              hint={t('kpi.autoManual')}
              icon={<MessageSquare className="h-4 w-4 text-blue-700" />}
              iconBgClassName="bg-blue-100"
            />
            <MetricCard
              title={t('kpi.responseRate')}
              value={`${displayStats.kpis.responseRate ?? 0}%`}
              hint={t('kpi.feedback')}
              icon={<BarChart3 className="h-4 w-4 text-amber-700" />}
              iconBgClassName="bg-amber-100"
            />
          </InlineGrid>
        </Layout.Section>

        {hasAlerts && infoAlerts.length > 0 && (
          <Layout.Section>
            <BlockStack gap="300">
              {infoAlerts.map((alert, index) => (
                <Banner key={`${alert.type}-${index}`} title={alert.type} tone="info">
                  <Text as="p" variant="bodySm">
                    {alert.message}
                  </Text>
                </Banner>
              ))}
            </BlockStack>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <PolarisCard>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">
                    {t('recentOrders.title')}
                  </Text>
                  <PolarisButton url={`/${locale}/dashboard/products`} variant="plain" size="slim">
                    {t('recentOrders.viewAll')}
                  </PolarisButton>
                </InlineStack>

                <BlockStack gap="0">
                  {displayStats.recentActivity.orders.length > 0 ? (
                    displayStats.recentActivity.orders.map((order) => (
                      <Box
                        key={order.id}
                        borderBlockStartWidth="025"
                        borderColor="border"
                        paddingBlock="300"
                        paddingInline="0"
                      >
                        <InlineStack align="space-between" blockAlign="center" gap="300">
                          <InlineStack blockAlign="center" gap="300">
                            <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center">
                              <ShoppingBag className="w-4 h-4 text-zinc-600" />
                            </div>
                            <BlockStack gap="050">
                              <Text as="p" variant="bodySm" fontWeight="semibold">
                                #{order.external_order_id}
                              </Text>
                              <Text as="p" variant="bodyXs" tone="subdued">
                                {formatDateTime(order.created_at)}
                              </Text>
                            </BlockStack>
                          </InlineStack>
                          <PolarisBadge tone={statusTone(order.status)}>{order.status}</PolarisBadge>
                        </InlineStack>
                      </Box>
                    ))
                  ) : (
                    <ListEmptyPolaris message={t('recentOrders.empty')} />
                  )}
                </BlockStack>
              </BlockStack>
            </PolarisCard>

            <PolarisCard>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">
                    {t('recentConversations.title')}
                  </Text>
                  <PolarisButton url={`/${locale}/dashboard/conversations`} variant="plain" size="slim">
                    {t('recentConversations.viewAll')}
                  </PolarisButton>
                </InlineStack>

                <BlockStack gap="0">
                  {displayStats.recentActivity.conversations.length > 0 ? (
                    displayStats.recentActivity.conversations.map((conv) => (
                      <Box
                        key={conv.id}
                        borderBlockStartWidth="025"
                        borderColor="border"
                        paddingBlock="300"
                        paddingInline="0"
                      >
                        <Link href={`/dashboard/conversations/${conv.id}`} className="block no-underline">
                          <InlineStack align="space-between" blockAlign="center" gap="300">
                            <InlineStack blockAlign="center" gap="300">
                              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                                <MessageSquare className="w-4 h-4 text-blue-700" />
                              </div>
                              <BlockStack gap="050">
                                <Text as="p" variant="bodySm" fontWeight="semibold">
                                  Conversation #{conv.id.substring(0, 8)}
                                </Text>
                                <Text as="p" variant="bodyXs" tone="subdued">
                                  {conv.message_count} messages • {formatDateTime(conv.last_message_at)}
                                </Text>
                              </BlockStack>
                            </InlineStack>
                            <PolarisBadge tone={statusTone(conv.status)}>{conv.status}</PolarisBadge>
                          </InlineStack>
                        </Link>
                      </Box>
                    ))
                  ) : (
                    <ListEmptyPolaris message={t('recentConversations.empty')} />
                  )}
                </BlockStack>
              </BlockStack>
            </PolarisCard>
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              {t('quickActions.title')}
            </Text>
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              <Link href="/dashboard/products" className="block no-underline">
                <PolarisCard>
                  <InlineStack gap="300" blockAlign="start">
                    <div className="flex-shrink-0 p-3 rounded-lg bg-zinc-100">
                      <Package className="w-5 h-5 text-zinc-700" />
                    </div>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" fontWeight="semibold">
                        {t('quickActions.addProduct')}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {t('quickActions.addProductDesc')}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </PolarisCard>
              </Link>

              <Link href="/dashboard/integrations" className="block no-underline">
                <PolarisCard>
                  <InlineStack gap="300" blockAlign="start">
                    <div className="flex-shrink-0 p-3 rounded-lg bg-blue-100">
                      <ArrowRight className="w-5 h-5 text-blue-700" />
                    </div>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" fontWeight="semibold">
                        {t('quickActions.integration')}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {t('quickActions.integrationDesc')}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </PolarisCard>
              </Link>

              <Link href="/dashboard/settings" className="block no-underline">
                <PolarisCard>
                  <InlineStack gap="300" blockAlign="start">
                    <div className="flex-shrink-0 p-3 rounded-lg bg-amber-100">
                      <BarChart3 className="w-5 h-5 text-amber-700" />
                    </div>
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" fontWeight="semibold">
                        {t('quickActions.settings')}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {t('quickActions.settingsDesc')}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                </PolarisCard>
              </Link>
            </InlineGrid>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
