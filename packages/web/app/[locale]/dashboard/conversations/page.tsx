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
      <div className="space-y-8 animate-fade-in">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-zinc-200 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-zinc-100 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white border border-zinc-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap overflow-x-auto pb-2">
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
          >
            {f.label}
          </Button>
        ))}

        <span className="text-muted-foreground">|</span>
        {[
          { key: 'all' as const, label: 'Tümü' },
          { key: 'human' as const, label: `İnsan (${conversations.filter((c) => c.conversationStatus === 'human').length})` },
          { key: 'ai' as const, label: 'AI' },
          { key: 'resolved' as const, label: 'Çözüldü' },
        ].map((f) => (
          <Button
            key={`status-${f.key}`}
            variant={statusFilter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Conversations List */}
      {filteredConversations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('list.empty.title')}</h3>
            <p className="text-muted-foreground">
              {t('list.empty.description')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {filteredConversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/dashboard/conversations/${conversation.id}`}
                className="block p-5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Avatar */}
                    <div className="w-11 h-11 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold">
                          {conversation.user?.name || t('list.guest')}
                        </h3>
                        <Badge variant={getSentimentBadgeVariant(conversation.sentiment)}>
                          {getSentimentIcon(conversation.sentiment)} {conversation.sentiment}
                        </Badge>
                        {conversation.conversationStatus === 'human' && (
                          <Badge variant="destructive" className="text-xs">İnsan Modu</Badge>
                        )}
                        {conversation.conversationStatus === 'resolved' && (
                          <Badge className="text-xs bg-emerald-100 text-emerald-800">Çözüldü</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1.5">
                        {conversation.user?.phone}
                      </p>
                      {conversation.order && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>{t('list.order')}: #{conversation.order.external_order_id}</span>
                          <Badge variant={conversation.order.status === 'delivered' ? 'default' : 'secondary'} className="text-xs">
                            {conversation.order.status}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="text-right flex-shrink-0 ml-4 space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-end">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDateTime(conversation.last_message_at)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {conversation.message_count} {t('list.messages')}
                    </p>
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
