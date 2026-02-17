'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Link } from '@/i18n/routing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, Trash2, ExternalLink, FileText, CheckCircle, Loader2, X, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Product {
  id: string;
  name: string;
  url: string;
  external_id?: string;
  raw_text?: string;
  created_at: string;
  updated_at: string;
}

interface ProductWithChunks extends Product {
  chunkCount?: number;
}

export default function ProductsPage() {
  const t = useTranslations('Products');
  const [products, setProducts] = useState<ProductWithChunks[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProductUrl, setNewProductUrl] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      let { data: { session } } = await supabase.auth.getSession();
      // Give Supabase a moment to restore session from storage on first navigation
      if (!session) {
        await new Promise((r) => setTimeout(r, 400));
        const next = await supabase.auth.getSession();
        session = next.data.session;
      }
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const response = await authenticatedRequest<{ products?: Product[] }>(
        '/api/products',
        session.access_token
      );

      const list = response?.products ?? [];
      const productsWithChunks = await Promise.all(
        list.map(async (product) => {
          try {
            const chunksResponse = await authenticatedRequest<{ chunkCount: number }>(
              `/api/products/${product.id}/chunks`,
              session.access_token
            );
            return { ...product, chunkCount: chunksResponse.chunkCount };
          } catch {
            return { ...product, chunkCount: 0 };
          }
        })
      );

      setProducts(productsWithChunks);
    } catch (err: any) {
      console.error('Failed to load products:', err);
      if (err.message?.includes('Unauthorized') || err.message?.includes('401')) {
        toast.error(t('toasts.sessionExpired.title'), t('toasts.sessionExpired.message'));
        window.location.href = '/login';
      } else {
        toast.error(t('toasts.loadError.title'), t('toasts.loadError.message'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newProductUrl || !newProductName) {
      toast.warning(t('toasts.missingInfo.title'), t('toasts.missingInfo.message'));
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setScraping(true);
      setScrapeProgress(t('addModal.scraping.creating'));

      const createResponse = await authenticatedRequest<{ product: Product }>(
        '/api/products',
        session.access_token,
        {
          method: 'POST',
          body: JSON.stringify({
            name: newProductName,
            url: newProductUrl,
          }),
        }
      );

      setScrapeProgress(t('addModal.scraping.scraping'));

      await authenticatedRequest<{
        message: string;
        scraped: any;
      }>(
        `/api/products/${createResponse.product.id}/scrape`,
        session.access_token,
        { method: 'POST' }
      );

      setScrapeProgress(t('addModal.scraping.embeddings'));

      try {
        await authenticatedRequest(
          `/api/products/${createResponse.product.id}/generate-embeddings`,
          session.access_token,
          { method: 'POST' }
        );
      } catch (err) {
        console.error('Embedding generation failed:', err);
      }

      setScrapeProgress(t('addModal.scraping.completed'));
      toast.success(t('toasts.addSuccess.title'), t('toasts.addSuccess.message'));

      await loadProducts();

      setNewProductUrl('');
      setNewProductName('');
      setShowAddModal(false);
      setScraping(false);
      setScrapeProgress('');
    } catch (err: any) {
      console.error('Failed to add product:', err);
      toast.error(t('toasts.addError.title'), err.message || t('toasts.addError.message'));
      setScraping(false);
      setScrapeProgress('');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await authenticatedRequest(
        `/api/products/${productId}`,
        session.access_token,
        { method: 'DELETE' }
      );

      toast.success(t('toasts.deleteSuccess.title'), t('toasts.deleteSuccess.message'));
      await loadProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
      toast.error(t('toasts.deleteError.title'), t('toasts.deleteError.message'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-zinc-200 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-zinc-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-white border border-zinc-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" asChild>
            <Link href="/dashboard/products/shopify-map">
              {t('shopifyMapButton')}
            </Link>
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('addProductButton')}
          </Button>
        </div>
      </div>

      {/* Products Grid */}
      {products.length === 0 && !loading ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('empty.title')}</h3>
            <p className="text-muted-foreground mb-6">{t('empty.description')}</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={() => {
                  setLoading(true);
                  loadProducts();
                }}
              >
                <Loader2 className="w-4 h-4 mr-2" />
                {t('empty.refresh')}
              </Button>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('empty.button')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base line-clamp-2 pr-2">{product.name}</CardTitle>
                  <button
                    onClick={() => {
                      if (confirm(t('card.deleteConfirm'))) {
                        handleDeleteProduct(product.id);
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline line-clamp-1 flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{product.url}</span>
                </a>

                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="gap-1">
                    <FileText className="w-3 h-3" />
                    {product.chunkCount || 0} {t('card.chunks')}
                  </Badge>
                  {product.raw_text && (
                    <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle className="w-3 h-3" />
                      {t('card.scraped')}
                    </Badge>
                  )}
                </div>

                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/dashboard/products/${product.id}`}>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    {t('card.edit')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !scraping) setShowAddModal(false); }}>
          <Card className="max-w-md w-full animate-slide-up shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('addModal.title')}</CardTitle>
                <button
                  onClick={() => !scraping && setShowAddModal(false)}
                  disabled={scraping}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {scraping ? (
                <div className="py-8 text-center">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
                  <p className="text-lg font-semibold">{scrapeProgress}</p>
                  <p className="text-sm text-muted-foreground mt-2">{t('addModal.scraping.wait')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="form-label">{t('addModal.nameLabel')}</label>
                    <Input
                      type="text"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder={t('addModal.namePlaceholder')}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="form-label">{t('addModal.urlLabel')}</label>
                    <Input
                      type="url"
                      value={newProductUrl}
                      onChange={(e) => setNewProductUrl(e.target.value)}
                      placeholder={t('addModal.urlPlaceholder')}
                      className="h-11"
                    />
                    <p className="form-helper">
                      {t('addModal.urlHelper')}
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>
                      {t('addModal.cancel')}
                    </Button>
                    <Button className="flex-1" onClick={handleAddProduct}>
                      {t('addModal.submit')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
