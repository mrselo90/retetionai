/**
 * Customer context — the third pane of the design's inbox.
 *
 * Fetches on its own rather than being fed by the thread: it is supplementary, so
 * a failure here must leave the merchant reading and replying normally. It
 * renders nothing at all if the lookup fails.
 *
 * Two things the design draws are absent, both because the data does not exist:
 *
 * - LTV. There is no amount column anywhere in the schema (`orders` has no total,
 *   price or currency), so a figure here could only be invented. Conversations
 *   takes its place, which for this product is the more telling number anyway —
 *   it says whether the AI has actually been talking to this person.
 * - "Suggested by Recete" with a resolve rate. That would need
 *   return_prevention_attempts to be populated, and nothing writes to it.
 *
 * The phone is masked, following the design. This pane sits open on screen for as
 * long as the merchant is in the inbox, and the full number is one click away on
 * the profile.
 */

'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { Avatar, Badge } from './index';
import type { BadgeTone } from './index';

interface CustomerContextData {
  id: string;
  name: string;
  phone: string;
  consent: string;
  segment: string;
  churnProbability: number;
  metrics: { orderCount: number; totalConversations: number; lastOrderDate: string | null };
  orders: Array<{ id: string; externalOrderId: string; status: string; createdAt: string }>;
}

/** Delivered is the good outcome; cancelled and returned are not. */
function orderStatusColour(status: string): string {
  if (status === 'delivered') return 'var(--r-success)';
  if (status === 'cancelled' || status === 'returned') return 'var(--r-danger)';
  return 'var(--r-text-secondary)';
}

/**
 * Masks the middle of a number, matching the design's "+90 5•• ••• ••34":
 * enough kept at the front to recognise the country and network, and the last two
 * digits so the merchant can tell two customers apart while reading.
 *
 * Anything too short to mask meaningfully is left alone rather than turned into a
 * row of dots that says nothing.
 *
 * The split assumes a two-digit country code, which covers +90 and +44 — this
 * product's merchants. A +1 number renders as "+14 1•• …", which is cosmetically
 * off but still masked; getting it exactly right needs a phone-parsing library,
 * and the grouping carries no meaning in a masked number.
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return phone;
  const head = digits.slice(0, 3);
  const tail = digits.slice(-2);
  const lead = phone.trim().startsWith('+') ? '+' : '';
  return `${lead}${head.slice(0, 2)} ${head.slice(2)}•• ••• ••${tail}`;
}

export function CustomerContext({
  userId,
  labels,
  segmentTone,
  segmentLabel,
  consentLabel,
  formatDate,
}: {
  userId: string;
  labels: {
    orders: string;
    conversations: string;
    currentOrder: string;
    noOrders: string;
    fullProfile: string;
    churn: string;
  };
  segmentTone: (segment: string) => BadgeTone;
  segmentLabel: (segment: string) => string;
  /** Rendered next to the masked number when the customer has opted in. */
  consentLabel: (consent: string) => string | null;
  formatDate: (iso: string) => string;
}) {
  const [customer, setCustomer] = useState<CustomerContextData | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const response = await authenticatedRequest<{ customer: CustomerContextData }>(
          `/api/customers/${userId}`,
          session.access_token,
        );
        // The merchant may have moved to another thread while this was in flight.
        if (!cancelled) setCustomer(response.customer);
      } catch {
        // Supplementary pane: staying blank beats an error the merchant cannot act on.
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [userId]);

  if (!customer) return null;

  const churnPercent = Math.round(customer.churnProbability * 100);
  const consent = consentLabel(customer.consent);
  const latestOrder = customer.orders?.[0];

  return (
    <aside className="r-context" aria-label={labels.fullProfile}>
      <div className="r-context-head">
        <Avatar name={customer.name} solid size="xl" />
        <div style={{ fontSize: 'var(--r-text-md-plus)', fontWeight: 'var(--r-weight-semibold)', marginTop: 10 }}>
          {customer.name}
        </div>
        <div style={{ fontSize: 'var(--r-text-sm)', color: 'var(--r-text-muted)', marginTop: 2 }}>
          {maskPhone(customer.phone)}
          {consent ? ` · ${consent}` : ''}
        </div>
        <div style={{ marginTop: 8 }}>
          <Badge tone={segmentTone(customer.segment)}>
            {`${segmentLabel(customer.segment)} · ${labels.churn} ${churnPercent}%`}
          </Badge>
        </div>
      </div>

      <div className="r-context-stats">
        <div className="r-context-stat">
          <div className="r-context-stat-label">{labels.orders}</div>
          <div className="r-context-stat-value">{customer.metrics.orderCount}</div>
        </div>
        <div className="r-context-stat">
          <div className="r-context-stat-label">{labels.conversations}</div>
          <div className="r-context-stat-value">{customer.metrics.totalConversations}</div>
        </div>
      </div>

      <div className="r-eyebrow" style={{ display: 'block', marginTop: 18 }}>
        {labels.currentOrder}
      </div>
      {latestOrder ? (
        <div className="r-context-card">
          <div style={{ fontSize: 'var(--r-text-base)', fontWeight: 'var(--r-weight-semibold)' }}>
            #{latestOrder.externalOrderId}
          </div>
          <div style={{ fontSize: 'var(--r-text-sm)', color: 'var(--r-text-muted)', marginTop: 2 }}>
            {formatDate(latestOrder.createdAt)} ·{' '}
            {/* The design shows this green, but it was showing "delivered". A
                cancelled or returned order must not read as good news. */}
            <span style={{ color: orderStatusColour(latestOrder.status), fontWeight: 'var(--r-weight-semibold)' }}>
              {latestOrder.status}
            </span>
          </div>
        </div>
      ) : (
        <div className="r-context-card">
          <div style={{ fontSize: 'var(--r-text-sm)', color: 'var(--r-text-muted)' }}>{labels.noOrders}</div>
        </div>
      )}

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Link
          href={`/dashboard/customers/${customer.id}`}
          style={{
            fontSize: 'var(--r-text-sm-plus)',
            fontWeight: 'var(--r-weight-semibold)',
            color: 'var(--r-brand)',
            textDecoration: 'none',
          }}
        >
          {labels.fullProfile} →
        </Link>
      </div>
    </aside>
  );
}
