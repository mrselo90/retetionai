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
  EmptyState,
  Button as PolarisButton,
  Pagination,
  TextField,
  Badge as PolarisBadge,
  Icon,
  InlineStack,
  BlockStack,
  Box,
  Modal,
  ProgressBar,
  Spinner,
} from '@shopify/polaris';
import {
  PlusIcon,
  DeleteIcon,
  ExternalIcon,
  NoteIcon,
  CheckCircleIcon,
  LayoutGridIcon,
  ListIcon,
  SearchIcon,
  RefreshIcon,
  AlertBubbleIcon,
} from '@shopify/polaris-icons';
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
  const [pageFeedback, setPageFeedback] = useState<PageFeedbackState | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

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

  const knowledgeTone = (score: number | undefined): Parameters<typeof PolarisBadge>[0]['tone'] => {
    if ((score || 0) >= 80) return 'success';
    if ((score || 0) >= 55) return 'attention';
    return 'critical';
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
        scraped: unknown;
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
      } catch (err: unknown) {
        console.error('Embedding generation failed:', err);
        toast.warning(
          t('toasts.embeddingWarning.title'),
          (err instanceof Error ? err.message : '') || t('toasts.embeddingWarning.message')
        );
      }

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

  const renderProductStatusBadges = (product: ProductWithChunks) => (
    <InlineStack gap="200" wrap>
      {product.knowledgeHealth && (
        <PolarisBadge tone={knowledgeTone(product.knowledgeHealth.score)}>
          {t('knowledge.scoreBadge', { score: product.knowledgeHealth.score })}
        </PolarisBadge>
      )}
      <PolarisBadge>
        <InlineStack gap="100" blockAlign="center">
          <Icon source={NoteIcon} tone="subdued" />
          <Text as="span" variant="bodySm">
            {product.chunkCountUnavailable ? t('card.chunksUnknown') : `${product.chunkCount || 0} ${t('card.chunks')}`}
          </Text>
        </InlineStack>
      </PolarisBadge>
      {product.raw_text && (
        <PolarisBadge tone="success">
          <InlineStack gap="100" blockAlign="center">
            <Icon source={CheckCircleIcon} tone="success" />
            <Text as="span" variant="bodySm">{t('card.scraped')}</Text>
          </InlineStack>
        </PolarisBadge>
      )}
      {product.raw_text && !product.chunkCountUnavailable && (product.chunkCount || 0) > 0 && (
        <PolarisBadge tone="success">
          <InlineStack gap="100" blockAlign="center">
            <Icon source={CheckCircleIcon} tone="success" />
            <Text as="span" variant="bodySm">{t('card.ragReady')}</Text>
          </InlineStack>
        </PolarisBadge>
      )}
    </InlineStack>
  );

  const renderProductStatusCompact = (product: ProductWithChunks) => {
    const hasRaw = Boolean(product.raw_text);
    const ragReady = hasRaw && !product.chunkCountUnavailable && (product.chunkCount || 0) > 0;
    const ragUnknown = hasRaw && product.chunkCountUnavailable;
    const ragNotReady = hasRaw && !product.chunkCountUnavailable && (product.chunkCount || 0) === 0;

    return (
      <BlockStack gap="150">
        <InlineStack gap="200" wrap>
          {product.knowledgeHealth && (
            <PolarisBadge tone={knowledgeTone(product.knowledgeHealth.score)}>
              {t('knowledge.scoreBadge', { score: product.knowledgeHealth.score })}
            </PolarisBadge>
          )}
          <PolarisBadge>
            {product.chunkCountUnavailable ? t('card.chunksUnknown') : `${product.chunkCount || 0} ${t('card.chunks')}`}
          </PolarisBadge>
          {hasRaw && (
            <PolarisBadge tone="success">
              {t('card.scraped')}
            </PolarisBadge>
          )}
        </InlineStack>
        <InlineStack gap="200" wrap>
          {ragReady && (
            <PolarisBadge tone="success">
              {t('card.ragReady')}
            </PolarisBadge>
          )}
          {ragUnknown && (
            <PolarisBadge>
              {t('card.ragStatusUnknown')}
            </PolarisBadge>
          )}
          {ragNotReady && (
            <PolarisBadge>
              {t('card.ragNotReady')}
            </PolarisBadge>
          )}
          {!hasRaw && (
            <Text as="span" variant="bodySm" tone="subdued">
              {t('filters.statusOptions.notScraped')}
            </Text>
          )}
        </InlineStack>
      </BlockStack>
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

  return (
    <Page title={t('title')} subtitle={t('description')} fullWidth>
      <Layout>
        <Layout.Section>
          <div className="space-y-6 animate-fade-in pb-8">
            {pageFeedback ? (
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
            ) : null}
            {/* Header */}
            <PolarisCard>
              <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1.5">
                  <Text as="h2" variant="headingMd">{t('title')}</Text>
                  <Text as="p" tone="subdued">{t('description')}</Text>
                </div>
                <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-none xl:auto-cols-max xl:grid-flow-col xl:items-center">
                  <PolarisButtonGroup variant="segmented">
                    <PolarisButton
                      onClick={() => handleViewModeChange('grid')}
                      icon={LayoutGridIcon}
                      pressed={viewMode === 'grid'}
                    >
                      <span className="hidden sm:inline">{t('view.grid')}</span>
                    </PolarisButton>
                    <PolarisButton
                      onClick={() => handleViewModeChange('list')}
                      icon={ListIcon}
                      pressed={viewMode === 'list'}
                    >
                      <span className="hidden md:inline">{t('view.list')}</span>
                    </PolarisButton>
                  </PolarisButtonGroup>
                  <PolarisButton url={`/${locale}/dashboard/products/shopify-map`} icon={RefreshIcon}>
                    {t('shopifyMapButton')}
                  </PolarisButton>
                  <PolarisButton variant="primary" onClick={() => setShowAddModal(true)} icon={PlusIcon}>
                    {t('addProductButton')}
                  </PolarisButton>
                </div>
              </div>
            </PolarisCard>

            {products.length > 0 && (
              <div id="products-catalog">
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
                        <TextField
                          label={t('filters.searchLabel')}
                          value={searchQuery}
                          onChange={(value) => setSearchQuery(value)}
                          placeholder={t('filters.searchPlaceholder')}
                          autoComplete="off"
                          prefix={<Icon source={SearchIcon} tone="subdued" />}
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
              </div>
            )}

            {products.length > 0 && (
              <PolarisCard>
                <div className="p-4 sm:p-5 grid gap-3 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center">
                  <InlineStack gap="300" blockAlign="center">
                    <PolarisButton
                      onClick={toggleSelectAllVisibleProducts}
                      disabled={visibleProductIds.length === 0}
                      icon={allVisibleSelected ? CheckCircleIcon : CircleIcon}
                    >
                      {allVisibleSelected ? t('bulk.unselectVisible') : t('bulk.selectVisible')}
                    </PolarisButton>
                    <Text as="p" tone="subdued">
                      {t('bulk.selectedCount', { count: selectedProductIds.length, visible: selectedVisibleCount })}
                    </Text>
                  </InlineStack>

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
                  <EmptyState
                    heading={t('filters.noMatches')}
                    action={{
                      content: t('bulk.clearSelection') || 'Clear search',
                      onAction: () => setSearchQuery(''),
                    }}
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>{`No products found matching "${searchQuery}"`}</p>
                  </EmptyState>
                </PolarisCard>
              ) : viewMode === 'grid' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {paginatedProducts.map((product) => (
                      <PolarisCard key={product.id}>
                        <div className="p-4 sm:p-5 flex flex-col h-full space-y-4">
                          <InlineStack align="space-between" blockAlign="start">
                            <InlineStack gap="200" blockAlign="start">
                              <Box paddingBlockStart="100">
                                <input
                                  type="checkbox"
                                  checked={selectedIdSet.has(product.id)}
                                  onChange={() => toggleProductSelection(product.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={t('bulk.selectProduct', { name: product.name })}
                                  className="rounded border-zinc-300"
                                />
                              </Box>
                              <div className="min-w-0">
                                <Text as="h3" variant="headingMd" breakWord>{product.name}</Text>
                              </div>
                            </InlineStack>
                            <PolarisButton
                              icon={DeleteIcon}
                              tone="critical"
                              variant="tertiary"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm(t('card.deleteConfirm'))) {
                                  handleDeleteProduct(product.id);
                                }
                              }}
                              accessibilityLabel={t('card.deleteConfirm')}
                            />
                          </InlineStack>
                          <div className="space-y-4 flex flex-col flex-1">
                            <InlineStack gap="100" blockAlign="center">
                              <Icon source={ExternalIcon} tone="primary" />
                              <a
                                href={product.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:text-primary/80 truncate max-w-[240px] font-medium"
                              >
                                {product.url}
                              </a>
                            </InlineStack>

                            <div className="mb-auto">
                              {renderProductStatusBadges(product)}
                              {product.knowledgeHealth && (
                                <Box paddingBlockStart="300">
                                  <Text as="p" variant="bodySm" tone="subdued">
                                    {t('knowledge.cardHint', {
                                      coverage: knowledgeCoverageLabel(product.knowledgeHealth.coverage),
                                      gap: knowledgeReasonLabel(product.knowledgeHealth.missingReasonCodes[0]),
                                    })}
                                  </Text>
                                </Box>
                              )}
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
                  {totalPages > 1 && (
                    <div className="mt-6 border-t border-subdued pt-4 flex flex-col items-center gap-2">
                      <Text as="p" variant="bodySm" tone="subdued">
                        {t('list.pagination.showing', {
                          from: (currentPage - 1) * itemsPerPage + 1,
                          to: Math.min(currentPage * itemsPerPage, filteredAndSortedProducts.length),
                          total: filteredAndSortedProducts.length,
                        })}
                      </Text>
                      <Pagination
                        hasPrevious={currentPage > 1}
                        onPrevious={() => setCurrentPage((prev) => prev - 1)}
                        hasNext={currentPage < totalPages}
                        onNext={() => setCurrentPage((prev) => prev + 1)}
                        label={t('list.pagination.page', { current: currentPage, total: totalPages })}
                      />
                    </div>
                  )}
                </>
              ) : (
                <PolarisCard>
                  <div className="divide-y divide-border">
                    {paginatedProducts.map((product) => (
                      <div key={`mobile-${product.id}`} className="px-4 sm:px-5 py-4 md:hidden">
                        <BlockStack gap="300">
                          <InlineStack align="space-between" blockAlign="start">
                            <InlineStack gap="200" blockAlign="start">
                              <Box paddingBlockStart="100">
                                <input
                                  type="checkbox"
                                  checked={selectedIdSet.has(product.id)}
                                  onChange={() => toggleProductSelection(product.id)}
                                  aria-label={t('bulk.selectProduct', { name: product.name })}
                                  className="rounded border-zinc-300"
                                />
                              </Box>
                              <div className="min-w-0">
                                <Text as="p" fontWeight="semibold" breakWord>{product.name}</Text>
                                <Text as="p" variant="bodyXs" tone="subdued" breakWord>{product.id}</Text>
                              </div>
                            </InlineStack>
                            <PolarisButton
                              icon={DeleteIcon}
                              tone="critical"
                              variant="tertiary"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm(t('card.deleteConfirm'))) handleDeleteProduct(product.id);
                              }}
                              accessibilityLabel={t('card.deleteConfirm')}
                            />
                          </InlineStack>

                          <InlineStack gap="100" blockAlign="center">
                            <Icon source={ExternalIcon} tone="primary" />
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:text-primary/80 truncate font-medium"
                            >
                              {product.url}
                            </a>
                          </InlineStack>

                          {renderProductStatusBadges(product)}
                          {product.knowledgeHealth && (
                            <Text as="p" variant="bodySm" tone="subdued">
                              {t('knowledge.cardHint', {
                                coverage: knowledgeCoverageLabel(product.knowledgeHealth.coverage),
                                gap: knowledgeReasonLabel(product.knowledgeHealth.missingReasonCodes[0]),
                              })}
                            </Text>
                          )}

                          <PolarisButton url={`/${locale}/dashboard/products/${product.id}`} fullWidth>
                            {t('card.edit')}
                          </PolarisButton>
                        </BlockStack>
                      </div>
                    ))}

                    <div className="hidden md:block overflow-x-auto">
                      <div className="min-w-[1320px]">
                        <IndexTable
                          selectable={false}
                          itemCount={paginatedProducts.length}
                          resourceName={{ singular: t('list.columns.product'), plural: t('title') }}
                          headings={[
                            { title: '' },
                            { title: t('list.columns.product') },
                            { title: t('list.columns.source') },
                            { title: t('list.columns.status') },
                            { title: t('list.columns.actions'), alignment: 'end' },
                          ]}
                        >
                          {paginatedProducts.map((product, index) => (
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
                                    className="block font-semibold text-foreground hover:text-primary break-words"
                                  >
                                    {product.name}
                                  </Link>
                                  <Text as="p" variant="bodyXs" tone="subdued" truncate>{product.id}</Text>
                                </div>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <div className="min-w-0 max-w-[440px]">
                                  <InlineStack gap="100" blockAlign="center">
                                    <Icon source={ExternalIcon} tone="subdued" />
                                    <a
                                      href={product.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary hover:text-primary/80 truncate max-w-[390px]"
                                    >
                                      {product.url}
                                    </a>
                                  </InlineStack>
                                </div>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <div className="w-[280px]">
                                  {renderProductStatusCompact(product)}
                                  {product.knowledgeHealth && (
                                    <Box paddingBlockStart="200">
                                      <Text as="p" variant="bodyXs" tone="subdued">
                                        {t('knowledge.tableHint', {
                                          gap: knowledgeReasonLabel(product.knowledgeHealth.missingReasonCodes[0]),
                                        })}
                                      </Text>
                                    </Box>
                                  )}
                                </div>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <InlineStack align="end" gap="200">
                                  <PolarisButton url={`/dashboard/products/${product.id}`}>
                                    {t('card.edit')}
                                  </PolarisButton>
                                  <PolarisButton
                                    icon={DeleteIcon}
                                    tone="critical"
                                    variant="tertiary"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (confirm(t('card.deleteConfirm'))) handleDeleteProduct(product.id);
                                    }}
                                    accessibilityLabel={t('card.deleteConfirm')}
                                  />
                                </InlineStack>
                              </IndexTable.Cell>
                            </IndexTable.Row>
                          ))}
                        </IndexTable>
                      </div>
                    </div>

                    {totalPages > 1 && (
                      <div className="py-4 border-t border-subdued flex flex-col items-center gap-2 bg-zinc-50/50 rounded-b-xl">
                        <Text as="p" variant="bodySm" tone="subdued">
                          {t('list.pagination.showing', {
                            from: (currentPage - 1) * itemsPerPage + 1,
                            to: Math.min(currentPage * itemsPerPage, filteredAndSortedProducts.length),
                            total: filteredAndSortedProducts.length,
                          })}
                        </Text>
                        <Pagination
                          hasPrevious={currentPage > 1}
                          onPrevious={() => setCurrentPage((prev) => prev - 1)}
                          hasNext={currentPage < totalPages}
                          onNext={() => setCurrentPage((prev) => prev + 1)}
                          label={t('list.pagination.page', { current: currentPage, total: totalPages })}
                        />
                      </div>
                    )}
                  </div>
                </PolarisCard>
              )
            )}

            {/* Add Product Modal */}
            <Modal
              open={showAddModal}
              onClose={() => { if (!scraping) setShowAddModal(false); }}
              title={t('addModal.title')}
              primaryAction={{
                content: t('addModal.submit'),
                onAction: handleAddProduct,
                loading: scraping,
                disabled: scraping || !newProductName || !newProductUrl,
              }}
              secondaryActions={[
                {
                  content: t('addModal.cancel'),
                  onAction: () => setShowAddModal(false),
                  disabled: scraping,
                },
              ]}
            >
              <Modal.Section>
                {scraping ? (
                  <Box padding="1000">
                    <BlockStack gap="500" inlineAlign="center">
                      <Spinner size="large" />
                      <Text as="p" variant="headingLg">{scrapeProgress}</Text>
                      <Text as="p" tone="subdued">{t('addModal.scraping.wait')}</Text>
                      <div className="w-full max-w-[320px]">
                        <ProgressBar progress={60} animated />
                      </div>
                    </BlockStack>
                  </Box>
                ) : (
                  <BlockStack gap="400">
                    <TextField
                      label={t('addModal.nameLabel')}
                      value={newProductName}
                      onChange={(value) => setNewProductName(value)}
                      placeholder={t('addModal.namePlaceholder')}
                      autoComplete="off"
                    />
                    <TextField
                      label={t('addModal.urlLabel')}
                      value={newProductUrl}
                      onChange={(value) => setNewProductUrl(value)}
                      placeholder={t('addModal.urlPlaceholder')}
                      autoComplete="off"
                      helpText={t('addModal.urlHelper')}
                      type="url"
                    />
                  </BlockStack>
                )}
              </Modal.Section>
            </Modal>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
