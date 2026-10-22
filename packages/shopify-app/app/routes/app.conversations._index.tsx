import type { HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate } from 'react-router';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { useState } from 'react';
import { authenticateEmbeddedAdmin } from '../lib/embeddedAuth.server';
import { extractPlatformErrorMessage, fetchMerchantConversations } from '../platform.server';
import { AppPage, MetricCard, MetricGrid } from '../components/shell-ui';

/**
 * Conversations list on Shopify's Index table pattern. Filter tabs are
 * client-side: the loader already returns every thread with its status.
 */

type ConversationTab = 'all' | 'human' | 'ai' | 'resolved';

const CONVERSATION_TABS: ConversationTab[] = ['all', 'human', 'ai', 'resolved'];

const CONVERSATION_TAB_LABELS: Record<ConversationTab, string> = {
  all: 'All',
  human: 'Needs reply',
  ai: 'AI handling',
  resolved: 'Resolved',
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);

  try {
    return await fetchMerchantConversations(request);
  } catch (error) {
    return {
      conversations: [],
      unavailableReason: await extractPlatformErrorMessage(
        error,
        'Conversation data is unavailable.'
      ),
    };
  }
};

function formatRelativeTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function statusTone(status?: string | null): 'warning' | 'success' | 'info' {
  if (status === 'human') return 'warning';
  if (status === 'resolved') return 'success';
  return 'info';
}

function statusLabel(status?: string | null) {
  if (status === 'human') return 'Needs reply';
  if (status === 'resolved') return 'Resolved';
  return 'AI handling';
}

function initialsFor(name?: string | null) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return undefined;
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ConversationsPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ConversationTab>('all');
  const conversations = data.conversations || [];
  const unavailableReason = 'unavailableReason' in data ? data.unavailableReason : null;

  // Sort: human first, then by recency
  const sorted = [...conversations].sort((a, b) => {
    const weight = (s?: string | null) => (s === 'human' ? 0 : s === 'ai' ? 1 : 2);
    const wDiff = weight(a.conversationStatus) - weight(b.conversationStatus);
    if (wDiff !== 0) return wDiff;
    return new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();
  });

  const humanCount = conversations.filter((c) => c.conversationStatus === 'human').length;
  const aiCount = conversations.filter((c) => c.conversationStatus === 'ai').length;
  const resolvedCount = conversations.filter((c) => c.conversationStatus === 'resolved').length;
  const firstHuman = sorted.find((c) => c.conversationStatus === 'human');
  const tabCounts: Record<ConversationTab, number> = {
    all: conversations.length,
    human: humanCount,
    ai: aiCount,
    resolved: resolvedCount,
  };
  const visible = tab === 'all' ? sorted : sorted.filter((c) => c.conversationStatus === tab);

  return (
    <AppPage
      heading="Conversations"
      subtitle="Buyer threads and escalations."
      primaryAction={
        firstHuman
          ? { content: `Handle next (${humanCount})`, url: `/app/conversations/${firstHuman.id}` }
          : { content: 'View customers', url: '/app/customers' }
      }
    >
      {/* ── Escalation alert ────────────────────────────────────────── */}
      {humanCount > 0 && !unavailableReason ? (
        <s-banner
          heading={`${humanCount} thread${humanCount === 1 ? '' : 's'} need${humanCount === 1 ? 's' : ''} your reply`}
          tone="warning"
        >
          <s-paragraph>Escalated to human — buyer is waiting.</s-paragraph>
          {firstHuman ? (
            <s-button
              slot="secondary-actions"
              onClick={() => navigate(`/app/conversations/${firstHuman.id}`)}
            >
              Handle next
            </s-button>
          ) : null}
        </s-banner>
      ) : null}

      {unavailableReason ? (
        <s-banner heading="Conversations unavailable" tone="critical">
          <s-paragraph>{unavailableReason}</s-paragraph>
        </s-banner>
      ) : null}

      {/* ── Metrics ─────────────────────────────────────────────────── */}
      <MetricGrid>
        <MetricCard label="Total" value={conversations.length} hint="All tracked threads." />
        <MetricCard label="Needs reply" value={humanCount} hint="Threads in human queue." />
        <MetricCard label="AI handling" value={aiCount} hint="Conversations owned by bot." />
        <MetricCard label="Resolved" value={resolvedCount} hint="Closed threads." />
      </MetricGrid>

      {/* ── Conversation list ────────────────────────────────────────── */}
      <s-section padding="none" accessibilityLabel="Conversations">
        <s-box padding="base">
          <s-stack direction="inline" gap="small-200">
            {CONVERSATION_TABS.map((value) => (
              <s-button
                key={value}
                variant={tab === value ? 'secondary' : 'tertiary'}
                accessibilityLabel={`${CONVERSATION_TAB_LABELS[value]}: ${tabCounts[value]} conversations`}
                onClick={() => setTab(value)}
              >
                {`${CONVERSATION_TAB_LABELS[value]} (${tabCounts[value]})`}
              </s-button>
            ))}
          </s-stack>
        </s-box>

        {conversations.length === 0 ? (
          <s-grid gap="small-200" padding="large" justifyItems="center">
            <s-heading>No conversations yet</s-heading>
            <s-paragraph color="subdued">
              Threads appear here after orders flow through Recete and buyers start responding.
            </s-paragraph>
          </s-grid>
        ) : visible.length === 0 ? (
          <s-grid gap="small-200" padding="large" justifyItems="center">
            <s-heading>No conversations in this view</s-heading>
            <s-paragraph color="subdued">Try a different tab.</s-paragraph>
          </s-grid>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Buyer</s-table-header>
              <s-table-header listSlot="secondary">Status</s-table-header>
              <s-table-header listSlot="labeled">Last activity</s-table-header>
              <s-table-header listSlot="inline">Action</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {visible.map((conversation) => {
                const isHuman = conversation.conversationStatus === 'human';
                const relativeTime = formatRelativeTime(conversation.lastMessageAt);
                const detailUrl = `/app/conversations/${conversation.id}`;
                const name = conversation.userName || 'Unknown buyer';
                const meta = [conversation.phone, `${conversation.messageCount ?? 0} messages`]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <s-table-row key={conversation.id}>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small-300" alignItems="center">
                        <s-avatar
                          initials={initialsFor(conversation.userName)}
                          alt={conversation.userName || 'Unknown'}
                          size="small"
                        />
                        <s-stack gap="none">
                          <s-link
                            href={detailUrl}
                            accessibilityLabel={`View conversation with ${name}`}
                            onClick={(event) => {
                              event.preventDefault();
                              navigate(detailUrl);
                            }}
                          >
                            {name}
                          </s-link>
                          <s-text color="subdued">{meta}</s-text>
                        </s-stack>
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={statusTone(conversation.conversationStatus)}>
                        {statusLabel(conversation.conversationStatus)}
                      </s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-text color="subdued">{relativeTime || '—'}</s-text>
                    </s-table-cell>
                    <s-table-cell>
                      <s-button onClick={() => navigate(detailUrl)}>
                        {isHuman ? 'Reply' : 'Open'}
                      </s-button>
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </AppPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
