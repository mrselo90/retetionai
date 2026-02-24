'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Link } from '@/i18n/routing';
import {
  Badge as PolarisBadge,
  BlockStack,
  Box,
  Button as PolarisButton,
  Card as PolarisCard,
  IndexTable,
  InlineStack,
  Layout,
  Page,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Tabs,
  Text,
  TextField,
  useBreakpoints,
} from '@shopify/polaris';
import { Users, Search, ShoppingBag, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Customer {
  id: string;
  name: string;
  phone: string;
  consent: string;
  segment: string;
  rfmScore: { recency: number; frequency: number; monetary: number };
  churnProbability: number;
  orderCount: number;
  conversationCount: number;
  createdAt: string;
}

const SEGMENT_TONES: Record<string, Parameters<typeof PolarisBadge>[0]['tone']> = {
  champions: 'success',
  loyal: 'info',
  promising: 'attention',
  at_risk: 'warning',
  lost: 'critical',
  new: 'enabled',
};

export default function CustomersPage() {
  const t = useTranslations('Customers');
  const { mdUp } = useBreakpoints();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [segment, setSegment] = useState('all');
  const [search, setSearch] = useState('');

  const loadCustomers = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let url = `/api/customers?page=${page}&limit=20`;
      if (segment !== 'all') url += `&segment=${segment}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const response = await authenticatedRequest<{ customers: Customer[]; total: number }>(url, session.access_token);
      setCustomers(response.customers);
      setTotal(response.total);
    } catch {
      toast.error(t('toasts.loadError.title'), t('toasts.loadError.message'));
    } finally {
      setLoading(false);
    }
  }, [page, segment, search, t]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const handleSearch = () => {
    setPage(1);
    void loadCustomers();
  };

  const totalPages = Math.ceil(total / 20);
  const segmentTabs = ['all', 'champions', 'loyal', 'promising', 'at_risk', 'lost', 'new'].map((s) => ({
    id: s,
    content: s === 'all' ? t('filterAll') : t(`segment.${s}`),
  }));
  const selectedSegmentTab = Math.max(0, segmentTabs.findIndex((tab) => tab.id === segment));

  if (loading) {
    return (
      <SkeletonPage title={t('title')}>
        <Layout>
          <Layout.Section>
            <PolarisCard>
              <BlockStack gap="300">
                <SkeletonDisplayText size="small" maxWidth="18ch" />
                <SkeletonBodyText lines={2} />
              </BlockStack>
            </PolarisCard>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page title={t('title')} subtitle={t('subtitle', { total })}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">

      {/* Search + Segment Filter */}
      <div className="flex flex-col gap-3">
        <div className="w-full sm:max-w-sm">
          <TextField
            label={t('searchPlaceholder')}
            labelHidden
            autoComplete="off"
            value={search}
            onChange={setSearch}
            placeholder={t('searchPlaceholder')}
            prefix={<Search className="w-4 h-4" aria-hidden />}
          />
        </div>
        <Tabs
          tabs={segmentTabs}
          selected={selectedSegmentTab}
          onSelect={(index) => {
            setSegment(segmentTabs[index]?.id || 'all');
            setPage(1);
          }}
        />
        <InlineStack align="start">
          <PolarisButton variant="secondary" size="slim" onClick={handleSearch}>
            {t('search')}
          </PolarisButton>
        </InlineStack>
      </div>

      {/* Customer List */}
      {customers.length === 0 ? (
        <PolarisCard>
          <Box padding="600">
            <BlockStack gap="300" inlineAlign="center">
              <Users className="w-12 h-12 text-zinc-500" />
              <Text as="h2" variant="headingSm">{t('empty.title')}</Text>
              <Text as="p" variant="bodyMd" tone="subdued" alignment="center">{t('empty.description')}</Text>
            </BlockStack>
          </Box>
        </PolarisCard>
      ) : mdUp ? (
        <PolarisCard padding="0">
          <IndexTable
            resourceName={{ singular: 'customer', plural: 'customers' }}
            itemCount={customers.length}
            selectable={false}
            headings={[
              { title: t('title') },
              { title: t('orders') },
              { title: t('conversations') },
              { title: 'Churn' },
            ]}
          >
            {customers.map((customer, index) => (
              <IndexTable.Row
                id={customer.id}
                key={customer.id}
                position={index}
                onClick={() => { window.location.href = `/dashboard/customers/${customer.id}`; }}
              >
                <IndexTable.Cell>
                  <InlineStack gap="300" blockAlign="center">
                    <Box background="bg-surface-secondary" borderRadius="full" padding="200">
                      <Users className="w-4 h-4 text-zinc-700" />
                    </Box>
                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{customer.name}</Text>
                        <PolarisBadge tone={SEGMENT_TONES[customer.segment] || 'enabled'}>
                          {t(`segment.${customer.segment}`) || customer.segment}
                        </PolarisBadge>
                        {customer.churnProbability > 0.6 && (
                          <PolarisBadge tone="critical">{`Risk ${Math.round(customer.churnProbability * 100)}%`}</PolarisBadge>
                        )}
                      </InlineStack>
                      <Text as="span" variant="bodySm" tone="subdued">{customer.phone}</Text>
                    </BlockStack>
                  </InlineStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="100" blockAlign="center">
                    <ShoppingBag className="w-4 h-4 text-zinc-500" />
                    <Text as="span" variant="bodySm">{String(customer.orderCount)}</Text>
                  </InlineStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <InlineStack gap="100" blockAlign="center">
                    <MessageSquare className="w-4 h-4 text-zinc-500" />
                    <Text as="span" variant="bodySm">{String(customer.conversationCount)}</Text>
                  </InlineStack>
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" variant="bodySm">
                    {`${Math.round(customer.churnProbability * 100)}%`}
                  </Text>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        </PolarisCard>
      ) : (
        <PolarisCard>
          <div className="divide-y">
            {customers.map((customer) => (
              <Link
                key={customer.id}
                href={`/dashboard/customers/${customer.id}`}
                className="block p-5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">{customer.name}</Text>
                        <PolarisBadge tone={SEGMENT_TONES[customer.segment] || 'enabled'}>
                          {t(`segment.${customer.segment}`) || customer.segment}
                        </PolarisBadge>
                        {customer.churnProbability > 0.6 && (
                          <PolarisBadge tone="critical">{`Risk ${Math.round(customer.churnProbability * 100)}%`}</PolarisBadge>
                        )}
                      </div>
                      <Text as="p" variant="bodySm" tone="subdued">{customer.phone}</Text>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4" />
                      <span>{customer.orderCount} {t('orders')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4" />
                      <span>{customer.conversationCount} {t('conversations')}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </PolarisCard>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <InlineStack align="center" gap="200">
          <PolarisButton variant="secondary" size="slim" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('previous')}
          </PolarisButton>
          <Text as="span" variant="bodySm" tone="subdued">Sayfa {page} / {totalPages}</Text>
          <PolarisButton variant="secondary" size="slim" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            {t('next')}
          </PolarisButton>
        </InlineStack>
      )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
