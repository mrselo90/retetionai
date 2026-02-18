'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Link } from '@/i18n/routing';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
}

export default function ConversationsPage() {
  const t = useTranslations('Conversations');
  const locale = useLocale();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ai' | 'human' | 'resolved'>('all');

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
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-3">
          <div className="h-10 w-48 bg-gradient-to-r from-zinc-200 to-zinc-100 rounded-xl animate-pulse" />
          <div className="h-5 w-96 bg-gradient-to-r from-zinc-100 to-zinc-50 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white border-2 border-zinc-100 rounded-xl animate-pulse shadow-sm" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="space-y-1.5">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground text-base font-medium">
          {t('description')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap overflow-x-auto pb-2">
        {[
          { key: 'all' as const, label: `${t('filters.all')} (${conversations.length})` },
          { key: 'positive' as const, label: `${t('filters.positive')} (${conversations.filter((c) => c.sentiment === 'positive').length})` },
          { key: 'neutral' as const, label: `${t('filters.neutral')} (${conversations.filter((c) => c.sentiment === 'neutral').length})` },
          { key: 'negative' as const, label: `${t('filters.negative')} (${conversations.filter((c) => c.sentiment === 'negative').length})` },
        ].map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="lg"
            onClick={() => setFilter(f.key)}
            className="shadow-sm font-bold"
          >
            {f.label}
          </Button>
        ))}

        <div className="w-px h-8 bg-border"></div>
        {[
          { key: 'all' as const, label: t('filters.all') },
          { key: 'human' as const, label: t('filters.humanCount', { count: conversations.filter((c) => c.conversationStatus === 'human').length }) },
          { key: 'ai' as const, label: 'AI' },
          { key: 'resolved' as const, label: t('filters.resolved') },
        ].map((f) => (
          <Button
            key={`status-${f.key}`}
            variant={statusFilter === f.key ? 'info' : 'outline'}
            size="lg"
            onClick={() => setStatusFilter(f.key)}
            className="shadow-sm font-bold"
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Conversations List */}
      {filteredConversations.length === 0 ? (
        <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors">
          <CardContent className="p-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-info/10 to-info/5 flex items-center justify-center shadow-inner">
              <MessageSquare className="w-10 h-10 text-info" />
            </div>
            <h3 className="text-2xl font-bold mb-3">{t('list.empty.title')}</h3>
            <p className="text-muted-foreground max-w-md mx-auto text-base">
              {t('list.empty.description')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden shadow-lg">
          <div className="divide-y divide-border">
            {filteredConversations.map((conversation, idx) => (
              <Link
                key={conversation.id}
                href={`/dashboard/conversations/${conversation.id}`}
                className="block p-6 hover:bg-gradient-to-r hover:from-muted/30 hover:to-transparent transition-all duration-200 group"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Avatar */}
                    <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-sm">
                      <User className="w-6 h-6 text-primary" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-lg font-bold">
                          {conversation.user?.name || t('list.guest')}
                        </h3>
                        <Badge variant={getSentimentBadgeVariant(conversation.sentiment) === 'default' ? 'success' : getSentimentBadgeVariant(conversation.sentiment)} size="sm" className="shadow-sm">
                          {getSentimentIcon(conversation.sentiment)} {conversation.sentiment}
                        </Badge>
                        {conversation.conversationStatus === 'human' && (
                          <Badge variant="destructive" size="sm" className="shadow-sm font-bold">{t('statusBadge.human')}</Badge>
                        )}
                        {conversation.conversationStatus === 'resolved' && (
                          <Badge variant="success" size="sm" className="shadow-sm font-bold">{t('statusBadge.resolved')}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 font-medium">
                        {conversation.user?.phone}
                      </p>
                      {conversation.order && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <ShoppingBag className="w-4 h-4" />
                          <span className="font-medium">{t('list.order')}: #{conversation.order.external_order_id}</span>
                          <Badge variant={conversation.order.status === 'delivered' ? 'success' : 'secondary'} size="sm">
                            {conversation.order.status}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="text-right flex-shrink-0 ml-4 space-y-2">
                    <p className="text-sm text-muted-foreground flex items-center gap-2 justify-end font-medium">
                      <Clock className="w-4 h-4" />
                      {formatDateTime(conversation.last_message_at)}
                    </p>
                    <Badge variant="outline" size="sm" className="font-bold">
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
