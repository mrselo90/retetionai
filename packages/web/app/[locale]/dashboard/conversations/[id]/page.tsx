'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { KeyboardEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  Badge as PolarisBadge,
  BlockStack,
  Box,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Text,
  TextField,
} from '@shopify/polaris';
import { MessageSquare, Clock, User, ShoppingBag, Bot } from 'lucide-react';
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

function DetailIconSurface({
  icon,
  background = 'bg-surface-secondary',
}: {
  icon: React.ReactNode;
  background?: React.ComponentProps<typeof Box>['background'];
}) {
  return (
    <Box background={background} borderRadius="200" padding="300" minWidth="44px" minHeight="44px">
      {icon}
    </Box>
  );
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
      <SkeletonPage title={t('backToConversations')}>
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <SkeletonDisplayText size="small" maxWidth="18ch" />
                  <SkeletonBodyText lines={3} />
                </BlockStack>
              </Card>
              <Card>
                <SkeletonBodyText lines={10} />
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  if (!conversation) {
    return (
      <Page title={t('backToConversations')}>
        <Layout>
          <Layout.Section>
            <Card>
              <Box padding="600">
                <BlockStack gap="300" inlineAlign="center">
                  <Text as="p" tone="subdued">{t('notFound')}</Text>
                  <Button onClick={() => router.push('/dashboard/conversations')}>{t('backToConversations')}</Button>
                </BlockStack>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title={conversation.userName} subtitle={conversation.phone} fullWidth>
      <Layout>
        <Layout.Section>
    <BlockStack gap="400">
      {/* Header */}
      <Card>
        <BlockStack gap="400">
          <Button onClick={() => router.push('/dashboard/conversations')} variant="plain">
            {t('backToConversations')}
          </Button>

        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <InlineStack gap="300" blockAlign="start">
            <DetailIconSurface
              background="bg-fill-info-secondary"
              icon={<User className="w-6 h-6 text-blue-700" />}
            />
            <BlockStack gap="100">
              <Text as="h1" variant="headingLg">{conversation.userName}</Text>
              <Text as="p" tone="subdued">{conversation.phone}</Text>
              {conversation.order && (
                <InlineStack gap="150" blockAlign="center" wrap>
                  <ShoppingBag className="w-4 h-4 text-zinc-600" />
                  <Text as="p" variant="bodySm">{t('order')}: #{conversation.order.externalOrderId}</Text>
                  <PolarisBadge tone={conversation.order.status === 'delivered' ? 'success' : 'info'}>
                    {conversation.order.status}
                  </PolarisBadge>
                </InlineStack>
              )}
            </BlockStack>
          </InlineStack>

          <BlockStack gap="300">
            <InlineStack gap="200" wrap>
              <PolarisBadge tone={
                conversation.conversationStatus === 'human'
                  ? 'critical'
                  : conversation.conversationStatus === 'resolved'
                    ? 'success'
                    : 'info'
              }>
                {conversation.conversationStatus === 'human' ? t('statusHuman') :
                  conversation.conversationStatus === 'resolved' ? t('statusResolved') : t('statusAi')}
              </PolarisBadge>
              {conversation.returnPreventionAttempt && (
                <PolarisBadge tone={
                  conversation.returnPreventionAttempt.outcome === 'prevented'
                    ? 'success'
                    : conversation.returnPreventionAttempt.outcome === 'returned'
                      ? 'critical'
                      : conversation.returnPreventionAttempt.outcome === 'escalated'
                        ? 'warning'
                        : 'enabled'
                }>
                  {`${rp('badgeLabel')} · ${
                    conversation.returnPreventionAttempt.outcome === 'prevented' ? rp('outcomePrevented') :
                      conversation.returnPreventionAttempt.outcome === 'returned' ? rp('outcomeReturned') :
                        conversation.returnPreventionAttempt.outcome === 'escalated' ? rp('outcomeEscalated') :
                          rp('outcomePending')
                  }`}
                </PolarisBadge>
              )}
            </InlineStack>
            <InlineStack gap="200" wrap>
              {conversation.conversationStatus === 'ai' && (
                <Button
                  onClick={() => handleToggleStatus('human')}
                  disabled={togglingStatus}
                  size="micro"
                  tone="critical"
                  variant="primary"
                >
                  {t('stopAi')}
                </Button>
              )}
              {conversation.conversationStatus === 'human' && (
                <>
                  <Button
                    onClick={() => handleToggleStatus('ai')}
                    disabled={togglingStatus}
                    size="micro"
                    variant="primary"
                  >
                    {t('startAi')}
                  </Button>
                  <Button
                    onClick={() => handleToggleStatus('resolved')}
                    disabled={togglingStatus}
                    size="micro"
                    tone="success"
                    variant="primary"
                  >
                    {t('resolved')}
                  </Button>
                </>
              )}
              {conversation.conversationStatus === 'resolved' && (
                <Button
                  onClick={() => handleToggleStatus('ai')}
                  disabled={togglingStatus}
                  size="micro"
                  variant="primary"
                >
                  {t('reopen')}
                </Button>
              )}
            </InlineStack>
            <BlockStack gap="050">
              <Text as="p" variant="bodySm" tone="subdued">{t('started')}: {formatDateTime(conversation.createdAt)}</Text>
              <Text as="p" variant="bodySm" tone="subdued">{t('lastUpdate')}: {formatDateTime(conversation.updatedAt)}</Text>
            </BlockStack>
          </BlockStack>
        </InlineGrid>
        </BlockStack>
      </Card>

      {/* Chat Messages */}
      <Card>
        <Box padding="400" borderBlockEndWidth="025" borderColor="border">
          <Text as="h2" variant="headingSm">{t('messageHistory')}</Text>
          <Box paddingBlockStart="100">
            <Text as="p" variant="bodySm" tone="subdued">
            {t('messageCount', { count: conversation.history.length })}
            </Text>
          </Box>
        </Box>

        <Box padding="400">
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {conversation.history.length === 0 ? (
            <Box padding="600">
              <BlockStack gap="300" inlineAlign="center">
                <DetailIconSurface icon={<MessageSquare className="w-6 h-6 text-muted-foreground" />} />
                <Text as="p" tone="subdued">{t('noMessages')}</Text>
              </BlockStack>
            </Box>
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
        </Box>

        {/* Reply Input */}
        <Box padding="400" borderBlockStartWidth="025" borderColor="border">
          <InlineStack gap="300" blockAlign="center">
            <Box width="100%">
              <div
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
              >
                <TextField
                  label={t('send')}
                  labelHidden
                  autoComplete="off"
                  value={replyText}
                  onChange={(value) => setReplyText(value)}
                  placeholder={conversation.conversationStatus === 'resolved' ? t('placeholderResolved') : t('placeholderReply')}
                  disabled={sending || conversation.conversationStatus === 'resolved'}
                />
              </div>
            </Box>
            <Button
              onClick={handleSendReply}
              disabled={!replyText.trim() || sending || conversation.conversationStatus === 'resolved'}
              loading={sending}
              variant="primary"
            >
              {sending ? t('sending') : t('send')}
            </Button>
          </InlineStack>
          {conversation.conversationStatus === 'ai' && (
            <Box paddingBlockStart="200">
              <Text as="p" variant="bodyXs" tone="subdued">{t('humanModeNote')}</Text>
            </Box>
          )}
        </Box>
      </Card>

      {/* Conversation Stats */}
      <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
        <Card>
          <InlineStack gap="300" blockAlign="center">
            <DetailIconSurface background="bg-fill-info-secondary" icon={<MessageSquare className="w-5 h-5 text-blue-700" />} />
            <BlockStack gap="050">
              <Text as="p" variant="bodySm" tone="subdued">{t('totalMessages')}</Text>
              <Text as="p" variant="headingLg" fontWeight="semibold">{conversation.history.length}</Text>
            </BlockStack>
          </InlineStack>
        </Card>

        <Card>
          <InlineStack gap="300" blockAlign="center">
            <DetailIconSurface background="bg-fill-success-secondary" icon={<User className="w-5 h-5 text-green-700" />} />
            <BlockStack gap="050">
              <Text as="p" variant="bodySm" tone="subdued">{t('customerMessage')}</Text>
              <Text as="p" variant="headingLg" fontWeight="semibold">
                {conversation.history.filter((m) => m.role === 'user').length}
              </Text>
            </BlockStack>
          </InlineStack>
        </Card>

        <Card>
          <InlineStack gap="300" blockAlign="center">
            <DetailIconSurface background="bg-surface-secondary" icon={<Bot className="w-5 h-5 text-zinc-700" />} />
            <BlockStack gap="050">
              <Text as="p" variant="bodySm" tone="subdued">{t('botResponse')}</Text>
              <Text as="p" variant="headingLg" fontWeight="semibold">
                {conversation.history.filter((m) => m.role === 'assistant').length}
              </Text>
            </BlockStack>
          </InlineStack>
        </Card>
      </InlineGrid>
    </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
