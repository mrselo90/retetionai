/**
 * Customers table, design direction 1b.
 *
 * Follows the design's column structure — avatar + name, phone, segment, orders,
 * last order, churn risk — with two deliberate differences:
 *
 * The design's LTV column is dropped. There is no amount anywhere in this
 * product: `orders` has no total, price or currency column, so an LTV figure
 * could only be invented. A fabricated number in a retention tool is worse than
 * a missing one.
 *
 * A Conversations column is added. The design didn't draw it, but the list
 * endpoint already returns conversationCount and it is the one number that says
 * whether the AI has actually talked to this customer — which is what the whole
 * product is for.
 *
 * Rows link from the name via a real <Link>. The screen previously used
 * `<tr onClick>` with window.location: unreachable by keyboard, no middle-click,
 * no client-side navigation, and no indication to a screen reader that the row
 * goes anywhere.
 */

'use client';

import { Link } from '@/i18n/routing';
import type { ComponentProps } from 'react';
import { Avatar, Badge, ProgressBar, TableWrap } from './index';
import type { BadgeTone } from './index';

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  segment: string;
  churnProbability: number;
  orderCount: number;
  conversationCount: number;
  lastOrderDate?: string | null;
}

export interface CustomersTableColumnLabels {
  name: string;
  phone: string;
  segment: string;
  orders: string;
  conversations: string;
  lastOrder: string;
  churnRisk: string;
}

type Href = ComponentProps<typeof Link>['href'];

/**
 * Churn is a risk score, so the tones run the opposite way to the product
 * knowledge score: a full bar is bad news, not good.
 */
function churnTone(probability: number): { bar: 'brand' | 'caution' | 'warning'; text: string } {
  if (probability > 0.6) return { bar: 'warning', text: 'var(--r-danger)' };
  if (probability > 0.3) return { bar: 'caution', text: 'var(--r-caution)' };
  return { bar: 'brand', text: 'var(--r-text-muted)' };
}

export function CustomersTable({
  customers,
  columns,
  segmentTone,
  segmentLabel,
  churnLabel,
  formatDate,
  noOrdersLabel,
  unnamedLabel,
}: {
  customers: CustomerRow[];
  columns: CustomersTableColumnLabels;
  segmentTone: (segment: string) => BadgeTone;
  segmentLabel: (segment: string) => string;
  /** Accessible name for the churn bar, e.g. "Churn risk: 62%". */
  churnLabel: (percent: number) => string;
  formatDate: (iso: string) => string;
  noOrdersLabel: string;
  unnamedLabel: string;
}) {
  return (
    <TableWrap>
      <table className="r-table">
        <thead>
          <tr>
            <th>{columns.name}</th>
            <th>{columns.phone}</th>
            <th>{columns.segment}</th>
            <th>{columns.orders}</th>
            <th>{columns.conversations}</th>
            <th>{columns.lastOrder}</th>
            <th style={{ minWidth: 140 }}>{columns.churnRisk}</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => {
            const percent = Math.round(customer.churnProbability * 100);
            const tone = churnTone(customer.churnProbability);

            return (
              <tr key={customer.id}>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={customer.name || unnamedLabel} />
                    <Link
                      href={`/dashboard/customers/${customer.id}` as Href}
                      className="r-table-strong"
                      style={{ textDecoration: 'none' }}
                    >
                      {customer.name || unnamedLabel}
                    </Link>
                  </span>
                </td>

                {/* Tabular figures so digits line up down the column. */}
                <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {customer.phone}
                </td>

                <td>
                  <Badge tone={segmentTone(customer.segment)}>{segmentLabel(customer.segment)}</Badge>
                </td>

                <td>{customer.orderCount}</td>
                <td>{customer.conversationCount}</td>

                <td style={{ whiteSpace: 'nowrap' }}>
                  {customer.lastOrderDate ? (
                    formatDate(customer.lastOrderDate)
                  ) : (
                    <span style={{ color: 'var(--r-text-muted)' }}>{noOrdersLabel}</span>
                  )}
                </td>

                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 56 }}>
                      <ProgressBar value={percent} label={churnLabel(percent)} tone={tone.bar} />
                    </span>
                    <span
                      style={{
                        fontWeight: 'var(--r-weight-semibold)',
                        color: tone.text,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {percent}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableWrap>
  );
}
