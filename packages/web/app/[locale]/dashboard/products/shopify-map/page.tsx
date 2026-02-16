'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import Link from 'next/link';

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
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([]);
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
        authenticatedRequest<{ products: ShopifyProduct[] }>('/api/integrations/shopify/products', token),
        authenticatedRequest<{ products: LocalProduct[] }>('/api/products', token),
        authenticatedRequest<{ instructions: InstructionRow[] }>('/api/products/instructions/list', token).catch(() => ({ instructions: [] })),
      ]);

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
        toast.warning('Shopify bağlantısı yok', 'Önce Entegrasyonlar sayfasından Shopify bağlayın.');
      } else {
        toast.error('Veriler yüklenirken hata oluştu', err.message);
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
      toast.warning('Kullanım talimatı girin');
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
            url: `https://shopify.com/products/${shopifyProduct.handle || shopifyProduct.id}`,
            external_id: shopifyProduct.id,
            raw_text: descriptionForRag ?? undefined,
          }),
        });
        productId = createRes.product?.id;
        if (productId) setLocalProducts((prev) => [...prev, { id: productId!, name: shopifyProduct.title, external_id: shopifyProduct.id }]);
      }
      if (!productId) throw new Error('Ürün oluşturulamadı');
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
      toast.success('Kullanım talimatı kaydedildi');
      await loadData();
    } catch (err: any) {
      toast.error('Kaydetme hatası', err.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-teal-100 text-teal-600 shrink-0" aria-hidden>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div className="space-y-1 min-w-0">
              <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Shopify → Kullanım Talimatı</h1>
              <p className="text-sm text-zinc-600 max-w-xl">
                Her Shopify ürünü için tarif ve kullanım talimatı girin; AI asistan cevaplarında bu bilgiyi kullanır.
              </p>
              {!loading && shopifyProducts.length > 0 && (
                <p className="text-xs text-zinc-500">{shopifyProducts.length} ürün listeleniyor</p>
              )}
            </div>
          </div>
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Ürünlere dön
          </Link>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-12 text-center">
            <div className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />
            <p className="mt-4 text-sm font-medium text-zinc-600">Shopify ürünleri yükleniyor…</p>
            <p className="mt-1 text-xs text-zinc-500">Mağaza bağlantısı kontrol ediliyor</p>
          </div>
        ) : shopifyProducts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="p-10 sm:p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-100 flex items-center justify-center text-3xl" aria-hidden>
                🛍️
              </div>
              <h2 className="mt-4 text-lg font-semibold text-zinc-900">Ürün bulunamadı</h2>
              <p className="mt-2 text-sm text-zinc-600 max-w-md mx-auto">
                Shopify mağazanızdan henüz ürün çekilmedi veya entegrasyon kurulmamış. Önce Entegrasyonlar sayfasından Shopify bağlayın.
              </p>
              <Link
                href="/dashboard/integrations"
                className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
              >
                Shopify bağla
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-md overflow-hidden">
            <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
              <p className="text-xs font-medium text-zinc-600 uppercase tracking-wider">
                Her satırda talimat yazıp <strong>Kaydet</strong> ile AI bağlamına ekleyin
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50/80">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider w-[min(220px,30%)]">
                      Ürün (Shopify)
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                      Kullanım talimatı / Tarif
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold text-zinc-600 uppercase tracking-wider w-28">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {shopifyProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-4 py-4 align-top">
                        <div className="flex gap-3">
                          {p.featuredImageUrl ? (
                            <img
                              src={p.featuredImageUrl}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover bg-zinc-100 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-400 shrink-0" aria-hidden>
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                              </svg>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-900 truncate" title={p.title}>{p.title}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">{p.handle}</p>
                            {(p.productType || p.vendor || (p.variants?.length && p.variants[0])) && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {p.productType && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 text-xs font-medium">
                                    {p.productType}
                                  </span>
                                )}
                                {p.vendor && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-xs">
                                    {p.vendor}
                                  </span>
                                )}
                                {p.variants?.[0]?.price != null && (
                                  <span className="text-xs text-zinc-600 font-medium">{p.variants[0].price}</span>
                                )}
                              </div>
                            )}
                            {p.descriptionHtml && (
                              <p className="mt-1.5 text-xs text-zinc-400 line-clamp-2 max-w-xs" title={stripHtmlForRag(p.descriptionHtml) ?? ''}>
                                {stripHtmlForRag(p.descriptionHtml)?.slice(0, 100)}…
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <label className="sr-only">Kullanım talimatı: {p.title}</label>
                        <textarea
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm min-h-[88px] placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-shadow"
                          rows={3}
                          placeholder="Örn: Cildi temizledikten sonra ince bir tabaka sürün. Günde 1–2 kez kullanılabilir."
                          value={editing[p.id]?.usage_instructions ?? ''}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [p.id]: { ...prev[p.id], usage_instructions: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-4 py-4 text-right align-top">
                        <button
                          type="button"
                          disabled={saving === p.id}
                          onClick={() => handleSave(p)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                          {saving === p.id ? (
                            <>
                              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              Kaydediliyor…
                            </>
                          ) : (
                            'Kaydet'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    
  );
}
