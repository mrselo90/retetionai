'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  Badge as PolarisBadge,
  Banner,
  BlockStack,
  Box,
  Button as PolarisButton,
  Card as PolarisCard,
  Layout,
  Page,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Text,
  TextField,
} from '@shopify/polaris';
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

export default function ShopifyMapPage() {
  const t = useTranslations('ShopifyMap');
  const router = useRouter();
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([]);
  const [shopDomain, setShopDomain] = useState<string>('');
  const [localProducts, setLocalProducts] = useState<LocalProduct[]>([]);
  const [editing, setEditing] = useState<Record<string, { usage_instructions: string; recipe_summary?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }
      const token = session.access_token;

      const [shopifyRes, productsRes, instructionsRes] = await Promise.all([
        authenticatedRequest<{ products: ShopifyProduct[], shopDomain: string }>('/api/integrations/shopify/products', token),
        authenticatedRequest<{ products: LocalProduct[] }>('/api/products', token),
        authenticatedRequest<{ instructions: InstructionRow[] }>('/api/products/instructions/list', token).catch(() => ({ instructions: [] })),
      ]);

      setShopDomain(shopifyRes.shopDomain || 'myshopify.com');

      setShopifyProducts(shopifyRes.products || []);
      setLocalProducts(productsRes.products || []);
      const byExternal: Record<string, InstructionRow> = {};
      (instructionsRes.instructions || []).forEach((row) => {
        if (row.external_id) byExternal[row.external_id] = row;
        byExternal[row.product_id] = row;
      });
      const initialEdit: Record<string, { usage_instructions: string; recipe_summary?: string }> = {};
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
        toast.warning(t('toasts.shopifyNotConnected.title'), t('toasts.shopifyNotConnected.message'));
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
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || undefined;
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
        const createRes = await authenticatedRequest<{ product: { id: string } }>('/api/products', token, {
          method: 'POST',
          body: JSON.stringify({
            name: shopifyProduct.title,
            url: `https://${shopDomain}/products/${shopifyProduct.handle || shopifyProduct.id}`,
            external_id: shopifyProduct.id,
            raw_text: descriptionForRag ?? undefined,
          }),
        });
        productId = createRes.product?.id;
        if (productId) setLocalProducts((prev) => [...prev, { id: productId!, name: shopifyProduct.title, external_id: shopifyProduct.id }]);
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

      // Add success highlight animation
      const row = document.querySelector(`tr[data-product-id="${shopifyProduct.id}"]`);
      if (row) {
        row.classList.add('bg-success/10');
        setTimeout(() => row.classList.remove('bg-success/10'), 1000);
      }

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

  return (
    <Page title={t('title')} subtitle={t('description')} fullWidth>
      <Layout>
        <Layout.Section>
          <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-zinc-100 text-primary shrink-0 shadow-sm">
            <Link2 className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t('title')}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground font-medium max-w-xl">
              {t('description')}
            </p>
            {!loading && shopifyProducts.length > 0 && (
              <PolarisBadge tone="info">{t('productCount', { count: shopifyProducts.length })}</PolarisBadge>
            )}
          </div>
        </div>
        <PolarisButton onClick={() => router.push('/dashboard/products')} variant="secondary">
          {t('backToProducts')}
        </PolarisButton>
      </div>

      {/* Loading State */}
      {loading ? (
        <SkeletonPage title={t('title')}>
          <Layout>
            <Layout.Section>
              <PolarisCard>
                <BlockStack gap="300">
                  <SkeletonDisplayText size="small" maxWidth="24ch" />
                  <SkeletonBodyText lines={2} />
                  <SkeletonBodyText lines={6} />
                </BlockStack>
              </PolarisCard>
            </Layout.Section>
          </Layout>
        </SkeletonPage>
      ) : shopifyProducts.length === 0 ? (
        /* Empty State */
        <PolarisCard>
          <Box padding="600">
            <BlockStack gap="400" inlineAlign="center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-inner">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <Text as="h2" variant="headingMd" alignment="center">
              {t('empty.title')}
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
              {t('empty.description')}
            </Text>
            <PolarisButton onClick={() => router.push('/dashboard/integrations')} variant="primary">
              {t('empty.connectButton')}
            </PolarisButton>
            </BlockStack>
          </Box>
        </PolarisCard>
      ) : (
        /* Products Table */
        <div className="space-y-4">
          <Banner tone="info">
            <Text as="p" variant="bodySm">
              {t('table.hint')} <strong className="text-primary">{t('table.hintSave')}</strong>.
            </Text>
          </Banner>
          <PolarisCard>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border" aria-label={t('table.ariaLabel')}>
                <thead className="bg-muted/30">
                  <tr>
                    <th scope="col" className="px-5 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider w-[min(240px,30%)]">
                      {t('table.product')}
                    </th>
                    <th scope="col" className="px-5 py-4 text-left text-xs font-bold text-foreground uppercase tracking-wider">
                      {t('table.instructions')}
                    </th>
                    <th scope="col" className="px-5 py-4 text-right text-xs font-bold text-foreground uppercase tracking-wider w-32">
                      {t('table.action')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {shopifyProducts.map((p, idx) => (
                    <tr
                      key={p.id}
                      data-product-id={p.id}
                      className="hover:bg-gradient-to-r hover:from-muted/30 hover:to-transparent transition-all duration-200 group animate-fade-in"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      {/* Product Info */}
                      <td className="px-5 py-5 align-top">
                        <div className="flex gap-4">
                          {p.featuredImageUrl ? (
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0 shadow-sm">
                              <img
                                src={p.featuredImageUrl}
                                alt={p.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center text-muted-foreground shrink-0 shadow-inner">
                              <ImageIcon className="w-7 h-7" aria-hidden />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-foreground truncate mb-1" title={p.title}>{p.title}</p>
                            <p className="text-xs text-muted-foreground font-medium mb-2">{p.handle}</p>
                            {(p.productType || p.vendor || (p.variants?.length && p.variants[0])) && (
                              <div className="flex flex-wrap gap-2">
                                {p.productType && (
                                  <PolarisBadge tone="info">
                                    {p.productType}
                                  </PolarisBadge>
                                )}
                                {p.vendor && (
                                  <PolarisBadge>{p.vendor}</PolarisBadge>
                                )}
                                {p.variants?.[0]?.price != null && (
                                  <PolarisBadge tone="attention">
                                    {p.variants[0].price}
                                  </PolarisBadge>
                                )}
                              </div>
                            )}
                            {p.descriptionHtml && (
                              <p className="mt-2 text-xs text-muted-foreground/80 line-clamp-2 max-w-xs" title={stripHtmlForRag(p.descriptionHtml) ?? ''}>
                                {stripHtmlForRag(p.descriptionHtml)?.slice(0, 100)}…
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Usage Instructions Textarea */}
                      <td className="px-5 py-5 align-top">
                        <TextField
                          id={`instruction-${p.id}`}
                          label={t('instructionLabel', { title: p.title })}
                          labelHidden
                          autoComplete="off"
                          multiline={3}
                          value={editing[p.id]?.usage_instructions ?? ''}
                          placeholder={t('placeholder')}
                          onChange={(value) =>
                            setEditing((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id], usage_instructions: value },
                            }))
                          }
                        />
                      </td>

                      {/* Save Button */}
                      <td className="px-5 py-5 text-right align-top">
                        <PolarisButton
                          onClick={() => handleSave(p)}
                          disabled={saving === p.id}
                          loading={saving === p.id}
                          variant="primary"
                        >
                          {saving === p.id ? t('saving') : t('save')}
                        </PolarisButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PolarisCard>
        </div>
      )}
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
