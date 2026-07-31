'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { PageFeedbackCard } from '@/components/ui/PageFeedbackCard';
import { Badge, EmptyState, TableWrap, Textarea } from '@/components/recete';
import { Link2, Package, Image as ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

interface ShopifyProductVariant {
  id: string;
  title: string;
  price: string;
  sku: string | null;
}

interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  descriptionHtml?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  featuredImageUrl?: string;
  variants?: ShopifyProductVariant[];
}

interface LocalProduct {
  id: string;
  name: string;
  external_id?: string;
}

interface InstructionRow {
  product_id: string;
  product_name?: string;
  external_id?: string;
  usage_instructions: string;
  recipe_summary?: string;
}

interface SaveFeedback {
  productId: string;
  productTitle: string;
  savedAt: string;
}

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function ShopifyMapPage() {
  const t = useTranslations('ShopifyMap');
  const router = useRouter();
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([]);
  const [shopDomain, setShopDomain] = useState<string>('');
  const [localProducts, setLocalProducts] = useState<LocalProduct[]>([]);
  const [editing, setEditing] = useState<
    Record<string, { usage_instructions: string; recipe_summary?: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<Record<string, SaveFeedback>>({});
  const [pageFeedback, setPageFeedback] = useState<SaveFeedback | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      const token = session.access_token;

      const [shopifyRes, productsRes, instructionsRes] = await Promise.all([
        authenticatedRequest<{ products: ShopifyProduct[]; shopDomain: string }>(
          '/api/integrations/shopify/products',
          token
        ),
        authenticatedRequest<{ products: LocalProduct[] }>('/api/products', token),
        authenticatedRequest<{ instructions: InstructionRow[] }>(
          '/api/products/instructions/list',
          token
        ).catch(() => ({ instructions: [] })),
      ]);

      setShopDomain(shopifyRes.shopDomain || 'myshopify.com');

      setShopifyProducts(shopifyRes.products || []);
      setLocalProducts(productsRes.products || []);
      const byExternal: Record<string, InstructionRow> = {};
      (instructionsRes.instructions || []).forEach((row) => {
        if (row.external_id) byExternal[row.external_id] = row;
        byExternal[row.product_id] = row;
      });
      const initialEdit: Record<string, { usage_instructions: string; recipe_summary?: string }> =
        {};
      (shopifyRes.products || []).forEach((p) => {
        const localId = productsRes.products?.find((lp) => lp.external_id === p.id)?.id;
        const instr = byExternal[p.id] || (localId ? byExternal[localId] : undefined);
        initialEdit[p.id] = {
          usage_instructions: instr?.usage_instructions ?? '',
          recipe_summary: instr?.recipe_summary ?? '',
        };
      });
      setEditing(initialEdit);
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message ?? '')
          : '';
      if (message.includes('Shopify integration not found') || message.includes('404')) {
        toast.warning(
          t('toasts.shopifyNotConnected.title'),
          t('toasts.shopifyNotConnected.message')
        );
      } else {
        toast.error(t('toasts.loadError.title'), message || t('toasts.loadError.message'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getLocalProductId = (shopifyId: string): string | null => {
    const byExternal = localProducts.find((p) => p.external_id === shopifyId);
    return byExternal?.id ?? null;
  };

  /** Strip HTML to plain text for RAG / AI context (stored in raw_text) */
  const stripHtmlForRag = (html: string | undefined): string | undefined => {
    if (!html?.trim()) return undefined;
    const doc = typeof document !== 'undefined' ? document : null;
    if (doc) {
      const div = doc.createElement('div');
      div.innerHTML = html;
      return div.textContent?.trim() || div.innerText?.trim() || undefined;
    }
    return (
      html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || undefined
    );
  };

  const handleSave = async (shopifyProduct: ShopifyProduct) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;
    const edit = editing[shopifyProduct.id];
    if (!edit?.usage_instructions?.trim()) {
      toast.warning(t('toasts.enterInstruction'));
      return;
    }
    setSaving(shopifyProduct.id);
    try {
      let productId = getLocalProductId(shopifyProduct.id);
      if (!productId) {
        const descriptionForRag = stripHtmlForRag(shopifyProduct.descriptionHtml);
        const createRes = await authenticatedRequest<{ product: { id: string } }>(
          '/api/products',
          token,
          {
            method: 'POST',
            body: JSON.stringify({
              name: shopifyProduct.title,
              url: `https://${shopDomain}/products/${shopifyProduct.handle || shopifyProduct.id}`,
              external_id: shopifyProduct.id,
              raw_text: descriptionForRag ?? undefined,
            }),
          }
        );
        productId = createRes.product?.id;
        if (productId)
          setLocalProducts((prev) => [
            ...prev,
            { id: productId!, name: shopifyProduct.title, external_id: shopifyProduct.id },
          ]);
      }
      if (!productId) throw new Error(t('toasts.productCreateError'));
      const descriptionForRag = stripHtmlForRag(shopifyProduct.descriptionHtml);
      if (descriptionForRag) {
        await authenticatedRequest(`/api/products/${productId}`, token, {
          method: 'PUT',
          body: JSON.stringify({ raw_text: descriptionForRag }),
        });
      }
      await authenticatedRequest(`/api/products/${productId}/instruction`, token, {
        method: 'PUT',
        body: JSON.stringify({
          usage_instructions: edit.usage_instructions.trim(),
          recipe_summary: edit.recipe_summary?.trim() || undefined,
        }),
      });
      toast.success(t('toasts.saveSuccess.title'), t('toasts.saveSuccess.message'));
      const feedback = {
        productId: shopifyProduct.id,
        productTitle: shopifyProduct.title,
        savedAt: new Date().toISOString(),
      };
      setSaveFeedback((prev) => ({
        ...prev,
        [shopifyProduct.id]: feedback,
      }));
      setPageFeedback(feedback);

      setHighlightedId(shopifyProduct.id);
      setTimeout(
        () => setHighlightedId((current) => (current === shopifyProduct.id ? null : current)),
        1000
      );

      await loadData();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message ?? '')
          : '';
      toast.error(t('toasts.saveError.title'), message || t('toasts.saveError.message'));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="d-page">
        <div className="d-page-header" role="status" aria-live="polite" aria-label={t('title')}>
          <div className="r-skeleton" style={{ height: 26, width: 260, marginBottom: 8 }} />
          <div className="r-skeleton" style={{ height: 16, width: 360 }} />
        </div>
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="r-skeleton"
            style={{ height: 90, marginBottom: 16 }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="d-page">
      <div
        className="d-page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--r-radius-md)',
              background: 'var(--r-brand-tint)',
              color: 'var(--r-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Link2 size={20} aria-hidden="true" />
          </span>
          <div style={{ minWidth: 0 }}>
            <h1 className="r-page-title">{t('title')}</h1>
            <p className="r-page-sub" style={{ maxWidth: 560 }}>
              {t('description')}
            </p>
            {shopifyProducts.length > 0 ? (
              <span style={{ display: 'inline-block', marginTop: 8 }}>
                <Badge tone="brand">{t('productCount', { count: shopifyProducts.length })}</Badge>
              </span>
            ) : null}
          </div>
        </div>
        <button
          className="r-btn r-btn-secondary"
          onClick={() => router.push('/dashboard/products')}
        >
          {t('backToProducts')}
        </button>
      </div>

      {pageFeedback ? (
        <div style={{ marginBottom: 16 }}>
          <PageFeedbackCard
            tone="success"
            title={t('feedback.savedTitle', { title: pageFeedback.productTitle })}
            message={t('feedback.savedMessage', { time: formatSavedAt(pageFeedback.savedAt) })}
            actionLabel={t('feedback.jumpToSaved')}
            onAction={() => {
              document
                .querySelector(`tr[data-product-id="${pageFeedback.productId}"]`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            dismissLabel={t('feedback.dismiss')}
            onDismiss={() => setPageFeedback(null)}
          />
        </div>
      ) : null}

      {shopifyProducts.length === 0 ? (
        <div className="r-card">
          <EmptyState
            icon={<Package size={28} aria-hidden="true" />}
            title={t('empty.title')}
            body={t('empty.description')}
            action={
              <button
                className="r-btn r-btn-primary"
                onClick={() => router.push('/dashboard/integrations')}
              >
                {t('empty.connectButton')}
              </button>
            }
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="r-alert r-alert-info">
            <p className="r-alert-body" style={{ margin: 0 }}>
              {t('table.hint')} <strong>{t('table.hintSave')}</strong>.
            </p>
          </div>

          <TableWrap>
            <table className="r-table" aria-label={t('table.ariaLabel')}>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 'min(280px, 32%)' }}>
                    {t('table.product')}
                  </th>
                  <th scope="col">{t('table.instructions')}</th>
                  <th scope="col" style={{ width: 140, textAlign: 'right' }}>
                    {t('table.action')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shopifyProducts.map((p) => (
                  <tr
                    key={p.id}
                    data-product-id={p.id}
                    style={{
                      background: highlightedId === p.id ? 'var(--r-success-bg)' : undefined,
                      transition: 'background 300ms',
                    }}
                  >
                    <td style={{ verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {p.featuredImageUrl ? (
                          <img
                            src={p.featuredImageUrl}
                            alt={p.title}
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 'var(--r-radius-md)',
                              objectFit: 'cover',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 'var(--r-radius-md)',
                              background: 'var(--r-surface-muted)',
                              color: 'var(--r-text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <ImageIcon size={20} aria-hidden="true" />
                          </span>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <p
                            className="r-table-strong"
                            style={{
                              margin: '0 0 2px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 280,
                            }}
                            title={p.title}
                          >
                            {p.title}
                          </p>
                          <p className="r-hint" style={{ margin: '0 0 6px' }}>
                            {p.handle}
                          </p>
                          {p.productType ||
                          p.vendor ||
                          saveFeedback[p.id] ||
                          p.variants?.[0]?.price != null ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {saveFeedback[p.id] ? (
                                <Badge tone="success">{t('saved')}</Badge>
                              ) : null}
                              {p.productType ? <Badge tone="brand">{p.productType}</Badge> : null}
                              {p.vendor ? <Badge tone="neutral">{p.vendor}</Badge> : null}
                              {p.variants?.[0]?.price != null ? (
                                <Badge tone="caution">{p.variants[0].price}</Badge>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td style={{ verticalAlign: 'top' }}>
                      <Textarea
                        label={t('instructionLabel', { title: p.title })}
                        labelHidden
                        rows={3}
                        autoComplete="off"
                        value={editing[p.id]?.usage_instructions ?? ''}
                        placeholder={t('placeholder')}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEditing((prev) => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], usage_instructions: value },
                          }));
                          setSaveFeedback((prev) => {
                            if (!prev[p.id]) return prev;
                            const next = { ...prev };
                            delete next[p.id];
                            return next;
                          });
                          setPageFeedback((current) =>
                            current?.productId === p.id ? null : current
                          );
                        }}
                      />
                    </td>

                    <td style={{ verticalAlign: 'top', textAlign: 'right' }}>
                      <button
                        className="r-btn r-btn-primary r-btn-sm"
                        onClick={() => handleSave(p)}
                        disabled={saving === p.id}
                        aria-busy={saving === p.id || undefined}
                      >
                        {saving === p.id ? t('saving') : t('save')}
                      </button>
                      {saveFeedback[p.id] ? (
                        <p className="r-hint" style={{ marginTop: 8, color: 'var(--r-success)' }}>
                          {t('lastSaved', { time: formatSavedAt(saveFeedback[p.id].savedAt) })}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      )}
    </div>
  );
}
