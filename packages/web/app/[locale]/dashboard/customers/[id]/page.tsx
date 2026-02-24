'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Badge, BlockStack, Box, Button, Card as PolarisCard, InlineGrid, InlineStack, Layout, Page, SkeletonPage, Text } from '@shopify/polaris';
import { Link } from '@/i18n/routing';
import {
  Users, ShoppingBag, MessageSquare, TrendingUp, Calendar,
  ArrowLeft, AlertTriangle, Star,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

const SEGMENT_TONES: Record<string, Parameters<typeof Badge>[0]['tone']> = {
  champions: 'success',
  loyal: 'info',
  promising: 'attention',
  at_risk: 'warning',
  lost: 'critical',
  new: 'enabled',
};

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email?: string;
  consent: string;
  segment: string;
  rfmScore: { recency: number; frequency: number; monetary: number };
  churnProbability: number;
  createdAt: string;
  metrics: {
    orderCount: number;
    totalConversations: number;
    avgSentiment: number;
    lastOrderDate: string | null;
    lastInteractionDate: string | null;
  };
  orders: Array<{ id: string; externalOrderId: string; status: string; deliveryDate?: string; createdAt: string }>;
  conversations: Array<{ id: string; orderId?: string; messageCount: number; status: string; createdAt: string; updatedAt: string }>;
  feedback: Array<{ id: string; type: string; status: string; rating?: number; createdAt: string }>;
}

export default function CustomerDetailPage() {
  const t = useTranslations('CustomerDetail');
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  const loadCustomer = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await authenticatedRequest<{ customer: CustomerDetail }>(
        `/api/customers/${customerId}`, session.access_token
      );
      setCustomer(response.customer);
    } catch (err) {
      toast.error(t('toasts.loadError.title'), t('toasts.loadError.message'));
      router.push('/dashboard/customers');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <SkeletonPage title={t('backToCustomers')}>
        <Layout>
          <Layout.Section>
            <PolarisCard>
              <Box padding="400">
                <div className="space-y-4 animate-pulse">
                  <div className="h-8 w-48 bg-zinc-200 rounded" />
                  <div className="h-96 bg-zinc-200 rounded" />
                </div>
              </Box>
            </PolarisCard>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  if (!customer) {
    return (
      <Page title={t('backToCustomers')}>
        <Layout>
          <Layout.Section>
            <PolarisCard>
              <Box padding="800">
              <div className="text-center">
                <Text as="p" tone="subdued">{t('notFound')}</Text>
              </div>
              </Box>
            </PolarisCard>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const rfm = customer.rfmScore || { recency: 0, frequency: 0, monetary: 0 };

  return (
    <Page title={customer.name} subtitle={customer.phone} fullWidth>
      <Layout>
        <Layout.Section>
    <BlockStack gap="500">
      {/* Header */}
      <PolarisCard>
        <Box padding="400">
          <BlockStack gap="300">
            <InlineStack align="start">
              <Button variant="plain" onClick={() => router.push('/dashboard/customers')}>
                {t('backToCustomers')}
              </Button>
            </InlineStack>
            <InlineStack gap="400" blockAlign="center">
              <Box background="bg-surface-secondary" borderRadius="full" padding="400">
                <Users className="w-8 h-8 text-zinc-700" />
              </Box>
              <BlockStack gap="100">
                <InlineStack gap="200" blockAlign="center" wrap>
                  <Text as="h1" variant="headingLg">{customer.name}</Text>
                  <Badge tone={SEGMENT_TONES[customer.segment] || 'enabled'}>
                    {t(`segment.${customer.segment}`) || customer.segment}
                  </Badge>
                  {customer.churnProbability > 0.6 && (
                    <Badge tone="critical">{`${t('churnRisk')} ${Math.round(customer.churnProbability * 100)}%`}</Badge>
                  )}
                </InlineStack>
                <Text as="p" tone="subdued">{customer.phone}{customer.email ? ` • ${customer.email}` : ''}</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {t('registered')}: {formatDate(customer.createdAt)} • {t('consent')}: {customer.consent}
                </Text>
              </BlockStack>
            </InlineStack>
          </BlockStack>
        </Box>
      </PolarisCard>

      {/* Metrics Cards */}
      <InlineGrid columns={{ xs: '1fr 1fr', md: 'repeat(5, minmax(0, 1fr))' }} gap="300">
        <PolarisCard>
          <Box padding="300">
            <BlockStack gap="100" inlineAlign="center">
            <ShoppingBag className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <Text as="p" variant="headingMd">{String(customer.metrics.orderCount)}</Text>
            <Text as="p" variant="bodySm" tone="subdued">Sipariş</Text>
            </BlockStack>
          </Box>
        </PolarisCard>
        <PolarisCard>
          <Box padding="300">
            <BlockStack gap="100" inlineAlign="center">
            <MessageSquare className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <Text as="p" variant="headingMd">{String(customer.metrics.totalConversations)}</Text>
            <Text as="p" variant="bodySm" tone="subdued">Konuşma</Text>
            </BlockStack>
          </Box>
        </PolarisCard>
        <PolarisCard>
          <Box padding="300">
            <BlockStack gap="100" inlineAlign="center">
            <Star className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <Text as="p" variant="headingMd">{String(customer.metrics.avgSentiment || '—')}</Text>
            <Text as="p" variant="bodySm" tone="subdued">Ort. Duygu</Text>
            </BlockStack>
          </Box>
        </PolarisCard>
        <PolarisCard>
          <Box padding="300">
            <BlockStack gap="100" inlineAlign="center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <Text as="p" variant="headingMd">{`${rfm.recency}/${rfm.frequency}/${rfm.monetary}`}</Text>
            <Text as="p" variant="bodySm" tone="subdued">RFM</Text>
            </BlockStack>
          </Box>
        </PolarisCard>
        <PolarisCard>
          <Box padding="300">
            <BlockStack gap="100" inlineAlign="center">
            <Calendar className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <Text as="p" variant="headingMd">{customer.metrics.lastOrderDate ? formatDate(customer.metrics.lastOrderDate) : '—'}</Text>
            <Text as="p" variant="bodySm" tone="subdued">{t('lastOrder')}</Text>
            </BlockStack>
          </Box>
        </PolarisCard>
      </InlineGrid>

      <InlineGrid columns={{ xs: '1fr', lg: '1fr 1fr' }} gap="400">
        {/* Orders */}
        <PolarisCard>
          <Box padding="400">
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">{t('ordersCount', { count: customer.orders.length })}</Text>
            {customer.orders.length === 0 ? (
              <Text as="p" variant="bodySm" tone="subdued">{t('noOrders')}</Text>
            ) : (
              <div className="space-y-3">
                {customer.orders.slice(0, 10).map((order) => (
                  <Box key={order.id} padding="300" borderRadius="300" background="bg-surface-secondary">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="medium">{`#${order.externalOrderId}`}</Text>
                        <Text as="p" variant="bodySm" tone="subdued">{formatDate(order.createdAt)}</Text>
                      </BlockStack>
                      <Badge tone={order.status === 'delivered' ? 'success' : 'enabled'}>{order.status}</Badge>
                    </InlineStack>
                  </Box>
                ))}
              </div>
            )}
            </BlockStack>
          </Box>
        </PolarisCard>

        {/* Conversations */}
        <PolarisCard>
          <Box padding="400">
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">{t('conversationsCount', { count: customer.conversations.length })}</Text>
            {customer.conversations.length === 0 ? (
              <Text as="p" variant="bodySm" tone="subdued">{t('noConversations')}</Text>
            ) : (
              <div className="space-y-3">
                {customer.conversations.slice(0, 10).map((conv) => (
                  <Link key={conv.id} href={`/dashboard/conversations/${conv.id}`} className="block p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="medium">{`${conv.messageCount} mesaj`}</Text>
                        <Text as="p" variant="bodySm" tone="subdued">{formatDate(conv.updatedAt)}</Text>
                      </BlockStack>
                      <Badge tone={conv.status === 'human' ? 'critical' : conv.status === 'resolved' ? 'success' : 'enabled'}>
                        {conv.status === 'human' ? t('statusHuman') : conv.status === 'resolved' ? t('statusResolved') : t('statusAi')}
                      </Badge>
                    </InlineStack>
                  </Link>
                ))}
              </div>
            )}
            </BlockStack>
          </Box>
        </PolarisCard>
      </InlineGrid>

      {/* Feedback */}
      {customer.feedback.length > 0 && (
        <PolarisCard>
          <Box padding="400">
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Geri Bildirim</Text>
            <div className="space-y-3">
              {customer.feedback.map((fb) => (
                <Box key={fb.id} padding="300" borderRadius="300" background="bg-surface-secondary">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="p" variant="bodyMd" fontWeight="medium">{fb.type === 'nps' ? t('feedbackNps') : t('feedbackReview')}</Text>
                      <Text as="p" variant="bodySm" tone="subdued">{formatDate(fb.createdAt)}</Text>
                    </BlockStack>
                    <InlineStack gap="200" blockAlign="center">
                      {fb.rating && <Text as="span" variant="bodyMd" fontWeight="medium">{`${fb.rating}/10`}</Text>}
                      <Badge tone={fb.status === 'completed' ? 'success' : 'enabled'}>{fb.status}</Badge>
                    </InlineStack>
                  </InlineStack>
                </Box>
              ))}
            </div>
            </BlockStack>
          </Box>
        </PolarisCard>
      )}
    </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
