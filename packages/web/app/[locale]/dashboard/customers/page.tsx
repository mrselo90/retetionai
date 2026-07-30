'use client';

import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedFileRequest, authenticatedRequest, triggerBrowserDownload } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { getErrorMessage } from '@/lib/errors';
import { Download, Search, Users } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { CustomersTable } from '@/components/recete/CustomersTable';
import { FilterTabs } from '@/components/recete/FilterTabs';
import { EmptyState } from '@/components/recete';
import type { BadgeTone } from '@/components/recete';

interface Customer {
  id: string;
  name: string;
  phone: string;
  consent: string;
  segment: string;
  rfmScore: { recency: number; frequency: number; monetary: number };
  churnProbability: number;
  orderCount: number;
  conversationCount: number;
  lastOrderDate?: string | null;
  createdAt: string;
}

const SEGMENT_TONE: Record<string, BadgeTone> = {
  champions: 'success',
  loyal: 'brand',
  promising: 'caution',
  at_risk: 'warning',
  lost: 'danger',
  new: 'neutral',
};

const SEGMENTS = ['all', 'champions', 'loyal', 'promising', 'at_risk', 'lost', 'new'] as const;

/**
 * The design's chips. A subset of SEGMENTS on purpose: seven pills would wrap to
 * two rows and bury the three that merchants act on. The full list stays
 * reachable through the dropdown next to them.
 */
const CHIP_SEGMENTS = ['all', 'loyal', 'new', 'at_risk'] as const;

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const t = useTranslations('Customers');
  const locale = useLocale();
  const [customers, setCustomers] = useState<Customer[]>([]);
  /**
   * Null until the first response lands. It used to start at 0, so for the ~2s
   * before data arrived the header stated "0 customers" and then jumped to the
   * real number — a merchant with three customers was told they had none. Found by
   * an independent pass over the live dashboard.
   */
  const [total, setTotal] = useState<number | null>(null);
  const [segmentCounts, setSegmentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [segment, setSegment] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const { confirm, ConfirmDialogNode } = useConfirm();

  // The request keys off the deferred value, so typing "ahmet" is one fetch once
  // the field settles instead of one per keystroke.
  const deferredSearch = useDeferredValue(search.trim());

  const loadCustomers = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let url = `/api/customers?page=${page}&limit=${PAGE_SIZE}`;
      if (segment !== 'all') url += `&segment=${segment}`;
      if (deferredSearch) url += `&search=${encodeURIComponent(deferredSearch)}`;

      const response = await authenticatedRequest<{
        customers: Customer[];
        total: number;
        segmentCounts?: Record<string, number>;
      }>(url, session.access_token);
      setCustomers(response.customers);
      setTotal(response.total);
      if (response.segmentCounts) setSegmentCounts(response.segmentCounts);
    } catch {
      toast.error(t('toasts.loadError.title'), t('toasts.loadError.message'));
    } finally {
      setLoading(false);
    }
  }, [page, segment, deferredSearch, t]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  // Every filter change resets to page 1 at the source, not in an effect: an
  // effect would fire one request for (old page, new filter) and a second for
  // page 1. setPage(1) while already on page 1 is a no-op, so typing is free.
  const changeSegment = (next: string) => {
    setSegment(next);
    setPage(1);
  };

  const segmentTone = (value: string): BadgeTone => SEGMENT_TONE[value] ?? 'neutral';
  const segmentLabel = (value: string): string => {
    // A segment the RFM job has not been taught yet should show its raw value
    // rather than an i18n key.
    if (!SEGMENTS.includes(value as (typeof SEGMENTS)[number])) return value;
    return t(`segment.${value}`);
  };

  // "No customers yet" and "nothing matched your filter" are different facts. A
  // merchant with 214 customers searching "zzzz" must not be told their store has
  // not synced yet.
  const isFiltered = segment !== 'all' || deferredSearch.length > 0;

  const clearFilters = () => {
    setSearch('');
    setSegment('all');
    setPage(1);
  };

  /**
   * Export the view the merchant is looking at, not the whole table — pulling the
   * at-risk list is the reason to have this at all.
   *
   * Confirmed first because the file contains decrypted phone numbers: they are
   * encrypted at rest precisely because they are sensitive, and this puts them in
   * plaintext in someone's Downloads folder.
   */
  const handleExport = async () => {
    const ok = await confirm({
      title: t('export.confirmTitle'),
      message: t('export.confirmMessage'),
      confirmLabel: t('export.confirmAction'),
    });
    if (!ok) return;

    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let url = '/api/customers/export.csv';
      const params = new URLSearchParams();
      if (segment !== 'all') params.set('segment', segment);
      if (deferredSearch) params.set('search', deferredSearch);
      if (params.toString()) url += `?${params.toString()}`;

      const { text, filename, headers } = await authenticatedFileRequest(url, session.access_token);
      triggerBrowserDownload(text, filename);

      const rowCount = Number(headers.get('X-Export-Row-Count') || 0);
      // A silently capped export reads as a complete one, so say so.
      if (headers.get('X-Export-Truncated') === '1') {
        toast.warning(t('export.truncatedTitle'), t('export.truncatedMessage', { count: rowCount }));
      } else {
        toast.success(t('export.doneTitle'), t('export.doneMessage', { count: rowCount }));
      }
    } catch (err) {
      toast.error(t('export.errorTitle'), getErrorMessage(err, t('export.errorMessage')));
    } finally {
      setExporting(false);
    }
  };

  const hasPrev = page > 1;
  const hasNext = total !== null && page * PAGE_SIZE < total;

  return (
    <div className="d-page">
      {ConfirmDialogNode}

      <div className="d-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="r-page-title">{t('title')}</h1>
          <p className="r-page-sub">
            {total === null ? t('subtitleLoading') : t('subtitle', { total })}
          </p>
        </div>
        <button
          type="button"
          className="r-btn r-btn-secondary"
          onClick={handleExport}
          disabled={exporting || total === null || total === 0}
          aria-busy={exporting}
        >
          <Download size={14} aria-hidden="true" />
          {exporting ? t('export.busy') : t('export.button')}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="r-search-wrap" style={{ flex: '1 1 220px', minWidth: 180 }}>
          <Search size={14} className="r-search-icon" aria-hidden="true" />
          <input
            className="r-input"
            type="search"
            aria-label={t('searchPlaceholder')}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div>
          <label className="sr-only" htmlFor="customers-segment">{t('segmentFilterLabel')}</label>
          <select
            id="customers-segment"
            className="r-select"
            value={segment}
            onChange={e => changeSegment(e.target.value)}
          >
            {SEGMENTS.map(s => (
              <option key={s} value={s}>
                {s === 'all' ? t('filterAll') : t(`segment.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <FilterTabs
          label={t('segmentChipsLabel')}
          value={CHIP_SEGMENTS.includes(segment as (typeof CHIP_SEGMENTS)[number]) ? segment : 'all'}
          onChange={changeSegment}
          tabs={CHIP_SEGMENTS.map(s => ({
            value: s,
            label: s === 'all' ? t('filterAll') : t(`segment.${s}`),
            count: segmentCounts[s],
            tone: s === 'at_risk' ? ('warning' as const) : undefined,
          }))}
        />
      </div>

      {loading ? (
        <div role="status" aria-live="polite" aria-label={t('loading')}>
          {[0, 1, 2, 3, 4].map(row => (
            <div key={row} className="r-skeleton" style={{ height: 52, marginBottom: 8 }} aria-hidden="true" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={<Users size={18} />}
          title={isFiltered ? t('noResults.title') : t('empty.title')}
          body={isFiltered ? t('noResults.description') : t('empty.description')}
          action={
            isFiltered ? (
              <button type="button" className="r-btn r-btn-secondary r-btn-sm" onClick={clearFilters}>
                {t('noResults.clear')}
              </button>
            ) : undefined
          }
        />
      ) : (
        <CustomersTable
          customers={customers}
          columns={{
            name: t('columns.name'),
            phone: t('columns.phone'),
            segment: t('columns.segment'),
            orders: t('orders'),
            conversations: t('conversations'),
            lastOrder: t('columns.lastOrder'),
            churnRisk: t('columns.churnRisk'),
          }}
          segmentTone={segmentTone}
          segmentLabel={segmentLabel}
          churnLabel={percent => `${t('columns.churnRisk')}: ${percent}%`}
          formatDate={iso => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}
          noOrdersLabel={t('noOrders')}
          unnamedLabel={t('unnamed')}
        />
      )}

      {/* Pagination */}
      {total !== null && total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '0 4px', gap: 12, flexWrap: 'wrap' }}>
          <span className="r-hint">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="r-btn r-btn-secondary r-btn-sm"
              onClick={() => setPage(p => p - 1)}
              disabled={!hasPrev}
            >
              {t('previous')}
            </button>
            <button
              className="r-btn r-btn-secondary r-btn-sm"
              onClick={() => setPage(p => p + 1)}
              disabled={!hasNext}
            >
              {t('next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
