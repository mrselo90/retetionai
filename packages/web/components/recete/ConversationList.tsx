/**
 * Inbox conversation list — the left pane of the design's three-pane inbox.
 *
 * Rows are <Link>s, not clickable divs, so each conversation has a real URL: the
 * browser back button works, a merchant can open two in tabs, and the selected
 * row is announced via aria-current rather than only implied by a background
 * colour.
 */

'use client';

import { Link } from '@/i18n/routing';
import type { ComponentProps } from 'react';
import { Avatar, Badge, EmptyState } from './index';
import type { BadgeTone } from './index';

export type ConversationStatus = 'ai' | 'human' | 'resolved';

export interface ConversationListItem {
  id: string;
  name: string;
  preview: string;
  time: string;
  status: ConversationStatus;
}

type Href = ComponentProps<typeof Link>['href'];

const STATUS_TONE: Record<ConversationStatus, BadgeTone> = {
  human: 'warning',
  ai: 'neutral',
  resolved: 'success',
};

export function ConversationList({
  conversations,
  selectedId,
  statusLabel,
  emptyTitle,
  emptyBody,
  header,
}: {
  conversations: ConversationListItem[];
  selectedId?: string;
  statusLabel: (status: ConversationStatus) => string;
  emptyTitle: string;
  emptyBody: string;
  /** Title and filter chips, rendered above the scrolling list. */
  header: React.ReactNode;
}) {
  return (
    <div className="r-inbox-list">
      <div className="r-inbox-list-head">{header}</div>

      <div className="r-inbox-list-scroll">
        {conversations.length === 0 ? (
          <EmptyState title={emptyTitle} body={emptyBody} />
        ) : (
          conversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/dashboard/conversations/${conversation.id}` as Href}
              className="r-inbox-item"
              aria-current={conversation.id === selectedId ? 'page' : undefined}
            >
              <Avatar name={conversation.name} />
              <span className="r-inbox-item-body">
                <span className="r-inbox-item-top">
                  <span className="r-inbox-item-name">{conversation.name}</span>
                  <span className="r-inbox-item-time">{conversation.time}</span>
                </span>
                <span className="r-inbox-item-preview">{conversation.preview}</span>
                <span style={{ display: 'block', marginTop: 5 }}>
                  <Badge tone={STATUS_TONE[conversation.status]}>
                    {statusLabel(conversation.status)}
                  </Badge>
                </span>
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
