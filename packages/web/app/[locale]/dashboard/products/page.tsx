'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Link } from '@/i18n/routing';
import { Card as PolarisCard, Layout, Page, SkeletonPage, Text } from '@shopify/polaris';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Package, Plus, Trash2, ExternalLink, FileText, CheckCircle, Loader2, ArrowRight, LayoutGrid, List } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import { SESSION_RECHECK_MS } from '@/lib/constants';

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
  chunkCountUnavailable?: boolean;
}

export default function ProductsPage() {
  const t = useTranslations('Products');
  const [products, setProducts] = useState<ProductWithChunks[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProductUrl, setNewProductUrl] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('productsViewMode');
    if (saved === 'grid' || saved === 'list') setViewMode(saved);
  }, []);

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('productsViewMode', mode);
    }
  };

  const loadProducts = async () => {
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await new Promise((r) => setTimeout(r, SESSION_RECHECK_MS));
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
            chunkCountUnavailable: false,
          }));

          setProducts(productsWithChunks);
        } catch (chunkError) {
          console.error('Failed to load chunk counts:', chunkError);
          // Fall back without lying that chunk count is zero.
          setProducts(list.map(p => ({ ...p, chunkCount: undefined, chunkCountUnavailable: true })));
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
      } catch (err: any) {
        console.error('Embedding generation failed:', err);
        toast.warning(
          t('toasts.embeddingWarning.title'),
          err.message || t('toasts.embeddingWarning.message')
        );
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
      <SkeletonPage title={t('title')}>
        <Layout>
          <Layout.Section>
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-3">
                <div className="h-10 w-40 bg-zinc-200 rounded-xl animate-pulse" />
                <div className="h-5 w-72 bg-zinc-100 rounded-lg animate-pulse" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-56 bg-card border border-border rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  const renderProductStatusBadges = (product: ProductWithChunks) => (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="outline-primary" size="sm" className="gap-1.5">
        <FileText className="w-3.5 h-3.5" />
        {product.chunkCountUnavailable ? t('card.chunksUnknown') : `${product.chunkCount || 0} ${t('card.chunks')}`}
      </Badge>
      {product.raw_text && (
        <Badge variant="success" size="sm" className="gap-1.5 shadow-sm">
          <CheckCircle className="w-3.5 h-3.5" />
          {t('card.scraped')}
        </Badge>
      )}
      {product.raw_text && !product.chunkCountUnavailable && (product.chunkCount || 0) > 0 && (
        <Badge variant="success" size="sm" className="gap-1.5 shadow-sm">
          <CheckCircle className="w-3.5 h-3.5" />
          {t('card.ragReady')}
        </Badge>
      )}
      {product.raw_text && product.chunkCountUnavailable && (
        <Badge variant="outline" size="sm" className="gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          {t('card.ragStatusUnknown')}
        </Badge>
      )}
      {product.raw_text && !product.chunkCountUnavailable && (product.chunkCount || 0) === 0 && (
        <Badge variant="outline" size="sm" className="gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          {t('card.ragNotReady')}
        </Badge>
      )}
    </div>
  );

  return (
    <Page title={t('title')} subtitle={t('description')} fullWidth>
      <Layout>
        <Layout.Section>
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <PolarisCard>
        <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <Text as="h2" variant="headingMd">{t('title')}</Text>
            <Text as="p" tone="subdued">{t('description')}</Text>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => handleViewModeChange('grid')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={viewMode === 'grid'}
                title={t('view.grid')}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('view.grid')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('list')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-pressed={viewMode === 'list'}
                title={t('view.list')}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('view.list')}</span>
              </button>
            </div>
            <Button variant="outline" size="lg" asChild>
              <Link href="/dashboard/products/shopify-map">
                <ArrowRight className="w-4 h-4 mr-2" />
                {t('shopifyMapButton')}
              </Link>
            </Button>
            <Button size="lg" onClick={() => setShowAddModal(true)}>
              <Plus className="w-5 h-5 mr-2" />
              {t('addProductButton')}
            </Button>
          </div>
        </div>
      </PolarisCard>

      {/* Products Grid/List */}
      {products.length === 0 && !loading ? (
        <EmptyState
          icon={Package}
          title={t('empty.title')}
          description={t('empty.description')}
          iconVariant="primary"
          action={{
            label: t('empty.button'),
            onClick: () => setShowAddModal(true),
            variant: 'default',
          }}
          secondaryAction={{
            label: t('empty.refresh'),
            onClick: () => {
              setLoading(true);
              loadProducts();
            },
            variant: 'outline',
          }}
        />
      ) : (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((product) => (
              <Card key={product.id} hover className="group overflow-hidden">
                <CardHeader className="pb-4 ">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg line-clamp-2 pr-2 font-bold">{product.name}</CardTitle>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirm(t('card.deleteConfirm'))) {
                          handleDeleteProduct(product.id);
                        }
                      }}
                      type="button"
                      title={t('card.deleteConfirm')}
                      className="flex-shrink-0 p-2 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
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

                  {renderProductStatusBadges(product)}

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
        ) : (
          <PolarisCard>
            <div className="divide-y divide-border">
              <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_auto] gap-4 px-5 py-3 bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div>{t('list.columns.product')}</div>
                <div>{t('list.columns.source')}</div>
                <div>{t('list.columns.status')}</div>
                <div className="text-right">{t('list.columns.actions')}</div>
              </div>

              {products.map((product) => (
                <div key={product.id} className="px-4 sm:px-5 py-4">
                  <div className="md:hidden space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground leading-snug line-clamp-2">{product.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground break-all">{product.id}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirm(t('card.deleteConfirm'))) handleDeleteProduct(product.id);
                        }}
                        type="button"
                        title={t('card.deleteConfirm')}
                        className="flex-shrink-0 p-2 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:text-primary/80 line-clamp-1 flex items-center gap-2 font-medium"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" />
                      <span className="truncate">{product.url}</span>
                    </a>

                    {renderProductStatusBadges(product)}

                    <Button variant="outline" className="w-full" asChild>
                      <Link href={`/dashboard/products/${product.id}`}>
                        <ArrowRight className="w-4 h-4 mr-2" />
                        {t('card.edit')}
                      </Link>
                    </Button>
                  </div>

                  <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_auto] gap-4 items-center">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/products/${product.id}`}
                        className="block font-semibold text-foreground hover:text-primary line-clamp-2"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground truncate">{product.id}</p>
                    </div>

                    <div className="min-w-0">
                      <a
                        href={product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:text-primary/80 line-clamp-2 inline-flex items-start gap-2"
                      >
                        <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="break-all line-clamp-2">{product.url}</span>
                      </a>
                    </div>

                    <div>
                      {renderProductStatusBadges(product)}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/products/${product.id}`}>
                          {t('card.edit')}
                        </Link>
                      </Button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirm(t('card.deleteConfirm'))) handleDeleteProduct(product.id);
                        }}
                        type="button"
                        title={t('card.deleteConfirm')}
                        className="p-2 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PolarisCard>
        )
      )}

      {/* Add Product Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => {
        if (!scraping) setShowAddModal(open);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center ">
                <Plus className="w-6 h-6" />
              </div>
              <DialogTitle className="text-2xl">{t('addModal.title')}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="pt-4">
            {scraping ? (
              <div className="py-12 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
                <p className="text-xl font-bold mb-2">{scrapeProgress}</p>
                <p className="text-sm text-muted-foreground font-medium">{t('addModal.scraping.wait')}</p>
                <div className="mt-6 w-full max-w-xs mx-auto bg-muted rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-primary animate-pulse rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="product-name">{t('addModal.nameLabel')}</Label>
                  <Input
                    id="product-name"
                    type="text"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder={t('addModal.namePlaceholder')}
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-url">{t('addModal.urlLabel')}</Label>
                  <Input
                    id="product-url"
                    type="url"
                    value={newProductUrl}
                    onChange={(e) => setNewProductUrl(e.target.value)}
                    placeholder={t('addModal.urlPlaceholder')}
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground font-medium">
                    {t('addModal.urlHelper')}
                  </p>
                </div>

                <DialogFooter className="pt-4 gap-3 sm:gap-0">
                  <Button variant="outline" size="lg" className="flex-1 sm:flex-none" onClick={() => setShowAddModal(false)}>
                    {t('addModal.cancel')}
                  </Button>
                  <Button size="lg" className="flex-1 sm:flex-none " onClick={handleAddProduct}>
                    <Plus className="w-5 h-5 mr-2" />
                    {t('addModal.submit')}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
