'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Badge, Button, EmptyState } from '@/components/recete';
import type { BadgeTone } from '@/components/recete';
import { Link } from '@/i18n/routing';
import {
  Users, ShoppingBag, MessageSquare, TrendingUp, Calendar,
  ArrowLeft, Star,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

const SEGMENT_TONES: Record<string, BadgeTone> = {
  champions: 'success',
  loyal: 'brand',
  promising: 'caution',
  at_risk: 'warning',
  lost: 'danger',
  new: 'neutral',
};

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email?: string;
  consent: string;
  segment: string;
  rfmScore: { recency: number; frequency: number; monetary: number };
  churnProbability: number;
  createdAt: string;
  metrics: {
    orderCount: number;
    totalConversations: number;
    avgSentiment: number;
    lastOrderDate: string | null;
    lastInteractionDate: string | null;
  };
  orders: Array<{ id: string; externalOrderId: string; status: string; deliveryDate?: string; createdAt: string }>;
  conversations: Array<{ id: string; orderId?: string; messageCount: number; status: string; createdAt: string; updatedAt: string }>;
  feedback: Array<{ id: string; type: string; status: string; rating?: number; createdAt: string }>;
}

export default function CustomerDetailPage() {
  const t = useTranslations('CustomerDetail');
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadCustomer() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const response = await authenticatedRequest<{ customer: CustomerDetail }>(
        `/api/customers/${customerId}`, session.access_token
      );
      setCustomer(response.customer);
    } catch (err) {
      toast.error(t('toasts.loadError.title'), t('toasts.loadError.message'));
      router.push('/dashboard/customers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Every setState in loadCustomer runs after its first await, so nothing here updates
    // state synchronously; the rule does not follow the await, hence the disable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCustomer();
  }, [customerId]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <div className="d-page">
        <div
          className="d-page-header"
          role="status"
          aria-live="polite"
          aria-label={t('backToCustomers')}
        >
          <div className="r-skeleton" style={{ height: 26, width: 200, marginBottom: 8 }} />
          <div className="r-skeleton" style={{ height: 16, width: 300 }} />
        </div>
        <div className="r-card space-y-4">
          <div className="r-skeleton" style={{ height: 32, width: 192 }} aria-hidden="true" />
          <div className="r-skeleton" style={{ height: 384 }} aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="d-page">
        <div className="d-page-header">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/customers')}>
            <ArrowLeft size={14} aria-hidden="true" />
            {t('backToCustomers')}
          </Button>
        </div>
        <div className="r-card">
          <EmptyState title={t('notFound')} />
        </div>
      </div>
    );
  }

  const rfm = customer.rfmScore || { recency: 0, frequency: 0, monetary: 0 };

  return (
    <div className="d-page">
      {/* Header */}
      <div className="d-page-header">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/customers')}
          style={{ marginBottom: 10 }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {t('backToCustomers')}
        </Button>
        <div className="flex items-center gap-4">
          <span className="r-avatar r-avatar-xl" aria-hidden="true">
            <Users size={24} />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="r-page-title">{customer.name}</h1>
              <Badge tone={SEGMENT_TONES[customer.segment] || 'neutral'}>
                {t(`segment.${customer.segment}`) || customer.segment}
              </Badge>
              {customer.churnProbability > 0.6 && (
                <Badge tone="danger">{`${t('churnRisk')} ${Math.round(customer.churnProbability * 100)}%`}</Badge>
              )}
            </div>
            <p className="r-page-sub" style={{ margin: 0 }}>
              {customer.phone}{customer.email ? ` • ${customer.email}` : ''}
            </p>
            <p className="r-hint">
              {t('registered')}: {formatDate(customer.createdAt)} • {t('consent')}: {customer.consent}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Metrics Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="r-card r-card-tight flex flex-col items-center gap-1 text-center">
            <ShoppingBag className="w-5 h-5 mb-1 text-muted-foreground" aria-hidden="true" />
            <p className="r-table-strong" style={{ fontSize: 'var(--r-text-lg)' }}>{String(customer.metrics.orderCount)}</p>
            <p className="r-hint">Orders</p>
          </div>
          <div className="r-card r-card-tight flex flex-col items-center gap-1 text-center">
            <MessageSquare className="w-5 h-5 mb-1 text-muted-foreground" aria-hidden="true" />
            <p className="r-table-strong" style={{ fontSize: 'var(--r-text-lg)' }}>{String(customer.metrics.totalConversations)}</p>
            <p className="r-hint">Conversations</p>
          </div>
          <div className="r-card r-card-tight flex flex-col items-center gap-1 text-center">
            <Star className="w-5 h-5 mb-1 text-muted-foreground" aria-hidden="true" />
            <p className="r-table-strong" style={{ fontSize: 'var(--r-text-lg)' }}>{String(customer.metrics.avgSentiment || '—')}</p>
            <p className="r-hint">Avg. Sentiment</p>
          </div>
          <div className="r-card r-card-tight flex flex-col items-center gap-1 text-center">
            <TrendingUp className="w-5 h-5 mb-1 text-muted-foreground" aria-hidden="true" />
            <p className="r-table-strong" style={{ fontSize: 'var(--r-text-lg)' }}>{`${rfm.recency}/${rfm.frequency}/${rfm.monetary}`}</p>
            <p className="r-hint">RFM</p>
          </div>
          <div className="r-card r-card-tight flex flex-col items-center gap-1 text-center">
            <Calendar className="w-5 h-5 mb-1 text-muted-foreground" aria-hidden="true" />
            <p className="r-table-strong" style={{ fontSize: 'var(--r-text-lg)' }}>{customer.metrics.lastOrderDate ? formatDate(customer.metrics.lastOrderDate) : '—'}</p>
            <p className="r-hint">{t('lastOrder')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Orders */}
          <section className="r-card flex flex-col gap-3">
            <h2 className="r-card-title">{t('ordersCount', { count: customer.orders.length })}</h2>
            {customer.orders.length === 0 ? (
              <p className="r-hint">{t('noOrders')}</p>
            ) : (
              <div className="space-y-3">
                {customer.orders.slice(0, 10).map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="r-table-strong">{`#${order.externalOrderId}`}</p>
                      <p className="r-hint">{formatDate(order.createdAt)}</p>
                    </div>
                    <Badge tone={order.status === 'delivered' ? 'success' : 'neutral'}>{order.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Conversations */}
          <section className="r-card flex flex-col gap-3">
            <h2 className="r-card-title">{t('conversationsCount', { count: customer.conversations.length })}</h2>
            {customer.conversations.length === 0 ? (
              <p className="r-hint">{t('noConversations')}</p>
            ) : (
              <div className="space-y-3">
                {customer.conversations.slice(0, 10).map((conv) => (
                  <Link key={conv.id} href={`/dashboard/conversations/${conv.id}`} className="block p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="r-table-strong">{`${conv.messageCount} messages`}</p>
                        <p className="r-hint">{formatDate(conv.updatedAt)}</p>
                      </div>
                      <Badge tone={conv.status === 'human' ? 'danger' : conv.status === 'resolved' ? 'success' : 'neutral'}>
                        {conv.status === 'human' ? t('statusHuman') : conv.status === 'resolved' ? t('statusResolved') : t('statusAi')}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Feedback */}
        {customer.feedback.length > 0 && (
          <section className="r-card flex flex-col gap-3">
            <h2 className="r-card-title">Feedback</h2>
            <div className="space-y-3">
              {customer.feedback.map((fb) => (
                <div key={fb.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="r-table-strong">{fb.type === 'nps' ? t('feedbackNps') : t('feedbackReview')}</p>
                    <p className="r-hint">{formatDate(fb.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {fb.rating && <span className="r-table-strong">{`${fb.rating}/10`}</span>}
                    <Badge tone={fb.status === 'completed' ? 'success' : 'neutral'}>{fb.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
