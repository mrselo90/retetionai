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
  Layout,
  Page,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Text,
} from '@shopify/polaris';
import { MessageSquare, User, ShoppingBag, Clock } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

interface Conversation {
  id: string;
  user: {
    id: string;
    name?: string;
    phone: string;
  };
  order?: {
    id: string;
    external_order_id: string;
    status: string;
  };
  message_count: number;
  last_message_at: string;
  created_at: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  conversationStatus?: 'ai' | 'human' | 'resolved';
  lastMessage?: { role: string; content: string; timestamp: string } | null;
  escalatedAt?: string | null;
  userName?: string;
  phone?: string;
}

export default function ConversationsPage() {
  const t = useTranslations('Conversations');
  const locale = useLocale();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ai' | 'human' | 'resolved'>('all');
  const [prevHumanCount, setPrevHumanCount] = useState(0);

  const loadConversations = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const response = await authenticatedRequest<{ conversations: Conversation[] }>(
        '/api/conversations',
        session.access_token
      );

      setConversations(response.conversations);

      // Update browser tab title with unresolved human count
      const humanCount = response.conversations.filter((c: Conversation) => c.conversationStatus === 'human').length;
      if (humanCount > 0) {
        document.title = `(${humanCount}) ${t('title')}`;
      } else {
        document.title = t('title');
      }

      // Toast when new human conversation appears (only after initial load)
      const isInitialLoad = prevHumanCount === 0 && loading;
      if (humanCount > prevHumanCount && !isInitialLoad && !loading) {
        toast.error(t('needsAttentionToast.title'), t('needsAttentionToast.message', { count: humanCount - prevHumanCount }));
      }
      setPrevHumanCount(humanCount);

    } catch (err: unknown) {
      console.error('Failed to load conversations:', err);
      const errorStatus =
        typeof err === 'object' && err !== null && 'status' in err
          ? (err as { status?: number }).status
          : undefined;
      if (errorStatus === 401) {
        toast.error(t('toasts.sessionExpired.title'), t('toasts.sessionExpired.message'));
        window.location.href = '/login';
      } else {
        toast.error(t('toasts.loadError.title'), t('toasts.loadError.message'));
      }
    } finally {
      setLoading(false);
    }
  }, [loading, prevHumanCount, t]);

  useEffect(() => {
    void loadConversations();

    const interval = setInterval(() => {
      void loadConversations();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadConversations]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('list.time.now');
    if (diffMins < 60) return t('list.time.minutesAgo', { m: diffMins });
    if (diffHours < 24) return t('list.time.hoursAgo', { h: diffHours });
    if (diffDays < 7) return t('list.time.daysAgo', { d: diffDays });

    return date.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😞';
      default:
        return '😐';
    }
  };

  const getSentimentBadgeTone = (sentiment: string): Parameters<typeof PolarisBadge>[0]['tone'] => {
    switch (sentiment) {
      case 'positive':
        return 'success';
      case 'negative':
        return 'critical';
      default:
        return 'enabled';
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    if (filter !== 'all' && conv.sentiment !== filter) return false;
    if (statusFilter !== 'all' && conv.conversationStatus !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <SkeletonPage title={t('title')}>
        <Layout>
          <Layout.Section>
            <PolarisCard>
              <BlockStack gap="300">
                <SkeletonDisplayText size="small" maxWidth="20ch" />
                <SkeletonBodyText lines={4} />
              </BlockStack>
            </PolarisCard>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page title={t('title')} subtitle={t('description')}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
      {/* Header */}
      <div className="space-y-1" />

      {/* Needs Attention Alert */}
      {(() => {
        const humanConvs = conversations.filter(c => c.conversationStatus === 'human');
        if (humanConvs.length === 0) return null;
        return (
          <Banner tone="critical" title={t('needsAttention.title', { count: humanConvs.length })}>
            <BlockStack gap="200">
              {humanConvs.slice(0, 5).map((conv) => (
                <Text as="p" variant="bodySm" key={conv.id}>
                  {(conv.userName || conv.user?.name || t('list.guest'))} · {conv.phone || conv.user?.phone}
                </Text>
              ))}
            </BlockStack>
          </Banner>
        );
      })()}

      {/* Filters: horizontal scroll on mobile, wrap on desktop */}
      <div className="space-y-2 sm:space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { key: 'all' as const, label: `${t('filters.all')} (${conversations.length})` },
            { key: 'positive' as const, label: `${t('filters.positive')} (${conversations.filter((c) => c.sentiment === 'positive').length})` },
            { key: 'neutral' as const, label: `${t('filters.neutral')} (${conversations.filter((c) => c.sentiment === 'neutral').length})` },
            { key: 'negative' as const, label: `${t('filters.negative')} (${conversations.filter((c) => c.sentiment === 'negative').length})` },
          ].map((f) => (
            <PolarisButton
              key={f.key}
              variant={filter === f.key ? 'primary' : 'secondary'}
              size="slim"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </PolarisButton>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { key: 'all' as const, label: t('filters.all') },
            { key: 'human' as const, label: t('filters.humanCount', { count: conversations.filter((c) => c.conversationStatus === 'human').length }) },
            { key: 'ai' as const, label: 'AI' },
            { key: 'resolved' as const, label: t('filters.resolved') },
          ].map((f) => (
            <PolarisButton
              key={`status-${f.key}`}
              variant={statusFilter === f.key ? 'primary' : 'secondary'}
              size="slim"
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </PolarisButton>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      {filteredConversations.length === 0 ? (
        <PolarisCard>
          <Box padding="600">
            <BlockStack gap="300" inlineAlign="center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mb-4 sm:mb-6 rounded-2xl bg-muted flex items-center justify-center">
              <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
            </div>
            <Text as="h2" variant="headingSm" alignment="center">{t('empty.title')}</Text>
            <Text as="p" variant="bodyMd" tone="subdued" alignment="center">{t('empty.description')}</Text>
            <PolarisButton url={`/${locale}/dashboard/integrations`} variant="primary">{t('empty.button')}</PolarisButton>
            </BlockStack>
          </Box>
        </PolarisCard>
      ) : (
        <PolarisCard>
          <div className="divide-y divide-border">
            {filteredConversations.map((conversation, idx) => (
              <Link
                key={conversation.id}
                href={`/dashboard/conversations/${conversation.id}`}
                className="block p-4 sm:p-5 hover:bg-muted/50 active:bg-muted transition-colors min-h-[88px] sm:min-h-0"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                        <h3 className="text-sm sm:text-base font-semibold text-foreground truncate max-w-[140px] sm:max-w-none">
                          {conversation.userName || conversation.user?.name || t('list.guest')}
                        </h3>
                        <PolarisBadge tone={getSentimentBadgeTone(conversation.sentiment)}>
                          {`${getSentimentIcon(conversation.sentiment)} ${conversation.sentiment}`}
                        </PolarisBadge>
                        {conversation.conversationStatus === 'human' && (
                          <PolarisBadge tone="critical">{t('statusBadge.human')}</PolarisBadge>
                        )}
                        {conversation.conversationStatus === 'resolved' && (
                          <PolarisBadge tone="success">{t('statusBadge.resolved')}</PolarisBadge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-0.5">
                        {conversation.phone || conversation.user?.phone}
                      </p>
                      {conversation.order && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                          <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{t('list.order')}: #{conversation.order.external_order_id}</span>
                          <PolarisBadge tone={conversation.order.status === 'delivered' ? 'success' : 'enabled'}>{conversation.order.status}</PolarisBadge>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 sm:gap-1 border-t sm:border-0 pt-3 sm:pt-0 border-border/50 sm:ml-0">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{formatDateTime(conversation.last_message_at)}</span>
                    </p>
                    <PolarisBadge>{`${conversation.message_count} ${t('list.messages')}`}</PolarisBadge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </PolarisCard>
      )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
