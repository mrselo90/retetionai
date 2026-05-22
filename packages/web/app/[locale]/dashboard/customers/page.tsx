'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Search, Users, ShoppingBag, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
  createdAt: string;
}

const SEGMENT_BADGE: Record<string, string> = {
  champions: 'd-badge-success',
  loyal: 'd-badge-info',
  promising: 'd-badge-attention',
  at_risk: 'd-badge-warning',
  lost: 'd-badge-error',
  new: 'd-badge-neutral',
};

const SEGMENTS = ['all', 'champions', 'loyal', 'promising', 'at_risk', 'lost', 'new'] as const;

export default function CustomersPage() {
  const t = useTranslations('Customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [segment, setSegment] = useState('all');
  const [search, setSearch] = useState('');

  const loadCustomers = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let url = `/api/customers?page=${page}&limit=20`;
      if (segment !== 'all') url += `&segment=${segment}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const response = await authenticatedRequest<{ customers: Customer[]; total: number }>(url, session.access_token);
      setCustomers(response.customers);
      setTotal(response.total);
    } catch {
      toast.error(t('toasts.loadError.title'), t('toasts.loadError.message'));
    } finally {
      setLoading(false);
    }
  }, [page, segment, search, t]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  // Reset page when segment or search changes
  const handleSegmentChange = (s: string) => {
    setSegment(s);
    setPage(1);
  };

  const handleSearch = () => {
    setPage(1);
    void loadCustomers();
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="d-page">
      <div className="d-page-header">
        <h1 className="d-page-title">{t('title')}</h1>
        <p className="d-page-subtitle">{t('subtitle', { total })}</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="d-search-wrap" style={{ flex: '1 1 220px', minWidth: 180 }}>
          <Search size={14} className="d-search-icon" />
          <input
            className="d-input"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); }}
          />
        </div>
        <select
          className="d-select"
          value={segment}
          onChange={e => { handleSegmentChange(e.target.value); }}
        >
          {SEGMENTS.map(s => (
            <option key={s} value={s}>
              {s === 'all' ? t('filterAll') : t(`segment.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="d-table-wrap">
        <table className="d-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Segment</th>
              <th>{t('orders')}</th>
              <th>{t('conversations')}</th>
              <th>Churn Risk</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j}><div style={{ height: 14, background: '#E8E6DF', borderRadius: 4, width: j === 0 ? 120 : 60 }} /></td>
                  ))}
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr><td colSpan={6}>
                <div className="d-empty">
                  <div className="d-empty-icon"><Users size={18} /></div>
                  <p className="d-empty-title">{t('empty.title')}</p>
                  <p className="d-empty-desc">{t('empty.description')}</p>
                </div>
              </td></tr>
            ) : customers.map(customer => (
              <tr key={customer.id} style={{ cursor: 'pointer' }} onClick={() => { window.location.href = `/dashboard/customers/${customer.id}`; }}>
                <td style={{ fontWeight: 500 }}>{customer.name || '—'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{customer.phone}</td>
                <td><span className={`d-badge ${SEGMENT_BADGE[customer.segment] || 'd-badge-neutral'}`}>{t(`segment.${customer.segment}`) || customer.segment}</span></td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <ShoppingBag size={12} style={{ color: '#8E918C' }} /> {customer.orderCount}
                  </span>
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <MessageSquare size={12} style={{ color: '#8E918C' }} /> {customer.conversationCount}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="d-progress-bar" style={{ width: 60 }}>
                      <div
                        className={`d-progress-bar-fill ${customer.churnProbability > 0.6 ? 'danger' : customer.churnProbability > 0.3 ? 'warning' : ''}`}
                        style={{ width: `${Math.round(customer.churnProbability * 100)}%` }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: '#5A5D58' }}>{Math.round(customer.churnProbability * 100)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '0 4px' }}>
          <span style={{ fontSize: 13, color: '#5A5D58' }}>{(page - 1) * 20 + 1}–{Math.min(page * 20, total)} / {total}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="d-btn d-btn-outline d-btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 1} style={{ opacity: page === 1 ? 0.4 : 1 }}>{t('previous')}</button>
            <button className="d-btn d-btn-outline d-btn-sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} style={{ opacity: page * 20 >= total ? 0.4 : 1 }}>{t('next')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
