/**
 * Products table, design direction 1b.
 *
 * The design splits what the old table crammed into one "Status" column into
 * separate Knowledge score / Chunks / Last scraped columns, which reads far better
 * for scanning a catalog — so the design wins on structure here.
 *
 * The row checkbox is not in the design, but bulk rescrape/re-embed is a working
 * feature and dropping it would be feature loss rather than a design decision, so
 * it is kept and dressed in the new language.
 *
 * Rows link via a real <Link> on the product name. The customers table used
 * `<tr onClick>` with window.location, which is unreachable by keyboard and
 * discards the client router — that pattern is not repeated here.
 */

'use client';

import { Link } from '@/i18n/routing';
import type { ComponentProps } from 'react';
import { Badge, ProgressBar, TableWrap } from './index';
import type { BadgeTone } from './index';

export interface ProductRow {
  id: string;
  name: string;
  url: string;
  updated_at: string;
  raw_text?: string;
  chunkCount?: number;
  chunkCountUnavailable?: boolean;
  knowledgeHealth?: { score: number } | null;
}

export interface ProductsTableColumnLabels {
  product: string;
  score: string;
  status: string;
  chunks: string;
  lastScraped: string;
  actions: string;
}

export interface ProductsTableProps {
  products: ProductRow[];
  columns: ProductsTableColumnLabels;
  /** Selection is optional so the table can render without bulk actions. */
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  selectLabel?: (name: string) => string;
  /** Header for the selection column, announced instead of repeating "Product". */
  selectColumnLabel?: string;
  editLabel: string;
  unknownLabel: string;
  neverScrapedLabel: string;
  statusLabel: (row: ProductRow) => string;
  formatDate: (iso: string) => string;
}

type Href = ComponentProps<typeof Link>['href'];

/** Score thresholds mirror the prototype's Strong / At risk / failed treatment. */
function scoreTone(score: number | undefined): { badge: BadgeTone; bar: 'brand' | 'caution' | 'warning' } {
  if (score === undefined) return { badge: 'neutral', bar: 'caution' };
  if (score >= 80) return { badge: 'success', bar: 'brand' };
  if (score >= 50) return { badge: 'caution', bar: 'caution' };
  return { badge: 'danger', bar: 'warning' };
}

export function ProductsTable({
  products,
  columns,
  selectedIds,
  onToggleSelect,
  selectLabel,
  selectColumnLabel = 'Select',
  editLabel,
  unknownLabel,
  neverScrapedLabel,
  statusLabel,
  formatDate,
}: ProductsTableProps) {
  const selectable = Boolean(onToggleSelect && selectedIds);

  return (
    <TableWrap>
      <table className="r-table">
        <thead>
          <tr>
            {selectable ? (
              <th style={{ width: 36 }}>
                {/* Distinct from the Product header so screen readers do not hear it twice. */}
                <span className="sr-only">{selectColumnLabel}</span>
              </th>
            ) : null}
            <th>{columns.product}</th>
            <th style={{ minWidth: 150 }}>{columns.score}</th>
            <th>{columns.status}</th>
            <th>{columns.chunks}</th>
            <th>{columns.lastScraped}</th>
            <th style={{ textAlign: 'right' }}>{columns.actions}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const score = product.knowledgeHealth?.score;
            const tone = scoreTone(score);

            return (
              <tr key={product.id}>
                {selectable ? (
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds!.has(product.id)}
                      onChange={() => onToggleSelect!(product.id)}
                      aria-label={selectLabel ? selectLabel(product.name) : product.name}
                    />
                  </td>
                ) : null}

                <td>
                  <Link
                    href={`/dashboard/products/${product.id}` as Href}
                    className="r-table-strong"
                    style={{ textDecoration: 'none', wordBreak: 'break-word' }}
                  >
                    {product.name}
                  </Link>
                  <div
                    style={{
                      fontSize: 'var(--r-text-sm)',
                      color: 'var(--r-text-subtle)',
                      marginTop: 2,
                      maxWidth: 320,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={product.url}
                  >
                    {product.url}
                  </div>
                </td>

                <td>
                  {score === undefined ? (
                    <span style={{ color: 'var(--r-text-subtle)' }}>—</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="r-table-strong" style={{ minWidth: 26 }}>{score}</span>
                      <span style={{ flex: 1, minWidth: 60 }}>
                        <ProgressBar value={score} label={`${columns.score}: ${score}`} tone={tone.bar} />
                      </span>
                    </div>
                  )}
                </td>

                <td><Badge tone={tone.badge}>{statusLabel(product)}</Badge></td>

                <td>{product.chunkCountUnavailable ? unknownLabel : (product.chunkCount ?? 0)}</td>

                <td style={{ whiteSpace: 'nowrap' }}>
                  {product.raw_text ? formatDate(product.updated_at) : neverScrapedLabel}
                </td>

                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Link
                    href={`/dashboard/products/${product.id}` as Href}
                    style={{
                      fontWeight: 'var(--r-weight-semibold)',
                      color: 'var(--r-brand)',
                      textDecoration: 'none',
                    }}
                  >
                    {editLabel} →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableWrap>
  );
}
