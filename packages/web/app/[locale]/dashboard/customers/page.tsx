'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Link } from '@/i18n/routing';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Search, ShoppingBag, MessageSquare, AlertTriangle } from 'lucide-react';
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

const SEGMENT_COLORS: Record<string, string> = {
  champions: 'bg-emerald-100 text-emerald-800',
  loyal: 'bg-blue-100 text-blue-800',
  promising: 'bg-violet-100 text-violet-800',
  at_risk: 'bg-orange-100 text-orange-800',
  lost: 'bg-red-100 text-red-800',
  new: 'bg-zinc-100 text-zinc-800',
};

export default function CustomersPage() {
  const t = useTranslations('Customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [segment, setSegment] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadCustomers();
  }, [page, segment]);

  const loadCustomers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let url = `/api/customers?page=${page}&limit=20`;
      if (segment !== 'all') url += `&segment=${segment}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const response = await authenticatedRequest<{ customers: Customer[]; total: number }>(url, session.access_token);
      setCustomers(response.customers);
      setTotal(response.total);
    } catch (err) {
      toast.error(t('toasts.loadError.title'), t('toasts.loadError.message'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadCustomers();
  };

  const totalPages = Math.ceil(total / 20);

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="h-8 w-48 bg-zinc-200 rounded-lg animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-white border rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-8">
      <div className="space-y-1">
        <h1 className="page-title">{t('title')}</h1>
        <p className="page-description">{t('subtitle', { total })}</p>
      </div>

      {/* Search + Segment Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'champions', 'loyal', 'promising', 'at_risk', 'lost', 'new'].map((s) => (
            <Button
              key={s}
              variant={segment === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setSegment(s); setPage(1); }}
            >
              {s === 'all' ? t('filterAll') : t(`segment.${s}`)}
            </Button>
          ))}
        </div>
      </div>

      {/* Customer List */}
      {customers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{t('empty.title')}</h3>
            <p className="text-muted-foreground">{t('empty.description')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {customers.map((customer) => (
              <Link
                key={customer.id}
                href={`/dashboard/customers/${customer.id}`}
                className="block p-5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{customer.name}</h3>
                        <Badge className={SEGMENT_COLORS[customer.segment] || SEGMENT_COLORS.new}>
                          {t(`segment.${customer.segment}`) || customer.segment}
                        </Badge>
                        {customer.churnProbability > 0.6 && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Risk {Math.round(customer.churnProbability * 100)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4" />
                      <span>{customer.orderCount} {t('orders')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4" />
                      <span>{customer.conversationCount} {t('conversations')}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('previous')}
          </Button>
          <span className="text-sm text-muted-foreground">Sayfa {page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  );
}
