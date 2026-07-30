/**
 * Message thread — the middle pane of the design's inbox.
 *
 * Groups messages under day dividers, which the previous flat list did not do: a
 * thread spanning a week rendered as one undifferentiated column of bubbles with
 * only clock times, so "14:32" could have been today or last Tuesday.
 *
 * Customer messages sit left, the shop's side (AI and merchant) right, per the
 * design. The merchant's own replies get the solid brand bubble because that is
 * what a merchant scans a thread for — did a human already answer this.
 */

'use client';

import { Fragment, useEffect, useRef } from 'react';
import { EmptyState } from './index';

export type MessageRole = 'user' | 'assistant' | 'merchant';

export interface ThreadMessage {
  role: MessageRole;
  content: string;
  timestamp: string;
}

/** Local calendar day key — grouping on the ISO string would split a day at UTC midnight. */
function dayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'invalid';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function MessageThread({
  messages,
  roleLabel,
  formatTime,
  formatDayLabel,
  emptyTitle,
  notice,
}: {
  messages: ThreadMessage[];
  roleLabel: (role: MessageRole) => string;
  formatTime: (iso: string) => string;
  /** "Today" / "Yesterday" / a date, decided by the caller so it can be localised. */
  formatDayLabel: (iso: string) => string;
  emptyTitle: string;
  /** Inline notice pinned after the last message, e.g. "AI paused". */
  notice?: React.ReactNode;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(messages.length);

  // Only scroll when a message actually arrives. Scrolling on every render
  // fought the merchant whenever they scrolled up to read earlier messages
  // while the 5-second poll was running.
  useEffect(() => {
    if (messages.length !== lastCount.current) {
      lastCount.current = messages.length;
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="r-thread-scroll">
        <EmptyState title={emptyTitle} />
        {notice}
      </div>
    );
  }

  return (
    <div className="r-thread-scroll">
      {messages.map((message, index) => {
        // Compared against the previous message rather than carried in a mutable
        // accumulator: a variable reassigned inside a render callback is exactly
        // what the React compiler cannot reason about, and this reads plainer.
        const startsNewDay =
          index === 0 || dayKey(message.timestamp) !== dayKey(messages[index - 1].timestamp);
        const outbound = message.role !== 'user';

        return (
          // A Fragment rather than a wrapper div: the thread is a flex column, so
          // an extra element would need display:contents to stay out of the way.
          <Fragment key={`${message.timestamp}-${index}`}>
            {startsNewDay ? (
              <div className="r-day-divider">{formatDayLabel(message.timestamp)}</div>
            ) : null}

            <div className={`r-msg ${outbound ? 'r-msg-out' : 'r-msg-in'}`}>
              <div
                className={`r-bubble ${
                  message.role === 'user'
                    ? 'r-bubble-customer'
                    : message.role === 'merchant'
                      ? 'r-bubble-merchant'
                      : 'r-bubble-ai'
                }`}
              >
                {message.content}
              </div>
              <div className="r-msg-meta">
                {roleLabel(message.role)} · {formatTime(message.timestamp)}
              </div>
            </div>
          </Fragment>
        );
      })}

      {notice}
      <div ref={endRef} />
    </div>
  );
}
