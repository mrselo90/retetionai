/**
 * Inbox frame — owns the conversation list; the thread is `children`.
 *
 * A layout rather than a component the two pages each render, so the list keeps
 * its scroll position, filter and polled data when the merchant moves between
 * conversations. Next remounts pages on navigation but not layouts.
 *
 * This replaces a Polaris IndexTable of conversations plus a separate full-page
 * detail route. A table was the wrong shape for the job: triaging an inbox means
 * reading one thread while seeing what else is waiting, and the old flow made
 * every conversation a full page load away from the list.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { getErrorStatus } from '@/lib/errors';
import { useTranslations } from 'next-intl';
import { ConversationList } from '@/components/recete/ConversationList';
import type { ConversationListItem, ConversationStatus } from '@/components/recete/ConversationList';
import { FilterTabs } from '@/components/recete/FilterTabs';

interface ApiConversation {
  id: string;
  user: { id: string; name?: string; phone: string };
  messageCount?: number;
  lastMessageAt?: string;
  created_at: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  conversationStatus?: ConversationStatus;
  lastMessage?: { role: string; content: string; timestamp: string } | null;
  userName?: string;
  phone?: string;
}

type InboxFilter = 'all' | 'human' | 'ai';

/**
 * Sentiment is a different axis from who is handling the thread, and the old
 * Polaris list let merchants filter by it. The design's chips only cover
 * handling, so sentiment stays as a secondary dropdown rather than being dropped.
 */
type SentimentFilter = 'all' | 'positive' | 'neutral' | 'negative';

const POLL_MS = 10_000;

export default function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Conversations');
  const pathname = usePathname();
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [sentiment, setSentiment] = useState<SentimentFilter>('all');

  // The unresolved-human count from the previous poll, in a ref rather than
  // state: the toast below compares against it, and putting it in state made it
  // a dependency of the polling effect, which then tore down and recreated its
  // interval on every single refresh.
  const prevHumanCount = useRef<number | null>(null);

  const selectedId = useMemo(() => {
    const match = /\/dashboard\/conversations\/([^/]+)/.exec(pathname);
    return match?.[1];
  }, [pathname]);

  const loadConversations = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const response = await authenticatedRequest<{ conversations: ApiConversation[] }>(
        '/api/conversations',
        session.access_token,
      );
      setConversations(response.conversations);

      const humanCount = response.conversations.filter((c) => c.conversationStatus === 'human').length;
      document.title = humanCount > 0 ? `(${humanCount}) ${t('title')}` : t('title');

      // Only announce a genuinely new escalation, and never on the first load —
      // otherwise opening the inbox with three waiting threads fires a toast
      // telling you three arrived just now.
      if (prevHumanCount.current !== null && humanCount > prevHumanCount.current) {
        toast.error(
          t('needsAttentionToast.title'),
          t('needsAttentionToast.message', { count: humanCount - prevHumanCount.current }),
        );
      }
      prevHumanCount.current = humanCount;
    } catch (err) {
      if (getErrorStatus(err) === 401) {
        toast.error(t('toasts.sessionExpired.title'), t('toasts.sessionExpired.message'));
        window.location.href = '/login';
        return;
      }
      // A failed background refresh leaves the last good list on screen.
      if (prevHumanCount.current === null) {
        toast.error(t('toasts.loadError.title'), t('toasts.loadError.message'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadConversations();

    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!interval) interval = setInterval(() => void loadConversations(), POLL_MS);
    };
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stop();
      } else {
        void loadConversations();
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadConversations]);

  const relativeTime = (iso: string | null | undefined): string => {
    if (!iso) return '–';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '–';
    const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (minutes < 1) return t('list.time.now');
    if (minutes < 60) return t('list.time.minutesAgo', { m: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('list.time.hoursAgo', { h: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t('list.time.daysAgo', { d: days });
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const counts = {
    all: conversations.length,
    human: conversations.filter((c) => c.conversationStatus === 'human').length,
    ai: conversations.filter((c) => (c.conversationStatus ?? 'ai') === 'ai').length,
  };

  const items: ConversationListItem[] = conversations
    .filter((c) => {
      const matchesHandling =
        filter === 'all'
          ? true
          : filter === 'human'
            ? c.conversationStatus === 'human'
            : (c.conversationStatus ?? 'ai') === 'ai';
      const matchesSentiment = sentiment === 'all' || c.sentiment === sentiment;
      return matchesHandling && matchesSentiment;
    })
    .map((c) => ({
      id: c.id,
      name: c.user?.name || c.userName || c.user?.phone || c.phone || t('list.guest'),
      preview: c.lastMessage?.content?.trim() || t('list.noMessages'),
      time: relativeTime(c.lastMessageAt || c.created_at),
      status: c.conversationStatus ?? 'ai',
    }));

  const statusLabel = (status: ConversationStatus): string =>
    status === 'human' ? t('filters.needsYou') : status === 'resolved' ? t('filters.resolved') : t('filters.ai');

  return (
    <div className="r-inbox" data-thread-open={selectedId ? 'true' : 'false'}>
      <ConversationList
        conversations={items}
        selectedId={selectedId}
        statusLabel={statusLabel}
        emptyTitle={loading ? t('list.loading') : t('empty.title')}
        emptyBody={loading ? '' : t('empty.description')}
        header={
          <>
            <h1 style={{ fontSize: 'var(--r-text-xl)', fontWeight: 'var(--r-weight-bold)', letterSpacing: 'var(--r-tracking-tight)', margin: 0 }}>
              {t('title')}
            </h1>
            <div style={{ marginTop: 12 }}>
              <FilterTabs
                label={t('filters.groupLabel')}
                value={filter}
                onChange={setFilter}
                tabs={[
                  { value: 'all', label: t('filters.all'), count: counts.all },
                  { value: 'human', label: t('filters.needsYou'), count: counts.human, tone: 'warning' },
                  { value: 'ai', label: t('filters.ai'), count: counts.ai },
                ]}
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="sr-only" htmlFor="inbox-sentiment">{t('filters.sentimentLabel')}</label>
              <select
                id="inbox-sentiment"
                className="r-select"
                value={sentiment}
                onChange={(event) => setSentiment(event.target.value as SentimentFilter)}
              >
                <option value="all">{t('filters.sentimentAll')}</option>
                <option value="positive">{t('filters.positive')}</option>
                <option value="neutral">{t('filters.neutral')}</option>
                <option value="negative">{t('filters.negative')}</option>
              </select>
            </div>
          </>
        }
      />
      {children}
    </div>
  );
}
