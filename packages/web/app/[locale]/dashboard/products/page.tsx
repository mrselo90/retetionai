'use client';

import { useDeferredValue, useEffect, useState, useCallback } from 'react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { usePrompt } from '@/components/ui/PromptDialog';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Link } from '@/i18n/routing';
import { Search, Plus, Trash2, RefreshCw, Grid3X3, List, ExternalLink, AlertCircle, CheckCircle2, Package } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { SESSION_RECHECK_MS } from '@/lib/constants';
import { PageFeedbackCard } from '@/components/ui/PageFeedbackCard';

interface Product {
  id: string;
  name: string;
  url: string;
  external_id?: string;
  raw_text?: string;
  created_at: string;
  updated_at: string;
  knowledgeHealth?: {
    score: number;
    coverage: 'strong' | 'moderate' | 'weak';
    answerRisk: 'low' | 'medium' | 'high';
    missingReasonCodes: string[];
    metrics: {
      chunkCount: number;
      factFieldCount: number;
      hasEnrichedText: boolean;
      hasFacts: boolean;
      hasPreventionTips: boolean;
      hasRawText: boolean;
      usageInstructionLength: number;
    };
  } | null;
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

interface PageFeedbackState {
  tone: 'success' | 'critical' | 'info';
  title: string;
  message: string;
  actionLabel?: string;
  targetId?: string;
}

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
  const [scrapeStep, setScrapeStep] = useState(0);
  const [pageFeedback, setPageFeedback] = useState<PageFeedbackState | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const { confirm, ConfirmDialogNode } = useConfirm();
  const { prompt, PromptDialogNode } = usePrompt();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const knowledgeReasonLabel = (reasonCode: string | undefined) => {
    const mapping: Record<string, string> = {
      missing_scraped_content: t('knowledge.reasons.missingScrapedContent'),
      missing_enriched_content: t('knowledge.reasons.missingEnrichedContent'),
      missing_usage_instructions: t('knowledge.reasons.missingUsageInstructions'),
      thin_usage_instructions: t('knowledge.reasons.thinUsageInstructions'),
      missing_return_tips: t('knowledge.reasons.missingReturnTips'),
      missing_facts: t('knowledge.reasons.missingFacts'),
      missing_embeddings: t('knowledge.reasons.missingEmbeddings'),
    };
    if (!reasonCode) return t('knowledge.noGap');
    return mapping[reasonCode] || reasonCode;
  };

  const knowledgeToneBadge = (score: number | undefined): string => {
    if ((score || 0) >= 80) return 'd-badge-success';
    if ((score || 0) >= 55) return 'd-badge-attention';
    return 'd-badge-error';
  };

  const knowledgeCoverageLabel = (coverage: 'strong' | 'moderate' | 'weak') => {
    if (coverage === 'strong') return t('knowledge.coverage.strong');
    if (coverage === 'moderate') return t('knowledge.coverage.moderate');
    return t('knowledge.coverage.weak');
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortBy]);

  useEffect(() => {
    loadProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredAndSortedProducts.slice(startIndex, startIndex + itemsPerPage);

  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);

  const visibleProductIds = paginatedProducts.map((p) => p.id);
  const selectedIdSet = new Set(selectedProductIds);
  const selectedVisibleCount = visibleProductIds.filter((id) => selectedIdSet.has(id)).length;
  const allVisibleSelected = visibleProductIds.length > 0 && selectedVisibleCount === visibleProductIds.length;

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
    } catch (err: unknown) {
      console.error('Failed to load products:', err);
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.includes('Unauthorized') || errMsg.includes('401')) {
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
      setScrapeStep(1);
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

      setScrapeStep(2);
      setScrapeProgress(t('addModal.scraping.scraping'));

      await authenticatedRequest<{
        message: string;
        scraped: unknown;
      }>(
        `/api/products/${createResponse.product.id}/scrape`,
        session.access_token,
        { method: 'POST' }
      );

      setScrapeStep(3);
      setScrapeProgress(t('addModal.scraping.embeddings'));

      try {
        await authenticatedRequest(
          `/api/products/${createResponse.product.id}/generate-embeddings`,
          session.access_token,
          { method: 'POST' }
        );
      } catch (err: unknown) {
        console.error('Embedding generation failed:', err);
        toast.warning(
          t('toasts.embeddingWarning.title'),
          (err instanceof Error ? err.message : '') || t('toasts.embeddingWarning.message')
        );
      }

      setScrapeStep(4);
      setScrapeProgress(t('addModal.scraping.completed'));
      toast.success(t('toasts.addSuccess.title'), t('toasts.addSuccess.message'));
      setPageFeedback({
        tone: 'success',
        title: t('feedback.addedTitle'),
        message: t('feedback.addedMessage'),
        actionLabel: t('feedback.reviewCatalog'),
        targetId: 'products-catalog',
      });

      await loadProducts();

      setNewProductUrl('');
      setNewProductName('');
      setShowAddModal(false);
      setScraping(false);
      setScrapeProgress('');
      setScrapeStep(0);
    } catch (err: unknown) {
      console.error('Failed to add product:', err);
      const message = (err instanceof Error ? err.message : '') || t('toasts.addError.message');
      setPageFeedback({
        tone: 'critical',
        title: t('feedback.addErrorTitle'),
        message,
        actionLabel: t('feedback.reviewAddModal'),
      });
      toast.error(t('toasts.addError.title'), message);
      setScraping(false);
      setScrapeProgress('');
      setScrapeStep(0);
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
      setPageFeedback({
        tone: 'success',
        title: t('feedback.deletedTitle'),
        message: t('feedback.deletedMessage'),
        actionLabel: t('feedback.reviewCatalog'),
        targetId: 'products-catalog',
      });
      await loadProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
      setPageFeedback({
        tone: 'critical',
        title: t('feedback.deleteErrorTitle'),
        message: t('toasts.deleteError.message'),
        actionLabel: t('feedback.reviewCatalog'),
        targetId: 'products-catalog',
      });
      toast.error(t('toasts.deleteError.title'), t('toasts.deleteError.message'));
    }
  };

  // Returns left-border color style for grid cards based on knowledge health score
  const healthBorderStyle = (score: number | undefined): React.CSSProperties => {
    const s = score ?? 0;
    if (s >= 80) return { borderLeft: '4px solid #22c55e' };
    if (s >= 55) return { borderLeft: '4px solid #f59e0b' };
    return { borderLeft: '4px solid #ef4444' };
  };

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
        const response = await authenticatedRequest<{ summary?: { successful?: number; failed?: number } }>(
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
        const response = await authenticatedRequest<{ count?: number }>(
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
        setPageFeedback({
          tone: 'success',
          title: action === 'scrape' ? t('feedback.bulkScrapeTitle') : t('feedback.bulkEmbeddingsTitle'),
          message: t('bulk.successMessage', {
            success: successCount,
            failed: failCount,
          }),
          actionLabel: t('feedback.reviewCatalog'),
          targetId: 'products-catalog',
        });
        toast.success(
          action === 'scrape' ? t('bulk.scrapeSuccessTitle') : t('bulk.embeddingsSuccessTitle'),
          t(action === 'scrape' ? 'bulk.successMessage' : 'bulk.successMessage', {
            success: successCount,
            failed: failCount,
          })
        );
      } else {
        setPageFeedback({
          tone: 'critical',
          title: action === 'scrape' ? t('feedback.bulkScrapeErrorTitle') : t('feedback.bulkEmbeddingsErrorTitle'),
          message: t('bulk.allFailedMessage', { failed: failCount }),
          actionLabel: t('feedback.reviewCatalog'),
          targetId: 'products-catalog',
        });
        toast.error(
          action === 'scrape' ? t('bulk.scrapeErrorTitle') : t('bulk.embeddingsErrorTitle'),
          t('bulk.allFailedMessage', { failed: failCount })
        );
      }

      await loadProducts();
    } catch (err: unknown) {
      console.error(`Bulk ${action} request failed:`, err);
      setPageFeedback({
        tone: 'critical',
        title: action === 'scrape' ? t('feedback.bulkScrapeErrorTitle') : t('feedback.bulkEmbeddingsErrorTitle'),
        message: (err instanceof Error ? err.message : '') || t('bulk.requestFailedMessage'),
        actionLabel: t('feedback.reviewCatalog'),
        targetId: 'products-catalog',
      });
      toast.error(
        action === 'scrape' ? t('bulk.scrapeErrorTitle') : t('bulk.embeddingsErrorTitle'),
        (err instanceof Error ? err.message : '') || t('bulk.requestFailedMessage')
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

  const saveCurrentView = async () => {
    const name = await prompt({ title: t('savedViews.promptName'), confirmLabel: 'Save' });
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

  if (loading) {
    return (
      <div className="d-page">
        <div className="d-page-header">
          <div style={{ height: 26, width: 200, background: '#E8E6DF', borderRadius: 6, marginBottom: 8 }} />
          <div style={{ height: 16, width: 300, background: '#E8E6DF', borderRadius: 4 }} />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="d-card" style={{ marginBottom: 16, height: 120, background: '#F2F0E9', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  const scrapeProgressPct = scrapeStep === 1 ? 25 : scrapeStep === 2 ? 60 : scrapeStep === 3 ? 85 : scrapeStep === 4 ? 100 : 0;

  return (
    <>
      {ConfirmDialogNode}
      {PromptDialogNode}

      <div className="d-page">
        {/* Page header */}
        <div className="d-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="d-page-title">{t('title')}</h1>
            <p className="d-page-subtitle">{t('description')}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* View mode toggle */}
            <div style={{ display: 'flex', border: '1px solid #E8E6DF', borderRadius: 8, overflow: 'hidden' }}>
              <button
                className={`d-btn d-btn-sm ${viewMode === 'grid' ? 'd-btn-primary' : 'd-btn-ghost'}`}
                style={{ border: 'none', borderRadius: 0 }}
                onClick={() => handleViewModeChange('grid')}
                title={t('view.grid')}
              >
                <Grid3X3 size={14} />
              </button>
              <button
                className={`d-btn d-btn-sm ${viewMode === 'list' ? 'd-btn-primary' : 'd-btn-ghost'}`}
                style={{ border: 'none', borderRadius: 0 }}
                onClick={() => handleViewModeChange('list')}
                title={t('view.list')}
              >
                <List size={14} />
              </button>
            </div>
            <a href={`/${locale}/dashboard/products/shopify-map`} className="d-btn d-btn-outline">
              <RefreshCw size={14} /> {t('shopifyMapButton')}
            </a>
            <button className="d-btn d-btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={14} /> {t('addProductButton')}
            </button>
          </div>
        </div>

        {/* Page feedback */}
        {pageFeedback ? (
          <div style={{ marginBottom: 16 }}>
            <PageFeedbackCard
              tone={pageFeedback.tone}
              title={pageFeedback.title}
              message={pageFeedback.message}
              actionLabel={pageFeedback.actionLabel}
              onAction={
                pageFeedback.targetId
                  ? () => {
                      document
                        .getElementById(pageFeedback.targetId!)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  : undefined
              }
              dismissLabel={t('feedback.dismiss')}
              onDismiss={() => setPageFeedback(null)}
            />
          </div>
        ) : null}

        {/* Saved views + filters */}
        {products.length > 0 && (
          <div id="products-catalog" className="d-card" style={{ marginBottom: 16 }}>
            {/* Saved views tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 2 }}>
                <button
                  type="button"
                  onClick={() => applySavedView('all')}
                  className={`d-btn d-btn-sm ${activeSavedViewId === 'all' ? 'd-btn-primary' : 'd-btn-outline'}`}
                >
                  {t('savedViews.all')}
                </button>
                {savedViews.map((view) => (
                  <span key={view.id} style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #E8E6DF', borderRadius: 8, overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => applySavedView(view.id)}
                      className={`d-btn d-btn-sm ${activeSavedViewId === view.id ? 'd-btn-primary' : 'd-btn-ghost'}`}
                      style={{ borderRadius: 0, border: 'none' }}
                      title={view.name}
                    >
                      {view.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSavedView(view.id)}
                      style={{ padding: '0 6px', background: 'none', border: 'none', cursor: 'pointer', color: '#8E918C', display: 'flex', alignItems: 'center' }}
                      aria-label={t('savedViews.deleteAria', { name: view.name })}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <button type="button" className="d-btn d-btn-outline d-btn-sm" onClick={saveCurrentView}>
                {t('savedViews.saveCurrent')}
              </button>
            </div>

            {/* Search + filters */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <div className="d-search-wrap" style={{ flex: '1 1 200px', minWidth: 180 }}>
                <Search size={14} className="d-search-icon" />
                <input
                  className="d-input"
                  placeholder={t('filters.searchPlaceholder')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11.5, color: '#8E918C', display: 'block', marginBottom: 4 }}>{t('filters.status')}</label>
                <select className="d-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as ProductStatusFilter)}>
                  <option value="all">{t('filters.statusOptions.all')}</option>
                  <option value="rag_ready">{t('filters.statusOptions.ragReady')}</option>
                  <option value="rag_not_ready">{t('filters.statusOptions.ragNotReady')}</option>
                  <option value="rag_unknown">{t('filters.statusOptions.ragUnknown')}</option>
                  <option value="scraped">{t('filters.statusOptions.scraped')}</option>
                  <option value="not_scraped">{t('filters.statusOptions.notScraped')}</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11.5, color: '#8E918C', display: 'block', marginBottom: 4 }}>{t('filters.sort')}</label>
                <select className="d-select" value={sortBy} onChange={e => setSortBy(e.target.value as ProductSortOption)}>
                  <option value="updated_desc">{t('filters.sortOptions.updatedDesc')}</option>
                  <option value="updated_asc">{t('filters.sortOptions.updatedAsc')}</option>
                  <option value="name_asc">{t('filters.sortOptions.nameAsc')}</option>
                  <option value="name_desc">{t('filters.sortOptions.nameDesc')}</option>
                  <option value="chunks_desc">{t('filters.sortOptions.chunksDesc')}</option>
                  <option value="chunks_asc">{t('filters.sortOptions.chunksAsc')}</option>
                </select>
              </div>
            </div>

            {/* Results count + reset */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#5A5D58' }}>
              <span>{t('filters.resultsCount', { shown: filteredAndSortedProducts.length, total: products.length })}</span>
              {(searchQuery || statusFilter !== 'all' || sortBy !== 'updated_desc') && (
                <button
                  type="button"
                  className="d-btn d-btn-ghost d-btn-sm"
                  onClick={() => { setSearchQuery(''); setStatusFilter('all'); setSortBy('updated_desc'); setActiveSavedViewId('all'); }}
                >
                  {t('filters.reset')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bulk actions */}
        {products.length > 0 && (
          <div className="d-card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="d-btn d-btn-outline d-btn-sm"
                onClick={toggleSelectAllVisibleProducts}
                disabled={visibleProductIds.length === 0}
              >
                {allVisibleSelected ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                {allVisibleSelected ? t('bulk.unselectVisible') : t('bulk.selectVisible')}
              </button>
              <span style={{ fontSize: 13, color: '#5A5D58' }}>
                {t('bulk.selectedCount', { count: selectedProductIds.length, visible: selectedVisibleCount })}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="d-btn d-btn-outline d-btn-sm"
                disabled={selectedProductIds.length === 0 || bulkActionLoading !== null}
                onClick={clearSelectedProducts}
              >
                {t('bulk.clearSelection')}
              </button>
              <button
                type="button"
                className="d-btn d-btn-outline d-btn-sm"
                disabled={selectedProductIds.length === 0 || bulkActionLoading !== null}
                onClick={() => runBulkProductAction('scrape')}
              >
                {bulkActionLoading === 'scrape' ? t('bulk.scraping') : t('bulk.rescrape')}
              </button>
              <button
                type="button"
                className="d-btn d-btn-primary d-btn-sm"
                disabled={selectedProductIds.length === 0 || bulkActionLoading !== null}
                onClick={() => runBulkProductAction('embeddings')}
              >
                {bulkActionLoading === 'embeddings' ? t('bulk.generatingEmbeddings') : t('bulk.generateEmbeddings')}
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {products.length === 0 && !loading ? (
          <div className="d-card">
            <div className="d-empty">
              <div className="d-empty-icon"><Package size={18} /></div>
              <p className="d-empty-title">{t('empty.title')}</p>
              <p className="d-empty-desc">{t('empty.description')}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="d-btn d-btn-primary" onClick={() => setShowAddModal(true)}>{t('empty.button')}</button>
                <button className="d-btn d-btn-outline" onClick={() => { setLoading(true); loadProducts(); }}>{t('empty.refresh')}</button>
              </div>
            </div>
          </div>
        ) : filteredAndSortedProducts.length === 0 ? (
          <div className="d-card">
            <div className="d-empty">
              <div className="d-empty-icon"><Search size={18} /></div>
              <p className="d-empty-title">{t('filters.noMatches')}</p>
              <p className="d-empty-desc">{`No products found matching "${searchQuery}"`}</p>
              <button className="d-btn d-btn-outline" onClick={() => setSearchQuery('')}>{t('bulk.clearSelection') || 'Clear search'}</button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {paginatedProducts.map((product) => (
                <div
                  key={product.id}
                  style={{ background: '#fff', border: '1px solid #E8E6DF', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', ...healthBorderStyle(product.knowledgeHealth?.score) }}
                >
                  <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', flex: 1, gap: 12 }}>
                    {/* Top row: score badge + delete */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        {product.knowledgeHealth && (
                          <span className={`d-badge ${knowledgeToneBadge(product.knowledgeHealth.score)}`}>
                            {t('knowledge.scoreBadge', { score: product.knowledgeHealth.score })}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="d-btn d-btn-danger d-btn-sm"
                        style={{ padding: '0 8px' }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm({ title: t('card.deleteConfirm'), message: '', destructive: true, confirmLabel: 'Delete', cancelLabel: 'Cancel' });
                          if (ok) handleDeleteProduct(product.id);
                        }}
                        aria-label={t('card.deleteConfirm')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Name + checkbox */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={t('bulk.selectProduct', { name: product.name })}
                        style={{ marginTop: 3, flexShrink: 0 }}
                      />
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0A0B0A', wordBreak: 'break-word' }}>{product.name}</p>
                    </div>

                    {/* URL */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ExternalLink size={12} style={{ color: '#8E918C', flexShrink: 0 }} />
                      <a
                        href={product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12.5, color: '#2A6647', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}
                      >
                        {product.url}
                      </a>
                    </div>

                    {/* Status badges */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {product.raw_text && <span className="d-badge d-badge-success">{t('card.scraped')}</span>}
                      <span className="d-badge d-badge-neutral">
                        {product.chunkCountUnavailable ? t('card.chunksUnknown') : `${product.chunkCount || 0} ${t('card.chunks')}`}
                      </span>
                    </div>

                    {/* Knowledge hint */}
                    {product.knowledgeHealth && (
                      <p style={{ margin: 0, fontSize: 12, color: '#8E918C', flex: 1 }}>
                        {t('knowledge.cardHint', {
                          coverage: knowledgeCoverageLabel(product.knowledgeHealth.coverage),
                          gap: knowledgeReasonLabel(product.knowledgeHealth.missingReasonCodes[0]),
                        })}
                      </p>
                    )}

                    {/* Edit button */}
                    <a
                      href={`/${locale}/dashboard/products/${product.id}`}
                      className="d-btn d-btn-outline"
                      style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
                    >
                      {t('card.edit')}
                    </a>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#5A5D58' }}>
                  {t('list.pagination.showing', {
                    from: (currentPage - 1) * itemsPerPage + 1,
                    to: Math.min(currentPage * itemsPerPage, filteredAndSortedProducts.length),
                    total: filteredAndSortedProducts.length,
                  })}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="d-btn d-btn-outline d-btn-sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} style={{ opacity: currentPage <= 1 ? 0.4 : 1 }}>
                    {t('list.pagination.page', { current: currentPage, total: totalPages })} &larr;
                  </button>
                  <button className="d-btn d-btn-outline d-btn-sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ opacity: currentPage >= totalPages ? 0.4 : 1 }}>
                    &rarr;
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="d-table-wrap">
              <table className="d-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}></th>
                    <th>{t('list.columns.product')}</th>
                    <th>{t('list.columns.source')}</th>
                    <th>{t('list.columns.status')}</th>
                    <th style={{ textAlign: 'right' }}>{t('list.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIdSet.has(product.id)}
                          onChange={() => toggleProductSelection(product.id)}
                          aria-label={t('bulk.selectProduct', { name: product.name })}
                        />
                      </td>
                      <td>
                        <div style={{ maxWidth: 300 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {product.knowledgeHealth && (
                              <span className={`d-badge ${knowledgeToneBadge(product.knowledgeHealth.score)}`}>
                                {t('knowledge.scoreBadge', { score: product.knowledgeHealth.score })}
                              </span>
                            )}
                            <Link
                              href={`/dashboard/products/${product.id}` as Parameters<typeof Link>[0]['href']}
                              style={{ fontWeight: 600, color: '#0A0B0A', textDecoration: 'none', wordBreak: 'break-word' }}
                            >
                              {product.name}
                            </Link>
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#8E918C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.id}</p>
                        </div>
                      </td>
                      <td>
                        <div style={{ maxWidth: 340 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ExternalLink size={12} style={{ color: '#8E918C', flexShrink: 0 }} />
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 12.5, color: '#2A6647', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}
                            >
                              {product.url}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                          {product.knowledgeHealth && (
                            <span className={`d-badge ${knowledgeToneBadge(product.knowledgeHealth.score)}`}>
                              {t('knowledge.scoreBadge', { score: product.knowledgeHealth.score })}
                            </span>
                          )}
                          <span className="d-badge d-badge-neutral">
                            {product.chunkCountUnavailable ? t('card.chunksUnknown') : `${product.chunkCount || 0} ${t('card.chunks')}`}
                          </span>
                          {product.raw_text && <span className="d-badge d-badge-success">{t('card.scraped')}</span>}
                        </div>
                        {product.knowledgeHealth && (
                          <p style={{ margin: 0, fontSize: 11.5, color: '#8E918C' }}>
                            {t('knowledge.tableHint', {
                              gap: knowledgeReasonLabel(product.knowledgeHealth.missingReasonCodes[0]),
                            })}
                          </p>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <a href={`/dashboard/products/${product.id}`} className="d-btn d-btn-outline d-btn-sm">{t('card.edit')}</a>
                          <button
                            type="button"
                            className="d-btn d-btn-danger d-btn-sm"
                            onClick={async () => {
                              const ok = await confirm({ title: t('card.deleteConfirm'), message: '', destructive: true, confirmLabel: 'Delete', cancelLabel: 'Cancel' });
                              if (ok) handleDeleteProduct(product.id);
                            }}
                            aria-label={t('card.deleteConfirm')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#5A5D58' }}>
                  {t('list.pagination.showing', {
                    from: (currentPage - 1) * itemsPerPage + 1,
                    to: Math.min(currentPage * itemsPerPage, filteredAndSortedProducts.length),
                    total: filteredAndSortedProducts.length,
                  })}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="d-btn d-btn-outline d-btn-sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} style={{ opacity: currentPage <= 1 ? 0.4 : 1 }}>
                    &larr; Prev
                  </button>
                  <button className="d-btn d-btn-outline d-btn-sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ opacity: currentPage >= totalPages ? 0.4 : 1 }}>
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Add Product Modal */}
        {showAddModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div className="d-card" style={{ width: '100%', maxWidth: 480 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <p className="d-card-title" style={{ fontSize: 16 }}>{t('addModal.title')}</p>
                {!scraping && (
                  <button type="button" className="d-btn d-btn-ghost d-btn-sm" onClick={() => setShowAddModal(false)}>
                    &times;
                  </button>
                )}
              </div>

              {scraping ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ width: 36, height: 36, border: '3px solid #E8E6DF', borderTopColor: '#0A0B0A', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#0A0B0A' }}>{scrapeProgress}</p>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#5A5D58' }}>{t('addModal.scraping.wait')}</p>
                  <div className="d-progress-bar" style={{ maxWidth: 320, margin: '0 auto' }}>
                    <div className="d-progress-bar-fill" style={{ width: `${scrapeProgressPct}%` }} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0A0B0A', marginBottom: 6 }}>{t('addModal.nameLabel')}</label>
                    <input
                      className="d-input"
                      placeholder={t('addModal.namePlaceholder')}
                      value={newProductName}
                      onChange={e => setNewProductName(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0A0B0A', marginBottom: 6 }}>{t('addModal.urlLabel')}</label>
                    <input
                      className="d-input"
                      type="url"
                      placeholder={t('addModal.urlPlaceholder')}
                      value={newProductUrl}
                      onChange={e => setNewProductUrl(e.target.value)}
                      autoComplete="off"
                    />
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#8E918C' }}>{t('addModal.urlHelper')}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button type="button" className="d-btn d-btn-outline" onClick={() => setShowAddModal(false)}>{t('addModal.cancel')}</button>
                    <button
                      type="button"
                      className="d-btn d-btn-primary"
                      onClick={handleAddProduct}
                      disabled={!newProductName || !newProductUrl}
                      style={{ opacity: (!newProductName || !newProductUrl) ? 0.5 : 1 }}
                    >
                      {t('addModal.submit')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
