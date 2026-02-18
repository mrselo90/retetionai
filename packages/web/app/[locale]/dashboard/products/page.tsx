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
      
      // Batch fetch chunk counts for all products
      if (list.length > 0) {
        try {
          const productIds = list.map(p => p.id);
          const chunksResponse = await authenticatedRequest<{ chunkCounts: Array<{ productId: string; chunkCount: number }> }>(
            '/api/products/chunks/batch',
            session.access_token,
            {
              method: 'POST',
              body: JSON.stringify({ productIds }),
            }
          );
          
          // Map chunk counts to products
          const chunkCountMap = new Map(
            chunksResponse.chunkCounts.map(cc => [cc.productId, cc.chunkCount])
          );
          
          const productsWithChunks = list.map(product => ({
            ...product,
            chunkCount: chunkCountMap.get(product.id) ?? 0,
          }));
          
          setProducts(productsWithChunks);
        } catch (chunkError) {
          console.error('Failed to load chunk counts:', chunkError);
          // Fall back to products without chunk counts
          setProducts(list.map(p => ({ ...p, chunkCount: 0 })));
        }
      } else {
        setProducts([]);
      }
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
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-3">
          <div className="h-10 w-40 bg-gradient-to-r from-zinc-200 to-zinc-100 rounded-xl animate-pulse" />
          <div className="h-5 w-72 bg-gradient-to-r from-zinc-100 to-zinc-50 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 bg-white border-2 border-zinc-100 rounded-xl animate-pulse shadow-sm" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground text-base font-medium">{t('description')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="lg" asChild>
            <Link href="/dashboard/products/shopify-map">
              <ArrowRight className="w-4 h-4 mr-2" />
              {t('shopifyMapButton')}
            </Link>
          </Button>
          <Button size="lg" onClick={() => setShowAddModal(true)} className="shadow-lg hover:shadow-xl">
            <Plus className="w-5 h-5 mr-2" />
            {t('addProductButton')}
          </Button>
        </div>
      </div>

      {/* Products Grid */}
      {products.length === 0 && !loading ? (
        <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors">
          <CardContent className="p-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-inner">
              <Package className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-3">{t('empty.title')}</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto text-base">{t('empty.description')}</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setLoading(true);
                  loadProducts();
                }}
              >
                <Loader2 className="w-5 h-5 mr-2" />
                {t('empty.refresh')}
              </Button>
              <Button size="lg" onClick={() => setShowAddModal(true)} className="shadow-lg hover:shadow-xl">
                <Plus className="w-5 h-5 mr-2" />
                {t('empty.button')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((product, idx) => (
            <Card key={product.id} hover className="group overflow-hidden" style={{ animationDelay: `${idx * 50}ms` }}>
              <CardHeader className="pb-4 bg-gradient-to-r from-muted/20 to-transparent">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg line-clamp-2 pr-2 font-bold">{product.name}</CardTitle>
                  <button
                    onClick={() => {
                      if (confirm(t('card.deleteConfirm'))) {
                        handleDeleteProduct(product.id);
                      }
                    }}
                    className="flex-shrink-0 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100"
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
                  className="text-sm text-primary hover:text-primary/80 line-clamp-1 flex items-center gap-2 font-medium transition-colors group/link"
                >
                  <ExternalLink className="w-4 h-4 shrink-0 group-hover/link:scale-110 transition-transform" />
                  <span className="truncate">{product.url}</span>
                </a>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline-primary" size="sm" className="gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    {product.chunkCount || 0} {t('card.chunks')}
                  </Badge>
                  {product.raw_text && (
                    <Badge variant="success" size="sm" className="gap-1.5 shadow-sm">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {t('card.scraped')}
                    </Badge>
                  )}
                </div>

                <Button variant="outline" className="w-full group/btn" asChild size="lg">
                  <Link href={`/dashboard/products/${product.id}`}>
                    <ArrowRight className="w-4 h-4 mr-2 group-hover/btn:translate-x-1 transition-transform" />
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
          <Card className="max-w-lg w-full animate-scale-in shadow-2xl border-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary via-primary/80 to-primary"></div>
            <CardHeader className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-lg">
                    <Plus className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-2xl">{t('addModal.title')}</CardTitle>
                </div>
                <button
                  onClick={() => !scraping && setShowAddModal(false)}
                  disabled={scraping}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 p-2 rounded-lg hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {scraping ? (
                <div className="py-12 text-center">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  </div>
                  <p className="text-xl font-bold mb-2">{scrapeProgress}</p>
                  <p className="text-sm text-muted-foreground font-medium">{t('addModal.scraping.wait')}</p>
                  <div className="mt-6 w-full max-w-xs mx-auto bg-muted rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-primary/80 animate-pulse rounded-full" style={{ width: '60%' }}></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2.5">
                    <label className="text-sm font-bold text-foreground">{t('addModal.nameLabel')}</label>
                    <Input
                      type="text"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder={t('addModal.namePlaceholder')}
                      className="h-12"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-sm font-bold text-foreground">{t('addModal.urlLabel')}</label>
                    <Input
                      type="url"
                      value={newProductUrl}
                      onChange={(e) => setNewProductUrl(e.target.value)}
                      placeholder={t('addModal.urlPlaceholder')}
                      className="h-12"
                    />
                    <p className="text-xs text-muted-foreground font-medium">
                      {t('addModal.urlHelper')}
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" size="lg" className="flex-1" onClick={() => setShowAddModal(false)}>
                      {t('addModal.cancel')}
                    </Button>
                    <Button size="lg" className="flex-1 shadow-lg" onClick={handleAddProduct}>
                      <Plus className="w-5 h-5 mr-2" />
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
