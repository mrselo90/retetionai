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
  Icon,
  EmptyState,
} from '@shopify/polaris';
import {
  OrderFilledIcon,
  PersonIcon,
  ChatIcon,
  ProductIcon,
  ChartVerticalIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  SearchIcon,
} from '@shopify/polaris-icons';
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
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
}) {
  return (
    <PolarisCard>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="start" gap="200">
          <Box
            background="bg-surface-secondary"
            borderRadius="200"
            padding="200"
          >
            <Icon source={icon} tone="subdued" />
          </Box>
        </InlineStack>
        <BlockStack gap="050">
          <Text as="p" variant="headingXl" fontWeight="semibold">
            {String(value)}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {title}
          </Text>
          <Text as="p" variant="bodyXs" tone="subdued">
            {hint}
          </Text>
        </BlockStack>
      </BlockStack>
    </PolarisCard>
  );
}

function ListEmptyPolaris({
  title,
  description,
  actionLabel,
  actionUrl,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionUrl?: string;
}) {
  return (
    <EmptyState
      heading={title}
      action={actionLabel && actionUrl ? { content: actionLabel, url: actionUrl } : undefined}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      fullWidth
    >
      <p>{description}</p>
    </EmptyState>
  );
}

function DashboardIconTile({
  icon,
  background,
}: {
  icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  background?: string;
}) {
  return (
    <Box
      background={(background || 'bg-surface-secondary') as any}
      borderRadius="200"
      padding="100"
    >
      <Icon source={icon} tone="subdued" />
    </Box>
  );
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
      <SkeletonPage title={t('title')} primaryAction>
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
      <Page title={t('title')}>
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
    <Page
      title={t('greeting', { name: merchant.name || 'Merchant' })}
      subtitle={t.markup('summary', {
        activeUsers: displayStats.kpis.activeUsers ?? 0,
        responseRate: displayStats.kpis.responseRate ?? 0,
        bold: (chunks) => chunks,
      })}
    >
      <Layout>
        {(topAlert || nextStep) && (
          <Layout.Section>
            <Banner
              title={nextStep ? t('setup.bannerTitle') : t('alerts.title')}
              tone={topAlert?.severity === 'error' ? 'critical' : topAlert?.severity === 'warning' ? 'warning' : 'info'}
              action={nextStep ? { content: nextStep.actionLabel, url: nextStep.actionUrl } : undefined}
            >
              <BlockStack gap="200">
                {nextStep ? (
                  <Text as="p" variant="bodySm">
                    {t('setup.bannerMessage', { step: nextStep.title })}
                  </Text>
                ) : null}
                {topAlert ? (
                  <Text as="p" variant="bodySm">
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      {alertTypeLabel(topAlert.type)}:
                    </Text>{' '}
                    {topAlert.message}
                  </Text>
                ) : null}
              </BlockStack>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <PolarisCard>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center" gap="300">
                <Text as="h2" variant="headingSm">
                  {t('setup.title')}
                </Text>
                <PolarisBadge tone={nextStep ? 'attention' : 'success'}>
                  {t('setup.progress', { completed: completedSteps, total: setupSteps.length })}
                </PolarisBadge>
              </InlineStack>

              {/* Horizontal stepper */}
              <div className="flex items-start gap-0">
                {setupSteps.map((step, index) => {
                  const isCurrent = !step.completed && nextStep?.id === step.id;
                  return (
                    <div key={step.id} className="flex-1 flex flex-col items-center relative">
                      {/* Connector line (not for last item) */}
                      {index < setupSteps.length - 1 && (
                        <div className={`absolute top-4 left-1/2 w-full h-0.5 ${step.completed ? 'bg-[var(--p-color-border-success)]' : 'bg-[var(--p-color-border-secondary)]'}`} aria-hidden="true" />
                      )}
                      {/* Step circle */}
                      <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 text-xs font-bold ${
                        step.completed
                          ? 'bg-[var(--p-color-bg-fill-success)] border-[var(--p-color-border-success)] text-[var(--p-color-text-success)]'
                          : isCurrent
                            ? 'bg-[var(--p-color-bg-fill-info-secondary)] border-[var(--p-color-border-info)] text-[var(--p-color-text-info)]'
                            : 'bg-[var(--p-color-bg-surface-secondary)] border-[var(--p-color-border-secondary)] text-[var(--p-color-text-secondary)]'
                      }`}>
                        {step.completed ? (
                          <Icon source={CheckCircleIcon} tone="success" />
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </div>
                      {/* Step title */}
                      <Text as="p" variant="bodyXs" alignment="center" fontWeight={isCurrent ? 'semibold' : 'regular'}>
                        {step.title}
                      </Text>
                    </div>
                  );
                })}
              </div>

              {/* Active step detail */}
              {nextStep && (
                <Box
                  borderWidth="025"
                  borderColor="border-info"
                  borderRadius="300"
                  padding="300"
                  background="bg-fill-info-secondary"
                >
                  <InlineStack align="space-between" blockAlign="center" gap="300">
                    <BlockStack gap="050">
                      <Text as="p" variant="bodySm" fontWeight="semibold">
                        {nextStep.title}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {nextStep.description}
                      </Text>
                    </BlockStack>
                    <PolarisButton url={nextStep.actionUrl} variant="primary" size="slim">
                      {nextStep.actionLabel}
                    </PolarisButton>
                  </InlineStack>
                </Box>
              )}
            </BlockStack>
          </PolarisCard>
        </Layout.Section>

        <Layout.Section>
          <PolarisCard>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center" gap="300">
                <BlockStack gap="050">
                  <Text as="h2" variant="headingSm">
                    {t('knowledge.title')}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {t('knowledge.subtitle')}
                  </Text>
                </BlockStack>
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p" variant="headingXl" fontWeight="bold">
                    {displayStats.knowledgeHealth.averageScore}
                  </Text>
                  <PolarisBadge tone={healthTone(displayStats.knowledgeHealth.averageScore)}>
                    {t('knowledge.averageBadge', { score: displayStats.knowledgeHealth.averageScore })}
                  </PolarisBadge>
                </InlineStack>
              </InlineStack>

              <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
                <Box borderWidth="025" borderColor="border" borderRadius="300" padding="300">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">
                      {t('knowledge.productsAtRisk')}
                    </Text>
                    <Text as="p" variant="headingLg">
                      {displayStats.knowledgeHealth.productsAtRisk}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {t('knowledge.productsAtRiskHint')}
                    </Text>
                  </BlockStack>
                </Box>
                <Box borderWidth="025" borderColor="border" borderRadius="300" padding="300">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">
                      {t('knowledge.strongProducts')}
                    </Text>
                    <Text as="p" variant="headingLg">
                      {displayStats.knowledgeHealth.strongProducts}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {t('knowledge.strongProductsHint')}
                    </Text>
                  </BlockStack>
                </Box>
                <Box borderWidth="025" borderColor="border" borderRadius="300" padding="300">
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm" tone="subdued">
                      {t('knowledge.primaryGap')}
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      {knowledgeReasonLabel(displayStats.knowledgeHealth.topMissingReasonCode)}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {displayStats.knowledgeHealth.topMissingReasonCount > 0
                        ? t('knowledge.primaryGapHint', { count: displayStats.knowledgeHealth.topMissingReasonCount })
                        : t('knowledge.noPrimaryGap')}
                    </Text>
                  </BlockStack>
                </Box>
              </InlineGrid>

              {displayStats.knowledgeHealth.productsAtRisk > 0 ? (
                <Banner
                  tone="warning"
                  title={t('knowledge.warningTitle')}
                  action={{ content: t('knowledge.warningAction'), url: '/dashboard/products' }}
                >
                  <Text as="p" variant="bodySm">
                    {t('knowledge.warningBody', {
                      count: displayStats.knowledgeHealth.productsAtRisk,
                      gap: knowledgeReasonLabel(displayStats.knowledgeHealth.topMissingReasonCode),
                    })}
                  </Text>
                </Banner>
              ) : null}
            </BlockStack>
          </PolarisCard>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, xl: 4 }} gap="400">
            <MetricCard
              title={t('kpi.ordersReceived')}
              value={displayStats.kpis.totalOrders ?? 0}
              hint={t('kpi.ordersReceivedHint')}
              icon={OrderFilledIcon}
            />
            <MetricCard
              title={t('kpi.activeCustomers')}
              value={displayStats.kpis.activeUsers ?? 0}
              hint={t('kpi.activeCustomersHint')}
              icon={PersonIcon}
            />
            <MetricCard
              title={t('kpi.whatsappMessages')}
              value={displayStats.kpis.messagesSent ?? 0}
              hint={t('kpi.whatsappMessagesHint')}
              icon={ChatIcon}
            />
            <MetricCard
              title={t('kpi.replyRate')}
              value={`${displayStats.kpis.responseRate ?? 0}%`}
              hint={t('kpi.replyRateHint')}
              icon={ChartVerticalIcon}
            />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <PolarisCard>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">
                    {t('recentOrders.title')}
                  </Text>
                  <PolarisButton url="/dashboard/conversations" variant="plain" size="slim">
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
                            <DashboardIconTile icon={OrderFilledIcon} />
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
                    <ListEmptyPolaris
                      title={t('recentOrders.emptyTitle')}
                      description={t('recentOrders.emptyDescription')}
                      actionLabel={ordersEmptyActionLabel}
                      actionUrl={ordersEmptyActionUrl}
                    />
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
                  <PolarisButton url="/dashboard/conversations" variant="plain" size="slim">
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
                              <DashboardIconTile
                                background="bg-fill-info-secondary"
                                icon={ChatIcon}
                              />
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
                    <ListEmptyPolaris
                      title={t('recentConversations.emptyTitle')}
                      description={t('recentConversations.emptyDescription')}
                      actionLabel={conversationsEmptyActionLabel}
                      actionUrl={conversationsEmptyActionUrl}
                    />
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
                    <DashboardIconTile icon={ProductIcon} />
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
                    <DashboardIconTile
                      background="bg-fill-info-secondary"
                      icon={ChevronRightIcon}
                    />
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
                    <DashboardIconTile
                      background="bg-fill-caution-secondary"
                      icon={ChartVerticalIcon}
                    />
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
