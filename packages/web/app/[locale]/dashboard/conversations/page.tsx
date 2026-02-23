'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Link } from '@/i18n/routing';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, User, ShoppingBag, Clock, AlertTriangle } from 'lucide-react';
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

  useEffect(() => {
    loadConversations();

    // Real-time updates: Poll every 10 seconds
    const interval = setInterval(() => {
      loadConversations();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const loadConversations = async () => {
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

    } catch (err: any) {
      console.error('Failed to load conversations:', err);
      if (err.status === 401) {
        toast.error(t('toasts.sessionExpired.title'), t('toasts.sessionExpired.message'));
        window.location.href = '/login';
      } else {
        toast.error(t('toasts.loadError.title'), t('toasts.loadError.message'));
      }
    } finally {
      setLoading(false);
    }
  };

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

  const getSentimentBadgeVariant = (sentiment: string): 'default' | 'secondary' | 'destructive' => {
    switch (sentiment) {
      case 'positive':
        return 'default';
      case 'negative':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    if (filter !== 'all' && conv.sentiment !== filter) return false;
    if (statusFilter !== 'all' && conv.conversationStatus !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-6 animate-fade-in pb-8">
        <div className="space-y-2">
          <div className="h-7 sm:h-8 w-40 sm:w-56 bg-zinc-200 rounded-lg animate-pulse" />
          <div className="h-4 w-full max-w-md bg-zinc-100 rounded animate-pulse" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          <div className="h-9 w-20 rounded-lg bg-zinc-100 animate-pulse shrink-0" />
          <div className="h-9 w-24 rounded-lg bg-zinc-100 animate-pulse shrink-0" />
          <div className="h-9 w-20 rounded-lg bg-zinc-100 animate-pulse shrink-0" />
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4 p-4 sm:p-5" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-zinc-100 animate-pulse shrink-0" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-32 sm:w-40 bg-zinc-200 rounded animate-pulse" />
                <div className="h-3 w-24 sm:w-28 bg-zinc-100 rounded animate-pulse" />
                <div className="h-3 w-full max-w-[200px] bg-zinc-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-5 sm:space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
          {t('description')}
        </p>
      </div>

      {/* Needs Attention Alert */}
      {(() => {
        const humanConvs = conversations.filter(c => c.conversationStatus === 'human');
        if (humanConvs.length === 0) return null;
        return (
          <div className="rounded-xl sm:rounded-2xl border border-red-200 sm:border-2 sm:border-red-300 bg-red-50 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-3 bg-red-100/80 border-b border-red-200">
              <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-red-500" />
              </span>
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 shrink-0" />
              <span className="font-semibold sm:font-bold text-red-800 text-xs sm:text-sm truncate">
                {t('needsAttention.title', { count: humanConvs.length })}
              </span>
            </div>
            <div className="divide-y divide-red-200">
              {humanConvs.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/dashboard/conversations/${conv.id}`}
                  className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 hover:bg-red-100/50 active:bg-red-100 transition-colors group min-h-[72px] sm:min-h-0"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-red-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-red-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold sm:font-bold text-red-900 text-sm truncate">
                      {conv.userName || conv.user?.name || t('list.guest')}
                    </p>
                    <p className="text-xs text-red-700 mt-0.5 truncate">
                      {conv.phone || conv.user?.phone}
                    </p>
                    {conv.lastMessage && (
                      <p className="text-xs text-red-600 mt-1 truncate max-w-full">
                        &ldquo;{conv.lastMessage.content?.slice(0, 60)}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className="text-[10px] sm:text-xs text-red-600 whitespace-nowrap">{formatDateTime(conv.last_message_at)}</span>
                    <svg className="w-4 h-4 text-red-400 group-hover:text-red-600 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
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
            <Button
              key={f.key}
              variant={filter === f.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.key)}
              className="shrink-0 h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm font-semibold shadow-sm"
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { key: 'all' as const, label: t('filters.all') },
            { key: 'human' as const, label: t('filters.humanCount', { count: conversations.filter((c) => c.conversationStatus === 'human').length }) },
            { key: 'ai' as const, label: 'AI' },
            { key: 'resolved' as const, label: t('filters.resolved') },
          ].map((f) => (
            <Button
              key={`status-${f.key}`}
              variant={statusFilter === f.key ? 'info' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(f.key)}
              className="shrink-0 h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm font-semibold shadow-sm"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      {filteredConversations.length === 0 ? (
        <Card className="border-2 border-dashed border-border bg-card rounded-xl overflow-hidden">
          <CardContent className="p-6 sm:p-8 sm:py-12 flex flex-col items-center justify-center text-center min-h-[320px] sm:min-h-[400px]">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mb-4 sm:mb-6 rounded-2xl bg-muted flex items-center justify-center">
              <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 px-2">{t('empty.title')}</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 max-w-sm px-2">
              {t('empty.description')}
            </p>
            <Button size="lg" asChild className="min-h-11 px-6 font-semibold">
              <Link href="/dashboard/integrations">
                <MessageSquare className="w-5 h-5 mr-2 shrink-0" />
                {t('empty.button')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
                        <Badge variant={getSentimentBadgeVariant(conversation.sentiment) === 'default' ? 'success' : getSentimentBadgeVariant(conversation.sentiment)} size="sm" className="shrink-0 text-[10px] sm:text-xs">
                          {getSentimentIcon(conversation.sentiment)} {conversation.sentiment}
                        </Badge>
                        {conversation.conversationStatus === 'human' && (
                          <Badge variant="destructive" size="sm" className="shrink-0 font-semibold text-[10px] sm:text-xs">{t('statusBadge.human')}</Badge>
                        )}
                        {conversation.conversationStatus === 'resolved' && (
                          <Badge variant="success" size="sm" className="shrink-0 font-semibold text-[10px] sm:text-xs">{t('statusBadge.resolved')}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mb-0.5">
                        {conversation.phone || conversation.user?.phone}
                      </p>
                      {conversation.order && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                          <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{t('list.order')}: #{conversation.order.external_order_id}</span>
                          <Badge variant={conversation.order.status === 'delivered' ? 'success' : 'secondary'} size="sm" className="text-[10px]">
                            {conversation.order.status}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 sm:gap-1 border-t sm:border-0 pt-3 sm:pt-0 border-border/50 sm:ml-0">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{formatDateTime(conversation.last_message_at)}</span>
                    </p>
                    <Badge variant="outline" size="sm" className="font-medium text-[10px] sm:text-xs shrink-0">
                      {conversation.message_count} {t('list.messages')}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
