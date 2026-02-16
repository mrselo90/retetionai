'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';

interface ConversationMessage {
  role: 'user' | 'assistant' | 'merchant';
  content: string;
  timestamp: string;
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
}

export default function ConversationDetailPage() {
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
      toast.error('Hata', 'Konuşma yüklenirken bir hata oluştu');
      router.push('/dashboard/conversations');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('tr-TR', {
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
      toast.success('Gönderildi', 'Mesajınız WhatsApp ile gönderildi');
    } catch (err) {
      console.error('Failed to send reply:', err);
      toast.error('Hata', 'Mesaj gönderilemedi');
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
      const labels = { ai: 'AI modu', human: 'İnsan modu', resolved: 'Çözüldü' };
      toast.success('Durum güncellendi', labels[newStatus]);
    } catch (err) {
      toast.error('Hata', 'Durum güncellenemedi');
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
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-zinc-600">Konuşma bulunamadı</p>
            <button
              onClick={() => router.push('/dashboard/conversations')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Konuşmalara Dön
            </button>
          </div>
        </div>
      
    );
  }

  return (
    
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <button
            onClick={() => router.push('/dashboard/conversations')}
            className="text-sm text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Konuşmalara Dön
          </button>

          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">{conversation.userName}</h1>
                <p className="text-zinc-600 mt-1">{conversation.phone}</p>
                {conversation.order && (
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <span className="text-zinc-900 font-medium">Sipariş: #{conversation.order.externalOrderId}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      conversation.order.status === 'delivered'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {conversation.order.status}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right space-y-3">
              <div className="flex items-center gap-2 justify-end">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  conversation.conversationStatus === 'human'
                    ? 'bg-orange-100 text-orange-800'
                    : conversation.conversationStatus === 'resolved'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {conversation.conversationStatus === 'human' ? 'İnsan Modu' :
                   conversation.conversationStatus === 'resolved' ? 'Çözüldü' : 'AI Modu'}
                </span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                {conversation.conversationStatus === 'ai' && (
                  <button
                    onClick={() => handleToggleStatus('human')}
                    disabled={togglingStatus}
                    className="px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
                  >
                    AI&apos;yi Durdur
                  </button>
                )}
                {conversation.conversationStatus === 'human' && (
                  <>
                    <button
                      onClick={() => handleToggleStatus('ai')}
                      disabled={togglingStatus}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      AI&apos;yi Başlat
                    </button>
                    <button
                      onClick={() => handleToggleStatus('resolved')}
                      disabled={togglingStatus}
                      className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      Çözüldü
                    </button>
                  </>
                )}
                {conversation.conversationStatus === 'resolved' && (
                  <button
                    onClick={() => handleToggleStatus('ai')}
                    disabled={togglingStatus}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Yeniden Aç
                  </button>
                )}
              </div>
              <div className="text-sm text-zinc-600">
                <p>Başlangıç: {formatDateTime(conversation.createdAt)}</p>
                <p className="mt-1">Son güncelleme: {formatDateTime(conversation.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-zinc-200">
            <h2 className="text-lg font-semibold text-zinc-900">Mesaj Geçmişi</h2>
            <p className="text-sm text-zinc-600 mt-1">
              {conversation.history.length} mesaj • Otomatik güncelleniyor
            </p>
          </div>

          <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
            {conversation.history.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <svg className="mx-auto h-12 w-12 text-zinc-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p>Henüz mesaj yok</p>
              </div>
            ) : (
              <>
                {conversation.history.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[70%] ${message.role === 'user' ? 'order-1' : 'order-2'}`}>
                      <div
                        className={`rounded-lg p-4 ${
                          message.role === 'user'
                            ? 'bg-zinc-100 text-zinc-900'
                            : message.role === 'merchant'
                            ? 'bg-teal-600 text-white'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      <div className={`flex items-center gap-2 mt-1 text-xs text-zinc-600 ${
                        message.role === 'user' ? 'justify-start' : 'justify-end'
                      }`}>
                        <span>{message.role === 'user' ? 'Müşteri' : message.role === 'merchant' ? 'Siz' : 'AI Bot'}</span>
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
                placeholder={conversation.conversationStatus === 'resolved' ? 'Konuşma çözüldü' : 'Müşteriye mesaj yaz...'}
                disabled={sending || conversation.conversationStatus === 'resolved'}
                className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-zinc-100 disabled:cursor-not-allowed text-sm"
              />
              <button
                onClick={handleSendReply}
                disabled={!replyText.trim() || sending || conversation.conversationStatus === 'resolved'}
                className="px-5 py-2.5 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {sending ? 'Gönderiliyor...' : 'Gönder'}
              </button>
            </div>
            {conversation.conversationStatus === 'ai' && (
              <p className="text-xs text-zinc-500 mt-2">
                AI modu aktif. Mesaj gönderdiğinizde otomatik olarak insan moduna geçer.
              </p>
            )}
          </div>
        </div>

        {/* Conversation Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
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

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-zinc-600">Müşteri Mesajı</p>
                <p className="text-2xl font-bold text-zinc-900">
                  {conversation.history.filter((m) => m.role === 'user').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-zinc-600">Bot Yanıtı</p>
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
