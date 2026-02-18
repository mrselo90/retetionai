'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import {
  Users, ShoppingBag, MessageSquare, TrendingUp, Calendar,
  ArrowLeft, AlertTriangle, Star,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

const SEGMENT_COLORS: Record<string, string> = {
  champions: 'bg-emerald-100 text-emerald-800', loyal: 'bg-blue-100 text-blue-800',
  promising: 'bg-violet-100 text-violet-800', at_risk: 'bg-orange-100 text-orange-800',
  lost: 'bg-red-100 text-red-800', new: 'bg-zinc-100 text-zinc-800',
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
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  const loadCustomer = async () => {
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
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return <div className="space-y-6 animate-fade-in"><div className="h-8 w-48 bg-zinc-200 rounded animate-pulse" /><div className="h-96 bg-zinc-200 rounded animate-pulse" /></div>;
  }

  if (!customer) {
    return <div className="text-center py-12"><p>{t('notFound')}</p></div>;
  }

  const rfm = customer.rfmScore || { recency: 0, frequency: 0, monetary: 0 };

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/customers')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('backToCustomers')}
        </Button>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              <Badge className={SEGMENT_COLORS[customer.segment] || SEGMENT_COLORS.new}>
                {t(`segment.${customer.segment}`) || customer.segment}
              </Badge>
              {customer.churnProbability > 0.6 && (
                <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />{t('churnRisk')} {Math.round(customer.churnProbability * 100)}%</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{customer.phone}{customer.email ? ` • ${customer.email}` : ''}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('registered')}: {formatDate(customer.createdAt)} • {t('consent')}: {customer.consent}</p>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <ShoppingBag className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{customer.metrics.orderCount}</p>
            <p className="text-xs text-muted-foreground">Sipariş</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MessageSquare className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{customer.metrics.totalConversations}</p>
            <p className="text-xs text-muted-foreground">Konuşma</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{customer.metrics.avgSentiment || '—'}</p>
            <p className="text-xs text-muted-foreground">Ort. Duygu</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{rfm.recency}/{rfm.frequency}/{rfm.monetary}</p>
            <p className="text-xs text-muted-foreground">RFM</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{customer.metrics.lastOrderDate ? formatDate(customer.metrics.lastOrderDate) : '—'}</p>
            <p className="text-xs text-muted-foreground">{t('lastOrder')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders */}
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('ordersCount', { count: customer.orders.length })}</CardTitle></CardHeader>
          <CardContent>
            {customer.orders.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('noOrders')}</p>
            ) : (
              <div className="space-y-3">
                {customer.orders.slice(0, 10).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">#{order.externalOrderId}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                    </div>
                    <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>{order.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversations */}
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('conversationsCount', { count: customer.conversations.length })}</CardTitle></CardHeader>
          <CardContent>
            {customer.conversations.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('noConversations')}</p>
            ) : (
              <div className="space-y-3">
                {customer.conversations.slice(0, 10).map((conv) => (
                  <Link key={conv.id} href={`/dashboard/conversations/${conv.id}`} className="block p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{conv.messageCount} mesaj</p>
                        <p className="text-xs text-muted-foreground">{formatDate(conv.updatedAt)}</p>
                      </div>
                      <Badge variant={conv.status === 'human' ? 'destructive' : conv.status === 'resolved' ? 'default' : 'secondary'}>
                        {conv.status === 'human' ? t('statusHuman') : conv.status === 'resolved' ? t('statusResolved') : t('statusAi')}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feedback */}
      {customer.feedback.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Geri Bildirim</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customer.feedback.map((fb) => (
                <div key={fb.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{fb.type === 'nps' ? t('feedbackNps') : t('feedbackReview')}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(fb.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {fb.rating && <span className="font-bold">{fb.rating}/10</span>}
                    <Badge variant={fb.status === 'completed' ? 'default' : 'secondary'}>{fb.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
