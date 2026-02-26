'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Link } from '@/i18n/routing';
import {
  ButtonGroup as PolarisButtonGroup,
  Card as PolarisCard,
  IndexTable,
  Layout,
  Page,
  Select as PolarisSelect,
  SkeletonPage,
  Text,
  TextField as PolarisTextField,
  EmptyState,
  Button as PolarisButton,
} from '@shopify/polaris';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, Trash2, ExternalLink, FileText, CheckCircle, Loader2, ArrowRight, LayoutGrid, List, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useTranslations, useLocale } from 'next-intl';
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

type ProductsViewMode = 'grid' | 'list';
type ProductStatusFilter = 'all' | 'rag_ready' | 'rag_not_ready' | 'rag_unknown' | 'scraped' | 'not_scraped';
type ProductSortOption = 'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc' | 'chunks_desc' | 'chunks_asc';
type ProductsSavedView = {
  id: string;
  name: string;
  searchQuery: string;
  statusFilter: ProductStatusFilter;
  sortBy: ProductSortOption;
};

export default function ProductsPage() {
  const t = useTranslations('Products');
  const locale = useLocale();
  const [products, setProducts] = useState<ProductWithChunks[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ProductsViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>('all');
  const [sortBy, setSortBy] = useState<ProductSortOption>('updated_desc');
  const [savedViews, setSavedViews] = useState<ProductsSavedView[]>([]);
  const [activeSavedViewId, setActiveSavedViewId] = useState<string>('all');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState<'scrape' | 'embeddings' | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProductUrl, setNewProductUrl] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('productsViewMode');
    if (saved === 'grid' || saved === 'list') setViewMode(saved);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('productsSavedViews');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ProductsSavedView[];
      if (Array.isArray(parsed)) setSavedViews(parsed);
    } catch {
      // ignore malformed local data
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('productsSavedViews', JSON.stringify(savedViews));
  }, [savedViews]);

  useEffect(() => {
    if (activeSavedViewId === 'all') return;
    const active = savedViews.find((v) => v.id === activeSavedViewId);
    if (!active) {
      setActiveSavedViewId('all');
      return;
    }
    const matchesActive =
      active.searchQuery === searchQuery &&
      active.statusFilter === statusFilter &&
      active.sortBy === sortBy;
    if (!matchesActive) {
      setActiveSavedViewId('all');
    }
  }, [activeSavedViewId, savedViews, searchQuery, statusFilter, sortBy]);

  useEffect(() => {
    // Remove selections that no longer exist after reload/delete.
    setSelectedProductIds((prev) => prev.filter((id) => products.some((p) => p.id === id)));
  }, [products]);

  const handleViewModeChange = (mode: ProductsViewMode) => {
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

      if (list.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      // Render the product list immediately; hydrate chunk counts in background.
      setProducts(list.map((p) => ({ ...p, chunkCount: undefined, chunkCountUnavailable: true })));
      setLoading(false);

      try {
        const productIds = list.map((p) => p.id);
        const chunksResponse = await authenticatedRequest<{ chunkCounts: Array<{ productId: string; chunkCount: number }> }>(
          '/api/products/chunks/batch',
          session.access_token,
          {
            method: 'POST',
            body: JSON.stringify({ productIds }),
          }
        );

        const chunkCountMap = new Map(
          chunksResponse.chunkCounts.map((cc) => [cc.productId, cc.chunkCount])
        );

        setProducts((prev) =>
          prev.map((product) => ({
            ...product,
            chunkCount: chunkCountMap.get(product.id),
            chunkCountUnavailable: false,
          }))
        );
      } catch (chunkError) {
        console.error('Failed to load chunk counts:', chunkError);
        // Keep list visible; just leave counts unavailable.
        setProducts((prev) =>
          prev.map((p) => ({ ...p, chunkCount: undefined, chunkCountUnavailable: true }))
        );
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
      // loading is cleared once base list arrives (or on error)
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

  const renderProductStatusCompact = (product: ProductWithChunks) => {
    const hasRaw = Boolean(product.raw_text);
    const ragReady = hasRaw && !product.chunkCountUnavailable && (product.chunkCount || 0) > 0;
    const ragUnknown = hasRaw && product.chunkCountUnavailable;
    const ragNotReady = hasRaw && !product.chunkCountUnavailable && (product.chunkCount || 0) === 0;

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline-primary" size="sm" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            {product.chunkCountUnavailable ? t('card.chunksUnknown') : `${product.chunkCount || 0} ${t('card.chunks')}`}
          </Badge>
          {hasRaw && (
            <Badge variant="success" size="sm" className="gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              {t('card.scraped')}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {ragReady && (
            <Badge variant="success" size="sm" className="gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              {t('card.ragReady')}
            </Badge>
          )}
          {ragUnknown && (
            <Badge variant="outline" size="sm" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              {t('card.ragStatusUnknown')}
            </Badge>
          )}
          {ragNotReady && (
            <Badge variant="outline" size="sm" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              {t('card.ragNotReady')}
            </Badge>
          )}
          {!hasRaw && (
            <Text as="span" variant="bodySm" tone="subdued">
              {t('filters.statusOptions.notScraped')}
            </Text>
          )}
        </div>
      </div>
    );
  };

  const getStatusFilterLabel = (value: ProductStatusFilter) => {
    switch (value) {
      case 'rag_ready':
        return t('filters.statusOptions.ragReady');
      case 'rag_not_ready':
        return t('filters.statusOptions.ragNotReady');
      case 'rag_unknown':
        return t('filters.statusOptions.ragUnknown');
      case 'scraped':
        return t('filters.statusOptions.scraped');
      case 'not_scraped':
        return t('filters.statusOptions.notScraped');
      case 'all':
      default:
        return t('filters.statusOptions.all');
    }
  };

  const getSortLabel = (value: ProductSortOption) => {
    switch (value) {
      case 'updated_asc':
        return t('filters.sortOptions.updatedAsc');
      case 'name_asc':
        return t('filters.sortOptions.nameAsc');
      case 'name_desc':
        return t('filters.sortOptions.nameDesc');
      case 'chunks_desc':
        return t('filters.sortOptions.chunksDesc');
      case 'chunks_asc':
        return t('filters.sortOptions.chunksAsc');
      case 'updated_desc':
      default:
        return t('filters.sortOptions.updatedDesc');
    }
  };

  const getProductStatus = (product: ProductWithChunks): ProductStatusFilter => {
    if (!product.raw_text) return 'not_scraped';
    if (product.chunkCountUnavailable) return 'rag_unknown';
    if ((product.chunkCount || 0) > 0) return 'rag_ready';
    return 'rag_not_ready';
  };

  const filteredAndSortedProducts = [...products]
    .filter((product) => {
      const status = getProductStatus(product);
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'scraped'
            ? Boolean(product.raw_text)
            : status === statusFilter;

      const haystack = `${product.name} ${product.url} ${product.id}`.toLowerCase();
      const matchesSearch = !deferredSearchQuery || haystack.includes(deferredSearchQuery);
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'updated_asc':
          return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        case 'chunks_desc':
          return (b.chunkCount ?? -1) - (a.chunkCount ?? -1);
        case 'chunks_asc':
          return (a.chunkCount ?? -1) - (b.chunkCount ?? -1);
        case 'updated_desc':
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

  const visibleProductIds = filteredAndSortedProducts.map((p) => p.id);
  const selectedIdSet = new Set(selectedProductIds);
  const selectedVisibleCount = visibleProductIds.filter((id) => selectedIdSet.has(id)).length;
  const allVisibleSelected = visibleProductIds.length > 0 && selectedVisibleCount === visibleProductIds.length;

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const toggleSelectAllVisibleProducts = () => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleProductIds.forEach((id) => next.delete(id));
      } else {
        visibleProductIds.forEach((id) => next.add(id));
      }
      return Array.from(next);
    });
  };

  const clearSelectedProducts = () => setSelectedProductIds([]);

  const runBulkProductAction = async (action: 'scrape' | 'embeddings') => {
    if (selectedProductIds.length === 0) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setBulkActionLoading(action);
      let successCount = 0;
      let failCount = 0;

      if (action === 'embeddings') {
        const response = await authenticatedRequest<any>(
          '/api/products/generate-embeddings-batch',
          session.access_token,
          {
            method: 'POST',
            body: JSON.stringify({ productIds: selectedProductIds }),
          }
        );
        successCount = response?.summary?.successful ?? 0;
        failCount = response?.summary?.failed ?? Math.max(0, selectedProductIds.length - successCount);
      } else {
        const response = await authenticatedRequest<any>(
          '/api/products/scrape-batch',
          session.access_token,
          {
            method: 'POST',
            body: JSON.stringify({ productIds: selectedProductIds }),
          }
        );
        // async queue route only queues jobs; treat queued count as success for UX
        successCount = response?.count ?? 0;
        failCount = Math.max(0, selectedProductIds.length - successCount);
      }

      if (successCount > 0) {
        toast.success(
          action === 'scrape' ? t('bulk.scrapeSuccessTitle') : t('bulk.embeddingsSuccessTitle'),
          t(action === 'scrape' ? 'bulk.successMessage' : 'bulk.successMessage', {
            success: successCount,
            failed: failCount,
          })
        );
      } else {
        toast.error(
          action === 'scrape' ? t('bulk.scrapeErrorTitle') : t('bulk.embeddingsErrorTitle'),
          t('bulk.allFailedMessage', { failed: failCount })
        );
      }

      await loadProducts();
    } catch (err: any) {
      console.error(`Bulk ${action} request failed:`, err);
      toast.error(
        action === 'scrape' ? t('bulk.scrapeErrorTitle') : t('bulk.embeddingsErrorTitle'),
        err?.message || t('bulk.requestFailedMessage')
      );
    } finally {
      setBulkActionLoading(null);
    }
  };

  const applySavedView = (viewId: string) => {
    setActiveSavedViewId(viewId);
    if (viewId === 'all') {
      setSearchQuery('');
      setStatusFilter('all');
      setSortBy('updated_desc');
      return;
    }
    const view = savedViews.find((v) => v.id === viewId);
    if (!view) return;
    setSearchQuery(view.searchQuery);
    setStatusFilter(view.statusFilter);
    setSortBy(view.sortBy);
  };

  const saveCurrentView = () => {
    const name = window.prompt(t('savedViews.promptName'));
    if (!name?.trim()) return;
    const id = `view-${Date.now()}`;
    const next: ProductsSavedView = {
      id,
      name: name.trim(),
      searchQuery,
      statusFilter,
      sortBy,
    };
    setSavedViews((prev) => [...prev, next]);
    setActiveSavedViewId(id);
  };

  const deleteSavedView = (viewId: string) => {
    setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
    if (activeSavedViewId === viewId) {
      setActiveSavedViewId('all');
    }
  };

  return (
    <Page title={t('title')} subtitle={t('description')} fullWidth>
      <Layout>
        <Layout.Section>
          <div className="space-y-6 animate-fade-in pb-8">
            {/* Header */}
            <PolarisCard>
              <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1.5">
                  <Text as="h2" variant="headingMd">{t('title')}</Text>
                  <Text as="p" tone="subdued">{t('description')}</Text>
                </div>
                <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-none xl:auto-cols-max xl:grid-flow-col xl:items-center">
                  <PolarisButtonGroup>
                    <button
                      type="button"
                      onClick={() => handleViewModeChange('grid')}
                      className={`inline-flex min-w-[76px] items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors border ${viewMode === 'grid'
                        ? 'bg-[#1f6f53] text-white border-[#1f6f53]'
                        : 'bg-white text-zinc-700 border-[var(--p-color-border)] hover:bg-zinc-50'
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
                      className={`inline-flex min-w-[76px] items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors border ${viewMode === 'list'
                        ? 'bg-[#1f6f53] text-white border-[#1f6f53]'
                        : 'bg-white text-zinc-700 border-[var(--p-color-border)] hover:bg-zinc-50'
                        }`}
                      aria-pressed={viewMode === 'list'}
                      title={t('view.list')}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">{t('view.list')}</span>
                    </button>
                  </PolarisButtonGroup>
                  <PolarisButton url={`/${locale}/dashboard/products/shopify-map`}>
                    {t('shopifyMapButton')}
                  </PolarisButton>
                  <PolarisButton variant="primary" onClick={() => setShowAddModal(true)}>
                    {t('addProductButton')}
                  </PolarisButton>
                </div>
              </div>
            </PolarisCard>

            {products.length > 0 && (
              <PolarisCard>
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-3 xl:items-start">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <button
                          type="button"
                          onClick={() => applySavedView('all')}
                          className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${activeSavedViewId === 'all'
                            ? 'border-[var(--p-color-border-emphasis)] bg-[var(--p-color-bg-fill-secondary)] text-[var(--p-color-text)]'
                            : 'border-border bg-background text-muted-foreground hover:text-foreground'
                            }`}
                        >
                          {t('savedViews.all')}
                        </button>
                        {savedViews.map((view) => (
                          <span key={view.id} className="inline-flex shrink-0 items-center rounded-full border border-border bg-background text-xs max-w-[220px]">
                            <button
                              type="button"
                              onClick={() => applySavedView(view.id)}
                              className={`px-3 py-1.5 rounded-full transition-colors truncate ${activeSavedViewId === view.id
                                ? 'bg-[var(--p-color-bg-fill-secondary)] text-[var(--p-color-text)]'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                              title={view.name}
                            >
                              {view.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSavedView(view.id)}
                              className="pr-2 pl-1 text-muted-foreground hover:text-destructive"
                              aria-label={t('savedViews.deleteAria', { name: view.name })}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 xl:justify-end xl:self-start">
                      <PolarisButton onClick={saveCurrentView}>
                        {t('savedViews.saveCurrent')}
                      </PolarisButton>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--p-color-border-secondary)] bg-[var(--p-color-bg-surface-secondary)]/35 p-3 sm:p-4">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_260px_260px] 2xl:items-end">
                      <div className="min-w-0 lg:col-span-2 2xl:col-span-1">
                        <PolarisTextField
                          label={t('filters.searchLabel')}
                          autoComplete="off"
                          value={searchQuery}
                          onChange={setSearchQuery}
                          placeholder={t('filters.searchPlaceholder')}
                          prefix={<Search className="w-4 h-4 text-zinc-500" aria-hidden />}
                        />
                      </div>

                      <div className="min-w-0">
                        <PolarisSelect
                          label={t('filters.status')}
                          options={[
                            { label: t('filters.statusOptions.all'), value: 'all' },
                            { label: t('filters.statusOptions.ragReady'), value: 'rag_ready' },
                            { label: t('filters.statusOptions.ragNotReady'), value: 'rag_not_ready' },
                            { label: t('filters.statusOptions.ragUnknown'), value: 'rag_unknown' },
                            { label: t('filters.statusOptions.scraped'), value: 'scraped' },
                            { label: t('filters.statusOptions.notScraped'), value: 'not_scraped' },
                          ]}
                          value={statusFilter}
                          onChange={(value) => setStatusFilter(value as ProductStatusFilter)}
                        />
                      </div>

                      <div className="min-w-0">
                        <PolarisSelect
                          label={t('filters.sort')}
                          options={[
                            { label: t('filters.sortOptions.updatedDesc'), value: 'updated_desc' },
                            { label: t('filters.sortOptions.updatedAsc'), value: 'updated_asc' },
                            { label: t('filters.sortOptions.nameAsc'), value: 'name_asc' },
                            { label: t('filters.sortOptions.nameDesc'), value: 'name_desc' },
                            { label: t('filters.sortOptions.chunksDesc'), value: 'chunks_desc' },
                            { label: t('filters.sortOptions.chunksAsc'), value: 'chunks_asc' },
                          ]}
                          value={sortBy}
                          onChange={(value) => setSortBy(value as ProductSortOption)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                    <Text as="p" tone="subdued">
                      {t('filters.resultsCount', { shown: filteredAndSortedProducts.length, total: products.length })}
                    </Text>
                    {(searchQuery || statusFilter !== 'all' || sortBy !== 'updated_desc') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                          setSortBy('updated_desc');
                          setActiveSavedViewId('all');
                        }}
                        className="text-primary hover:text-primary/80 font-medium text-left sm:text-right"
                      >
                        {t('filters.reset')}
                      </button>
                    )}
                  </div>

                  {(searchQuery || statusFilter !== 'all' || sortBy !== 'updated_desc') && (
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                      <span className="text-xs text-muted-foreground font-medium leading-7 shrink-0">{t('filters.applied')}:</span>
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        {searchQuery && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
                            {t('filters.searchChip', { value: searchQuery })}
                            <button type="button" onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {statusFilter !== 'all' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
                            {t('filters.statusChip', { value: getStatusFilterLabel(statusFilter) })}
                            <button type="button" onClick={() => setStatusFilter('all')} className="text-muted-foreground hover:text-foreground">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                        {sortBy !== 'updated_desc' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
                            {t('filters.sortChip', { value: getSortLabel(sortBy) })}
                            <button type="button" onClick={() => setSortBy('updated_desc')} className="text-muted-foreground hover:text-foreground">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </PolarisCard>
            )}

            {products.length > 0 && (
              <PolarisCard>
                <div className="p-4 sm:p-5 grid gap-3 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={toggleSelectAllVisibleProducts}
                      disabled={visibleProductIds.length === 0}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm hover:bg-muted disabled:opacity-50"
                    >
                      <span
                        aria-hidden
                        className={`inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${allVisibleSelected ? 'bg-primary text-primary-foreground border-primary' : 'border-zinc-300 text-transparent'
                          }`}
                      >
                        ✓
                      </span>
                      <span>
                        {allVisibleSelected ? t('bulk.unselectVisible') : t('bulk.selectVisible')}
                      </span>
                    </button>
                    <Text as="p" tone="subdued">
                      {t('bulk.selectedCount', { count: selectedProductIds.length, visible: selectedVisibleCount })}
                    </Text>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 2xl:min-w-[420px]">
                    <PolarisButton
                      disabled={selectedProductIds.length === 0 || bulkActionLoading !== null}
                      onClick={clearSelectedProducts}
                    >
                      {t('bulk.clearSelection')}
                    </PolarisButton>
                    <PolarisButton
                      disabled={selectedProductIds.length === 0 || bulkActionLoading !== null}
                      onClick={() => runBulkProductAction('scrape')}
                    >
                      {bulkActionLoading === 'scrape' ? t('bulk.scraping') : t('bulk.rescrape')}
                    </PolarisButton>
                    <PolarisButton
                      variant="primary"
                      disabled={selectedProductIds.length === 0 || bulkActionLoading !== null}
                      onClick={() => runBulkProductAction('embeddings')}
                    >
                      {bulkActionLoading === 'embeddings' ? t('bulk.generatingEmbeddings') : t('bulk.generateEmbeddings')}
                    </PolarisButton>
                  </div>
                </div>
              </PolarisCard>
            )}

            {/* Products Grid/List */}
            {products.length === 0 && !loading ? (
              <PolarisCard>
                <EmptyState
                  heading={t('empty.title')}
                  action={{
                    content: t('empty.button'),
                    onAction: () => setShowAddModal(true),
                  }}
                  secondaryAction={{
                    content: t('empty.refresh'),
                    onAction: () => {
                      setLoading(true);
                      loadProducts();
                    },
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>{t('empty.description')}</p>
                </EmptyState>
              </PolarisCard>
            ) : (
              filteredAndSortedProducts.length === 0 ? (
                <PolarisCard>
                  <div className="p-8 text-center">
                    <Text as="p" tone="subdued">{t('filters.noMatches')}</Text>
                  </div>
                </PolarisCard>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredAndSortedProducts.map((product) => (
                    <PolarisCard key={product.id}>
                      <div className="p-4 sm:p-5 flex flex-col h-full space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={selectedIdSet.has(product.id)}
                              onChange={() => toggleProductSelection(product.id)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={t('bulk.selectProduct', { name: product.name })}
                              className="mt-1 rounded border-zinc-300"
                            />
                            <h3 className="text-lg line-clamp-2 pr-2 font-bold text-foreground m-0">{product.name}</h3>
                          </div>
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
                        <div className="space-y-4 flex flex-col flex-1">
                          <a
                            href={product.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:text-primary/80 line-clamp-1 flex items-center gap-2 font-medium transition-colors group/link"
                          >
                            <ExternalLink className="w-4 h-4 shrink-0 group-hover/link:scale-110 transition-transform" />
                            <span className="truncate">{product.url}</span>
                          </a>

                          <div className="mb-auto">
                            {renderProductStatusBadges(product)}
                          </div>

                          <div className="mt-4">
                            <PolarisButton fullWidth url={`/${locale}/dashboard/products/${product.id}`}>
                              {t('card.edit')}
                            </PolarisButton>
                          </div>
                        </div>
                      </div>
                    </PolarisCard>
                  ))}
                </div>
              ) : (
                <PolarisCard>
                  <div className="divide-y divide-border">
                    {filteredAndSortedProducts.map((product) => (
                      <div key={`mobile-${product.id}`} className="px-4 sm:px-5 py-4 md:hidden">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={selectedIdSet.has(product.id)}
                                onChange={() => toggleProductSelection(product.id)}
                                aria-label={t('bulk.selectProduct', { name: product.name })}
                                className="mt-1 rounded border-zinc-300"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground leading-snug line-clamp-2">{product.name}</p>
                                <p className="mt-1 text-xs text-muted-foreground break-all">{product.id}</p>
                              </div>
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

                          <PolarisButton url={`/${locale}/dashboard/products/${product.id}`} fullWidth>
                            {t('card.edit')}
                          </PolarisButton>
                        </div>
                      </div>
                    ))}

                    <div className="hidden md:block overflow-x-auto">
                      <div className="min-w-[1320px]">
                        <IndexTable
                          selectable={false}
                          itemCount={filteredAndSortedProducts.length}
                          resourceName={{ singular: t('list.columns.product'), plural: t('title') }}
                          headings={[
                            { title: '' },
                            { title: t('list.columns.product') },
                            { title: t('list.columns.source') },
                            { title: t('list.columns.status') },
                            { title: t('list.columns.actions'), alignment: 'end' },
                          ]}
                        >
                          {filteredAndSortedProducts.map((product, index) => (
                            <IndexTable.Row id={product.id} key={product.id} position={index}>
                              <IndexTable.Cell>
                                <input
                                  type="checkbox"
                                  checked={selectedIdSet.has(product.id)}
                                  onChange={() => toggleProductSelection(product.id)}
                                  aria-label={t('bulk.selectProduct', { name: product.name })}
                                  className="rounded border-zinc-300"
                                />
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <div className="min-w-0 max-w-[320px]">
                                  <Link
                                    href={`/dashboard/products/${product.id}`}
                                    className="block font-semibold text-foreground hover:text-primary line-clamp-2 break-words"
                                  >
                                    {product.name}
                                  </Link>
                                  <p className="mt-1 text-xs text-muted-foreground truncate">{product.id}</p>
                                </div>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <div className="min-w-0 max-w-[440px]">
                                  <a
                                    href={product.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary hover:text-primary/80 line-clamp-1 inline-flex items-start gap-2"
                                  >
                                    <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span className="truncate max-w-[390px]">{product.url}</span>
                                  </a>
                                </div>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <div className="w-[280px]">
                                  {renderProductStatusCompact(product)}
                                </div>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <div className="flex items-center justify-end gap-2 min-w-[160px] whitespace-nowrap">
                                  <PolarisButton url={`/dashboard/products/${product.id}`}>
                                    {t('card.edit')}
                                  </PolarisButton>
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
                              </IndexTable.Cell>
                            </IndexTable.Row>
                          ))}
                        </IndexTable>
                      </div>
                    </div>

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
                        <PolarisButton onClick={() => setShowAddModal(false)}>
                          {t('addModal.cancel')}
                        </PolarisButton>
                        <PolarisButton variant="primary" onClick={handleAddProduct}>
                          {t('addModal.submit')}
                        </PolarisButton>
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
