'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Link2, ArrowLeft, Package, Image, Loader2, Save, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([]);
  const [shopDomain, setShopDomain] = useState<string>('');
  const [localProducts, setLocalProducts] = useState<LocalProduct[]>([]);
  const [instructions, setInstructions] = useState<Record<string, InstructionRow>>({});
  const [editing, setEditing] = useState<Record<string, { usage_instructions: string; recipe_summary?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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
      setInstructions(byExternal);
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
    } catch (err: any) {
      if (err.message?.includes('Shopify integration not found') || err.message?.includes('404')) {
        toast.warning(t('toasts.shopifyNotConnected.title'), t('toasts.shopifyNotConnected.message'));
      } else {
        toast.error(t('toasts.loadError.title'), err.message);
      }
    } finally {
      setLoading(false);
    }
  };

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
    } catch (err: any) {
      toast.error(t('toasts.saveError.title'), err.message);
    } finally {
      setSaving(null);
    }
  };

  return (
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
              <Badge variant="outline-primary" size="sm" className="font-bold">
                {t('productCount', { count: shopifyProducts.length })}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="outline" size="lg" asChild className="shrink-0">
          <Link href="/dashboard/products">
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t('backToProducts')}
          </Link>
        </Button>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="space-y-6 animate-fade-in">
          <div className="space-y-3">
            <div className="h-10 w-56 bg-zinc-200 rounded-xl animate-pulse" />
            <div className="h-5 w-96 bg-zinc-100 rounded-lg animate-pulse" />
          </div>
          <Card className="overflow-hidden ">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 bg-white border-b-2 border-zinc-100 animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </Card>
        </div>
      ) : shopifyProducts.length === 0 ? (
        /* Empty State */
        <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors ">
          <CardContent className="p-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-inner">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">{t('empty.title')}</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto text-base">
              {t('empty.description')}
            </p>
            <Button size="lg" asChild className=" hover:shadow-xl">
              <Link href="/dashboard/integrations">
                {t('empty.connectButton')}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Products Table */
        <Card hover className="overflow-hidden ">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b py-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {t('table.hint')} <strong className="text-primary">{t('table.hintSave')}</strong>.
            </p>
          </CardHeader>
          <CardContent className="p-0">
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
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center text-muted-foreground shrink-0 shadow-inner">
                              <Image className="w-7 h-7" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-foreground truncate mb-1" title={p.title}>{p.title}</p>
                            <p className="text-xs text-muted-foreground font-medium mb-2">{p.handle}</p>
                            {(p.productType || p.vendor || (p.variants?.length && p.variants[0])) && (
                              <div className="flex flex-wrap gap-2">
                                {p.productType && (
                                  <Badge variant="outline-primary" size="sm">
                                    {p.productType}
                                  </Badge>
                                )}
                                {p.vendor && (
                                  <Badge variant="outline" size="sm">
                                    {p.vendor}
                                  </Badge>
                                )}
                                {p.variants?.[0]?.price != null && (
                                  <Badge variant="secondary" size="sm" className="font-bold">
                                    {p.variants[0].price}
                                  </Badge>
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
                        <label htmlFor={`instruction-${p.id}`} className="sr-only">
                          {t('instructionLabel', { title: p.title })}
                        </label>
                        <textarea
                          id={`instruction-${p.id}`}
                          aria-label={t('instructionLabel', { title: p.title })}
                          className="w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-sm min-h-[88px] placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none transition-all duration-200 hover:border-border/80 font-medium resize-none"
                          rows={3}
                          placeholder={t('placeholder')}
                          value={editing[p.id]?.usage_instructions ?? ''}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id], usage_instructions: e.target.value },
                            }))
                          }
                        />
                      </td>

                      {/* Save Button */}
                      <td className="px-5 py-5 text-right align-top">
                        <Button
                          onClick={() => handleSave(p)}
                          disabled={saving === p.id}
                          size="lg"
                          className=" hover:shadow-xl"
                        >
                          {saving === p.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t('saving')}
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              {t('save')}
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
