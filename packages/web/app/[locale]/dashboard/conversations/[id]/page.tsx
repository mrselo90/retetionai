'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useTranslations, useLocale } from 'next-intl';

interface ConversationMessage {
  role: 'user' | 'assistant' | 'merchant';
  content: string;
  timestamp: string;
}

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
  history: ConversationMessage[];
  status: string;
  conversationStatus: 'ai' | 'human' | 'resolved';
  assignedTo?: string;
  escalatedAt?: string;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    externalOrderId: string;
    status: string;
    deliveryDate?: string;
  };
  returnPreventionAttempt?: ReturnPreventionAttempt;
}

export default function ConversationDetailPage() {
  const t = useTranslations('ConversationDetail');
  const rp = useTranslations('ReturnPrevention');
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    if (conversationId) {
      loadConversation();

      // Real-time updates: Poll every 5 seconds for conversation detail
      const interval = setInterval(() => {
        loadConversation();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [conversationId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.history]);

  const loadConversation = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await authenticatedRequest<{ conversation: ConversationDetail }>(
        `/api/conversations/${conversationId}`,
        session.access_token
      );

      setConversation(response.conversation);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      toast.error(t('toasts.loadError.title'), t('toasts.loadError.message'));
      router.push('/dashboard/conversations');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString(locale === 'tr' ? 'tr-TR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await authenticatedRequest(
        `/api/conversations/${conversationId}/reply`,
        session.access_token,
        { method: 'POST', body: JSON.stringify({ text: replyText.trim() }) }
      );
      setReplyText('');
      await loadConversation();
      toast.success(t('toasts.sent.title'), t('toasts.sent.message'));
    } catch (err) {
      console.error('Failed to send reply:', err);
      toast.error(t('toasts.sendError.title'), t('toasts.sendError.message'));
    } finally {
      setSending(false);
    }
  };

  const handleToggleStatus = async (newStatus: 'ai' | 'human' | 'resolved') => {
    setTogglingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await authenticatedRequest(
        `/api/conversations/${conversationId}/status`,
        session.access_token,
        { method: 'PUT', body: JSON.stringify({ status: newStatus }) }
      );
      await loadConversation();
      const statusLabels: Record<string, string> = { ai: t('statusAiLabel'), human: t('statusHumanLabel'), resolved: t('statusResolvedLabel') };
      toast.success(t('toasts.statusUpdated'), statusLabels[newStatus]);
    } catch (err) {
      toast.error(t('toasts.statusError.title'), t('toasts.statusError.message'));
    } finally {
      setTogglingStatus(false);
    }
  };

  if (loading) {
    return (

      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-200 rounded w-1/4"></div>
          <div className="h-96 bg-zinc-200 rounded"></div>
        </div>
      </div>

    );
  }

  if (!conversation) {
    return (

      <div className="space-y-6">
        <div className="bg-card rounded-lg border border-border shadow-sm p-12 text-center">
          <p className="text-zinc-600">{t('notFound')}</p>
          <button
            onClick={() => router.push('/dashboard/conversations')}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            {t('backToConversations')}
          </button>
        </div>
      </div>

    );
  }

  return (

    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <button
          onClick={() => router.push('/dashboard/conversations')}
          className="text-sm text-primary hover:underline mb-4 flex items-center gap-1 font-medium"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('backToConversations')}
        </button>

        <div className="flex flex-col md:flex-row items-start md:items-start justify-between gap-6">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 md:w-8 md:h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-zinc-900 truncate max-w-[200px] sm:max-w-xs">{conversation.userName}</h1>
              <p className="text-sm md:text-base text-zinc-600 mt-0.5 sm:mt-1 truncate max-w-[200px] sm:max-w-xs">{conversation.phone}</p>
              {conversation.order && (
                <div className="flex items-center gap-1.5 sm:gap-2 mt-2 text-xs sm:text-sm flex-wrap">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <span className="text-zinc-900 font-medium truncate max-w-[150px] sm:max-w-xs">{t('order')}: #{conversation.order.externalOrderId}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium shrink-0 ${conversation.order.status === 'delivered'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-info/20 text-info'
                    }`}>
                    {conversation.order.status}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="w-full md:w-auto text-left md:text-right space-y-3 pt-4 border-t border-zinc-100 md:border-0 md:pt-0">
            <div className="flex flex-col sm:flex-row items-center gap-2 justify-start md:justify-end flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${conversation.conversationStatus === 'human'
                ? 'bg-orange-100 text-orange-800'
                : conversation.conversationStatus === 'resolved'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-info/20 text-info'
                }`}>
                {conversation.conversationStatus === 'human' ? t('statusHuman') :
                  conversation.conversationStatus === 'resolved' ? t('statusResolved') : t('statusAi')}
              </span>
              {conversation.returnPreventionAttempt && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${conversation.returnPreventionAttempt.outcome === 'prevented'
                  ? 'bg-emerald-100 text-emerald-800'
                  : conversation.returnPreventionAttempt.outcome === 'returned'
                    ? 'bg-red-100 text-red-800'
                    : conversation.returnPreventionAttempt.outcome === 'escalated'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}>
                  🛡️ {rp('badgeLabel')} · {
                    conversation.returnPreventionAttempt.outcome === 'prevented' ? rp('outcomePrevented') :
                      conversation.returnPreventionAttempt.outcome === 'returned' ? rp('outcomeReturned') :
                        conversation.returnPreventionAttempt.outcome === 'escalated' ? rp('outcomeEscalated') :
                          rp('outcomePending')
                  }
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 justify-start md:justify-end flex-wrap mt-2">
              {conversation.conversationStatus === 'ai' && (
                <button
                  onClick={() => handleToggleStatus('human')}
                  disabled={togglingStatus}
                  className="px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  {t('stopAi')}
                </button>
              )}
              {conversation.conversationStatus === 'human' && (
                <>
                  <button
                    onClick={() => handleToggleStatus('ai')}
                    disabled={togglingStatus}
                    className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
                  >
                    {t('startAi')}
                  </button>
                  <button
                    onClick={() => handleToggleStatus('resolved')}
                    disabled={togglingStatus}
                    className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {t('resolved')}
                  </button>
                </>
              )}
              {conversation.conversationStatus === 'resolved' && (
                <button
                  onClick={() => handleToggleStatus('ai')}
                  disabled={togglingStatus}
                  className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
                >
                  {t('reopen')}
                </button>
              )}
            </div>
            <div className="text-sm text-zinc-600 mt-2">
              <p>{t('started')}: {formatDateTime(conversation.createdAt)}</p>
              <p className="mt-1">{t('lastUpdate')}: {formatDateTime(conversation.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="bg-card rounded-lg border border-border shadow-sm">
        <div className="p-6 border-b border-zinc-200">
          <h2 className="text-lg font-semibold text-zinc-900">{t('messageHistory')}</h2>
          <p className="text-sm text-zinc-600 mt-1">
            {t('messageCount', { count: conversation.history.length })}
          </p>
        </div>

        <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
          {conversation.history.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <svg className="mx-auto h-12 w-12 text-zinc-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p>{t('noMessages')}</p>
            </div>
          ) : (
            <>
              {conversation.history.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[85%] sm:max-w-[70%] ${message.role === 'user' ? 'order-1' : 'order-2'}`}>
                    <div
                      className={`rounded-lg p-4 ${message.role === 'user'
                        ? 'bg-zinc-100 text-zinc-900'
                        : message.role === 'merchant'
                          ? 'bg-teal-600 text-white'
                          : 'bg-primary text-primary-foreground'
                        }`}
                    >
                      <p className="text-sm whitespace-pre-wrap flex-wrap break-words">{message.content}</p>
                    </div>
                    <div className={`flex items-center gap-2 mt-1 text-xs text-zinc-600 ${message.role === 'user' ? 'justify-start' : 'justify-end'
                      }`}>
                      <span>{message.role === 'user' ? t('customer') : message.role === 'merchant' ? t('you') : t('aiBot')}</span>
                      <span>•</span>
                      <span>{formatTime(message.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Reply Input */}
        <div className="p-4 border-t border-zinc-200">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
              placeholder={conversation.conversationStatus === 'resolved' ? t('placeholderResolved') : t('placeholderReply')}
              disabled={sending || conversation.conversationStatus === 'resolved'}
              className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-zinc-100 disabled:cursor-not-allowed text-sm"
            />
            <button
              onClick={handleSendReply}
              disabled={!replyText.trim() || sending || conversation.conversationStatus === 'resolved'}
              className="px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {sending ? t('sending') : t('send')}
            </button>
          </div>
          {conversation.conversationStatus === 'ai' && (
            <p className="text-xs text-zinc-500 mt-2">
              {t('humanModeNote')}
            </p>
          )}
        </div>
      </div>

      {/* Conversation Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-zinc-600">Toplam Mesaj</p>
              <p className="text-2xl font-bold text-zinc-900">{conversation.history.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-zinc-600">{t('customerMessage')}</p>
              <p className="text-2xl font-bold text-zinc-900">
                {conversation.history.filter((m) => m.role === 'user').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-zinc-600">{t('botResponse')}</p>
              <p className="text-2xl font-bold text-zinc-900">
                {conversation.history.filter((m) => m.role === 'assistant').length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

  );
}
