/**
 * Conversation thread — the right pane of the inbox, rewritten off Polaris.
 *
 * Everything that worked before is kept: the 5-second poll that pauses when the
 * tab is hidden and never navigates away on failure, the status transitions, the
 * return-prevention badge, and the distinction between "could not load" and
 * "does not exist".
 *
 * What the design adds, and this now has: the AI-autopilot switch in the header
 * instead of a row of status buttons, day dividers in the thread, an inline
 * notice explaining why the AI is paused and who the merchant is replying as, and
 * a Suggest reply action.
 *
 * The design's "Attach shade guide" and "Offer exchange" chips are not here: they
 * are product-specific canned actions with nothing behind them, and a button that
 * does nothing is worse than an absent one.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { getErrorMessage, getErrorStatus } from '@/lib/errors';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { Avatar, Badge, Button, EmptyState } from '@/components/recete';
import type { BadgeTone } from '@/components/recete';
import { MessageThread } from '@/components/recete/MessageThread';
import type { MessageRole, ThreadMessage } from '@/components/recete/MessageThread';
import { Switch } from '@/components/recete/Switch';
import { CustomerContext } from '@/components/recete/CustomerContext';

interface ReturnPreventionAttempt {
  id: string;
  outcome: 'pending' | 'prevented' | 'returned' | 'escalated';
  triggerMessage: string;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  userId: string;
  orderId?: string;
  userName: string;
  phone: string;
  history: ThreadMessage[];
  status: string;
  conversationStatus: 'ai' | 'human' | 'resolved';
  escalatedAt?: string;
  createdAt: string;
  updatedAt: string;
  order?: { id: string; externalOrderId: string; status: string; deliveryDate?: string };
  returnPreventionAttempt?: ReturnPreventionAttempt;
}

const POLL_MS = 5_000;

/** Same segment palette the customers table uses, so one customer reads the same on both screens. */
const SEGMENT_TONE: Record<string, BadgeTone> = {
  champions: 'success',
  loyal: 'brand',
  promising: 'caution',
  at_risk: 'warning',
  lost: 'danger',
  new: 'neutral',
};

export default function ConversationThreadPage() {
  const t = useTranslations('ConversationDetail');
  const rp = useTranslations('ReturnPrevention');
  // Segment names live with the customers screen; the context pane reuses them
  // rather than translating the same six words twice.
  const tc = useTranslations('Customers');
  const locale = useLocale();
  const params = useParams();
  const conversationId = params.id as string;

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  /**
   * Also the poll body, so it must not navigate: it used to router.push back to
   * the list on any error, which meant one 502 ejected the merchant from the
   * conversation they were reading and threw away a half-typed reply.
   */
  const loadConversation = useCallback(async (options?: { isInitial?: boolean }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (options?.isInitial) window.location.href = '/login';
        return;
      }

      const response = await authenticatedRequest<{ conversation: ConversationDetail }>(
        `/api/conversations/${conversationId}`,
        session.access_token,
      );
      setConversation(response.conversation);
      setLoadError(null);
    } catch (err) {
      if (getErrorStatus(err) === 401) {
        window.location.href = '/login';
        return;
      }
      if (options?.isInitial) {
        const message = getErrorMessage(err, t('toasts.loadError.message'));
        setLoadError(message);
        toast.error(t('toasts.loadError.title'), message);
      }
      // Background poll failures stay silent — it retries in 5s.
    } finally {
      setLoading(false);
    }
  }, [conversationId, t]);

  /**
   * Switching conversations must not show the previous thread while the new one
   * loads. Next reuses this component across [id] changes rather than remounting
   * it, so the reset is done by adjusting state during render — React's
   * documented pattern for "props changed, derived state is stale".
   *
   * The tracker is state, not a ref: React discards and re-runs the render, and a
   * ref mutated during render would already be updated on the retry, so the
   * resets would be skipped.
   */
  const [renderedId, setRenderedId] = useState(conversationId);
  if (renderedId !== conversationId) {
    setRenderedId(conversationId);
    setConversation(null);
    setLoading(true);
    setLoadError(null);
    setReplyText('');
  }

  useEffect(() => {
    if (!conversationId) return;
    void loadConversation({ isInitial: true });

    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!interval) interval = setInterval(() => void loadConversation(), POLL_MS);
    };
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stop();
      } else {
        void loadConversation();
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [conversationId, loadConversation]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  /** Today and yesterday get words; anything older gets a date. */
  const formatDayLabel = (iso: string) => {
    const date = new Date(iso);
    const today = new Date();
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(date, today)) return t('today');
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (sameDay(date, yesterday)) return t('yesterday');
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const roleLabel = (role: MessageRole) =>
    role === 'user' ? t('customer') : role === 'merchant' ? t('you') : t('aiBot');

  const setStatus = async (next: 'ai' | 'human' | 'resolved') => {
    setTogglingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await authenticatedRequest(
        `/api/conversations/${conversationId}/status`,
        session.access_token,
        { method: 'PUT', body: JSON.stringify({ status: next }) },
      );
      await loadConversation();
      const labels: Record<string, string> = {
        ai: t('statusAiLabel'),
        human: t('statusHumanLabel'),
        resolved: t('statusResolvedLabel'),
      };
      toast.success(t('toasts.statusUpdated'), labels[next]);
    } catch {
      toast.error(t('toasts.statusError.title'), t('toasts.statusError.message'));
    } finally {
      setTogglingStatus(false);
    }
  };

  const sendReply = async () => {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await authenticatedRequest(
        `/api/conversations/${conversationId}/reply`,
        session.access_token,
        { method: 'POST', body: JSON.stringify({ text }) },
      );
      setReplyText('');
      await loadConversation();
      toast.success(t('toasts.sent.title'), t('toasts.sent.message'));
    } catch (err) {
      toast.error(t('toasts.sendError.title'), getErrorMessage(err, t('toasts.sendError.message')));
    } finally {
      setSending(false);
    }
  };

  /**
   * Draft a reply from the customer's last question using the same grounded
   * answer path the WhatsApp bot uses, so the suggestion is built from the
   * merchant's own product knowledge rather than invented.
   *
   * It fills the composer instead of sending: the merchant took the conversation
   * over precisely because they wanted to decide what goes out.
   */
  const suggestReply = async () => {
    const lastCustomerMessage = [...(conversation?.history ?? [])]
      .reverse()
      .find((message) => message.role === 'user');

    if (!lastCustomerMessage) {
      toast.warning(t('suggest.noQuestionTitle'), t('suggest.noQuestionMessage'));
      return;
    }

    setSuggesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await authenticatedRequest<{ answer?: string; text?: string }>(
        '/api/answer',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify({ question: lastCustomerMessage.content, user_lang: locale }),
        },
      );
      const suggestion = (response.answer || response.text || '').trim();
      if (!suggestion) {
        toast.warning(t('suggest.emptyTitle'), t('suggest.emptyMessage'));
        return;
      }
      setReplyText(suggestion);
      toast.success(t('suggest.readyTitle'), t('suggest.readyMessage'));
    } catch (err) {
      toast.error(t('suggest.errorTitle'), getErrorMessage(err, t('suggest.errorMessage')));
    } finally {
      setSuggesting(false);
    }
  };

  if (loading && !conversation) {
    return (
      <div className="r-thread">
        <div className="r-thread-head">
          <div className="r-skeleton" style={{ height: 38, width: 220 }} role="status" aria-label={t('loading')} />
        </div>
        <div className="r-thread-scroll">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className={`r-msg ${row % 2 ? 'r-msg-out' : 'r-msg-in'}`}
              aria-hidden="true"
            >
              <div className="r-skeleton" style={{ height: 44, width: row % 2 ? 240 : 300 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="r-thread" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState
          title={loadError ? t('toasts.loadError.title') : t('notFound')}
          body={loadError ?? undefined}
          action={
            loadError ? (
              <Button
                variant="primary"
                onClick={() => { setLoading(true); void loadConversation({ isInitial: true }); }}
              >
                {t('retry')}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const isResolved = conversation.conversationStatus === 'resolved';
  const isHuman = conversation.conversationStatus === 'human';
  const autopilotOn = conversation.conversationStatus === 'ai';

  const preventionTone: Record<ReturnPreventionAttempt['outcome'], BadgeTone> = {
    prevented: 'success',
    returned: 'danger',
    escalated: 'warning',
    pending: 'neutral',
  };
  const preventionLabel: Record<ReturnPreventionAttempt['outcome'], string> = {
    prevented: rp('outcomePrevented'),
    returned: rp('outcomeReturned'),
    escalated: rp('outcomeEscalated'),
    pending: rp('outcomePending'),
  };

  return (
    <>
      <div className="r-thread">
      <div className="r-thread-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {/* Only shown on narrow screens, where the list is hidden behind the thread. */}
          <Link href="/dashboard/conversations" className="r-btn r-btn-secondary r-btn-sm r-thread-back">
            ← {t('backToConversations')}
          </Link>
          <Avatar name={conversation.userName || conversation.phone} solid size="lg" />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Link
                href={`/dashboard/customers/${conversation.userId}`}
                className="r-table-strong"
                style={{ fontSize: 'var(--r-text-md-plus)', textDecoration: 'none' }}
              >
                {conversation.userName || conversation.phone}
              </Link>
              {isHuman ? <Badge tone="warning">{t('statusHuman')}</Badge> : null}
              {isResolved ? <Badge tone="success">{t('statusResolved')}</Badge> : null}
              {conversation.returnPreventionAttempt ? (
                <Badge tone={preventionTone[conversation.returnPreventionAttempt.outcome]}>
                  {`${rp('badgeLabel')} · ${preventionLabel[conversation.returnPreventionAttempt.outcome]}`}
                </Badge>
              ) : null}
            </div>
            <div style={{ fontSize: 'var(--r-text-sm)', color: 'var(--r-text-muted)', marginTop: 2 }}>
              {conversation.order
                ? `${t('order')} #${conversation.order.externalOrderId} · ${conversation.order.status}`
                : conversation.phone}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* One switch replaces the old start/stop AI button pair: the state and
              the control are the same thing, so they cannot disagree. Resolved
              threads are reopened rather than toggled. */}
          {isResolved ? (
            <Button variant="primary" size="sm" onClick={() => setStatus('ai')} disabled={togglingStatus}>
              {t('reopen')}
            </Button>
          ) : (
            <>
              <Switch
                label={t('autopilot')}
                checked={autopilotOn}
                disabled={togglingStatus}
                onChange={(next) => setStatus(next ? 'ai' : 'human')}
                stateLabel={autopilotOn ? t('autopilotOn') : t('autopilotPaused')}
                stateTone={autopilotOn ? 'default' : 'warning'}
              />
              {isHuman ? (
                <Button variant="secondary" size="sm" onClick={() => setStatus('resolved')} disabled={togglingStatus}>
                  {t('resolved')}
                </Button>
              ) : null}
            </>
          )}
          <Link href={`/dashboard/customers/${conversation.userId}`} className="r-btn r-btn-secondary r-btn-sm">
            {t('profile')}
          </Link>
        </div>
      </div>

      <MessageThread
        messages={conversation.history}
        roleLabel={roleLabel}
        formatTime={formatTime}
        formatDayLabel={formatDayLabel}
        emptyTitle={t('noMessages')}
        notice={
          isHuman ? (
            <p className="r-notice">
              {t('aiPausedNotice', { name: conversation.userName || conversation.phone })}
            </p>
          ) : null
        }
      />

      <div className="r-composer">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={suggestReply}
            disabled={suggesting || isResolved}
            loading={suggesting}
          >
            <Sparkles size={13} aria-hidden="true" />
            {suggesting ? t('suggest.busy') : t('suggest.button')}
          </Button>
        </div>

        <div className="r-composer-row">
          <label className="sr-only" htmlFor="conversation-reply">{t('send')}</label>
          <textarea
            id="conversation-reply"
            className="r-input r-composer-input"
            rows={1}
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter breaks the line — the same shortcut the
              // old single-line field had, now on a field that can hold a
              // paragraph without hiding the start of it.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendReply();
              }
            }}
            placeholder={isResolved ? t('placeholderResolved') : t('placeholderReply')}
            disabled={sending || isResolved}
          />
          <Button
            variant="primary"
            onClick={sendReply}
            disabled={!replyText.trim() || sending || isResolved}
            loading={sending}
          >
            {sending ? t('sending') : t('send')}
          </Button>
        </div>

        {autopilotOn ? (
          <p className="r-field-help" style={{ marginTop: 8 }}>{t('humanModeNote')}</p>
        ) : null}
      </div>
      </div>

      <CustomerContext
        userId={conversation.userId}
        labels={{
          orders: t('context.orders'),
          conversations: t('context.conversations'),
          currentOrder: t('context.currentOrder'),
          noOrders: t('context.noOrders'),
          fullProfile: t('context.fullProfile'),
          churn: t('context.churn'),
        }}
        segmentTone={(segment) => SEGMENT_TONE[segment] ?? 'neutral'}
        segmentLabel={(segment) => (SEGMENT_TONE[segment] ? tc(`segment.${segment}`) : segment)}
        consentLabel={(consent) => (consent === 'opted_in' ? t('context.optedIn') : null)}
        formatDate={(iso) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
      />
    </>
  );
}
