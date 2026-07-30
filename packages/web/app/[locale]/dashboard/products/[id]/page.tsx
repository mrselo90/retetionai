'use client';

import { useEffect, useId, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useTranslations } from 'next-intl';
import { PageFeedbackCard } from '@/components/ui/PageFeedbackCard';
import { Badge, EmptyState } from '@/components/recete';
import type { BadgeTone } from '@/components/recete';
import { Link } from '@/i18n/routing';
import { AlertTriangle } from 'lucide-react';

interface ProductInstruction {
  usage_instructions: string;
  recipe_summary?: string;
  video_url?: string;
  prevention_tips?: string;
}

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

interface PageFeedbackState {
  tone: 'success' | 'critical' | 'info';
  title: string;
  message: string;
  actionLabel?: string;
  targetId?: string;
}

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function healthTone(score: number): BadgeTone {
  if (score >= 80) return 'success';
  if (score >= 55) return 'caution';
  return 'danger';
}

export default function ProductDetailPage() {
  const t = useTranslations('ProductDetail');
  const rp = useTranslations('ReturnPrevention');
  const params = useParams();
  const router = useRouter();
  const fieldPrefix = useId();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rescraping, setRescraping] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedUrl, setEditedUrl] = useState('');
  const [editedRawText, setEditedRawText] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [preventionTips, setPreventionTips] = useState('');
  const [usageInstructions, setUsageInstructions] = useState('');
  const [recipeSummary, setRecipeSummary] = useState('');
  const [pageFeedback, setPageFeedback] = useState<PageFeedbackState | null>(null);

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

  const coverageLabel = (coverage: 'strong' | 'moderate' | 'weak') => {
    if (coverage === 'strong') return t('knowledge.coverage.strong');
    if (coverage === 'moderate') return t('knowledge.coverage.moderate');
    return t('knowledge.coverage.weak');
  };

  const riskLabel = (risk: 'low' | 'medium' | 'high') => {
    if (risk === 'low') return t('knowledge.risk.low');
    if (risk === 'medium') return t('knowledge.risk.medium');
    return t('knowledge.risk.high');
  };

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  const loadProduct = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const response = await authenticatedRequest<{ product: Product }>(
        `/api/products/${productId}`,
        session.access_token
      );

      setProduct(response.product);
      setEditedName(response.product.name);
      setEditedUrl(response.product.url);
      setEditedRawText(response.product.raw_text || '');

      try {
        const instrResponse = await authenticatedRequest<{
          instruction: ProductInstruction | null;
        }>(`/api/products/${productId}/instruction`, session.access_token);
        if (instrResponse.instruction) {
          setUsageInstructions(instrResponse.instruction.usage_instructions || '');
          setRecipeSummary(instrResponse.instruction.recipe_summary || '');
          setVideoUrl(instrResponse.instruction.video_url || '');
          setPreventionTips(instrResponse.instruction.prevention_tips || '');
        }
      } catch {
        /* instruction may not exist yet */
      }
    } catch (err) {
      console.error('Failed to load product:', err);
      toast.error(t('toasts.loadError.title'), t('toasts.loadError.message'));
      router.push('/dashboard/products');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!product) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      setSaving(true);

      await authenticatedRequest<{ product: Product }>(
        `/api/products/${productId}`,
        session.access_token,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: editedName,
            url: editedUrl,
            raw_text: editedRawText,
          }),
        }
      );

      // Always send the instruction PUT — it used to be skipped whenever
      // usage_instructions was empty, which meant a merchant could never clear
      // instructions (loadProduct just repopulated the old text under a green
      // "Saved" card) and could not save recipe_summary / video_url /
      // prevention_tips at all without also writing usage instructions.
      // The API upserts with `?? null`, so clearing works once the request is sent.
      //
      // The error is no longer swallowed either. These instructions are what the
      // AI answers customers with, so a failed save must not be reported as
      // success — that was the worst case in this file.
      await authenticatedRequest(`/api/products/${productId}/instruction`, session.access_token, {
        method: 'PUT',
        body: JSON.stringify({
          usage_instructions: usageInstructions,
          recipe_summary: recipeSummary || undefined,
          video_url: videoUrl || undefined,
          prevention_tips: preventionTips || undefined,
        }),
      });

      await loadProduct();
      toast.success(t('toasts.saved.title'), t('toasts.saved.message'));
      setPageFeedback({
        tone: 'success',
        title: t('feedback.savedTitle'),
        message: t('feedback.savedMessage', { time: formatSavedAt(new Date().toISOString()) }),
        actionLabel: t('feedback.reviewInstructions'),
        targetId: 'product-bot-instructions',
      });
    } catch (err: unknown) {
      console.error('Failed to save product:', err);
      const message = (err instanceof Error ? err.message : '') || t('toasts.saveError.message');
      setPageFeedback({
        tone: 'critical',
        title: t('feedback.saveErrorTitle'),
        message,
        actionLabel: t('feedback.reviewInstructions'),
        targetId: 'product-bot-instructions',
      });
      toast.error(t('toasts.saveError.title'), message);
    } finally {
      setSaving(false);
    }
  };

  const handleRescrape = async () => {
    if (!product) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      setRescraping(true);

      const scrapeResponse = await authenticatedRequest<{
        message: string;
        scraped: { rawContent?: string } | null;
      }>(`/api/products/${productId}/scrape`, session.access_token, {
        method: 'POST',
      });

      // Update local state with scraped content
      if (scrapeResponse.scraped?.rawContent) {
        setEditedRawText(scrapeResponse.scraped.rawContent);
      }

      // Regenerate embeddings
      try {
        await authenticatedRequest(
          `/api/products/${productId}/generate-embeddings`,
          session.access_token,
          {
            method: 'POST',
          }
        );
      } catch (err: unknown) {
        console.error('Embedding generation failed:', err);
        toast.warning(
          t('toasts.embeddingWarning.title'),
          (err instanceof Error ? err.message : '') || t('toasts.embeddingWarning.message')
        );
      }

      await loadProduct();
      toast.success(t('toasts.rescanSuccess.title'), t('toasts.rescanSuccess.message'));
      setPageFeedback({
        tone: 'success',
        title: t('feedback.rescanSavedTitle'),
        message: t('feedback.rescanSavedMessage'),
        actionLabel: t('feedback.reviewScrapedContent'),
        targetId: 'product-scraped-content',
      });
    } catch (err: unknown) {
      console.error('Failed to rescrape product:', err);
      const message = (err instanceof Error ? err.message : '') || t('toasts.rescanError.message');
      setPageFeedback({
        tone: 'critical',
        title: t('feedback.rescanErrorTitle'),
        message,
        actionLabel: t('feedback.reviewScrapedContent'),
        targetId: 'product-scraped-content',
      });
      toast.error(t('toasts.rescanError.title'), message);
    } finally {
      setRescraping(false);
    }
  };

  if (loading) {
    return (
      <div className="d-page">
        <div
          className="d-page-header"
          role="status"
          aria-live="polite"
          aria-label={t('editProduct')}
        >
          <div className="r-skeleton" style={{ height: 26, width: 200, marginBottom: 8 }} />
          <div className="r-skeleton" style={{ height: 16, width: 300 }} />
        </div>
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="r-skeleton"
            style={{ height: 120, marginBottom: 16 }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="d-page">
        <div className="r-card">
          <EmptyState
            title={t('notFound')}
            action={
              <button
                className="r-btn r-btn-primary"
                onClick={() => router.push('/dashboard/products')}
              >
                {t('backToProducts')}
              </button>
            }
          />
        </div>
      </div>
    );
  }

  // Determine RAG quality status for the alert
  const hasGoodInstructions = usageInstructions.trim().length >= 50;
  const hasAnyInstructions = usageInstructions.trim().length > 0;
  const knowledgeHealth = product.knowledgeHealth;

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
        <div>
          <Link
            href="/dashboard/products"
            className="r-btn r-btn-ghost r-btn-sm"
            style={{ marginBottom: 10 }}
          >
            ← {t('backToProducts')}
          </Link>
          <h1 className="r-page-title">{t('editProduct')}</h1>
          <p className="r-page-sub">{t('editDescription')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="r-btn r-btn-secondary"
            onClick={handleRescrape}
            disabled={rescraping}
            aria-busy={rescraping || undefined}
          >
            {rescraping ? t('rescraping') : t('rescrape')}
          </button>
          <button
            className="r-btn r-btn-primary"
            onClick={handleSave}
            disabled={saving}
            aria-busy={saving || undefined}
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {knowledgeHealth ? (
          <div className="r-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 16,
              }}
            >
              <div>
                <p className="r-card-title">{t('knowledge.title')}</p>
                <p className="r-hint" style={{ marginTop: 2 }}>
                  {t('knowledge.subtitle')}
                </p>
              </div>
              <Badge tone={healthTone(knowledgeHealth.score)}>
                {t('knowledge.scoreBadge', { score: knowledgeHealth.score })}
              </Badge>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  border: '1px solid var(--r-border)',
                  borderRadius: 'var(--r-radius-md)',
                  padding: 'var(--r-space-6) var(--r-space-7)',
                }}
              >
                <p className="r-hint" style={{ margin: '0 0 6px' }}>
                  {t('knowledge.coverageLabel')}
                </p>
                <p style={{ margin: 0, fontWeight: 'var(--r-weight-semibold)' }}>
                  {coverageLabel(knowledgeHealth.coverage)}
                </p>
              </div>
              <div
                style={{
                  border: '1px solid var(--r-border)',
                  borderRadius: 'var(--r-radius-md)',
                  padding: 'var(--r-space-6) var(--r-space-7)',
                }}
              >
                <p className="r-hint" style={{ margin: '0 0 6px' }}>
                  {t('knowledge.answerRiskLabel')}
                </p>
                <p style={{ margin: 0, fontWeight: 'var(--r-weight-semibold)' }}>
                  {riskLabel(knowledgeHealth.answerRisk)}
                </p>
              </div>
              <div
                style={{
                  border: '1px solid var(--r-border)',
                  borderRadius: 'var(--r-radius-md)',
                  padding: 'var(--r-space-6) var(--r-space-7)',
                }}
              >
                <p className="r-hint" style={{ margin: '0 0 6px' }}>
                  {t('knowledge.chunkCountLabel')}
                </p>
                <p style={{ margin: 0, fontWeight: 'var(--r-weight-semibold)' }}>
                  {knowledgeHealth.metrics.chunkCount}
                </p>
              </div>
            </div>

            <div
              className={`r-alert ${knowledgeHealth.answerRisk === 'high' ? 'r-alert-warning' : 'r-alert-info'}`}
              style={{ marginTop: 0 }}
            >
              <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <p className="r-alert-title">{t('knowledge.bannerTitle')}</p>
                <p className="r-alert-body">
                  {t('knowledge.bannerBody', {
                    coverage: coverageLabel(knowledgeHealth.coverage),
                    gap: knowledgeReasonLabel(knowledgeHealth.missingReasonCodes[0]),
                  })}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {!hasGoodInstructions ? (
          <div className="r-alert r-alert-warning">
            <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p className="r-alert-title">
                {!hasAnyInstructions ? t('ragAlert.emptyTitle') : t('ragAlert.thinTitle')}
              </p>
              <p className="r-alert-body">
                {!hasAnyInstructions ? t('ragAlert.emptyDesc') : t('ragAlert.thinDesc')}
              </p>
            </div>
          </div>
        ) : null}

        <div className="r-card" id="product-scraped-content">
          <p className="r-card-title" style={{ marginBottom: 16 }}>
            {t('productName')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="r-label" htmlFor={`${fieldPrefix}-name`}>
                {t('productName')}
              </label>
              <input
                id={`${fieldPrefix}-name`}
                className="r-input"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="r-label" htmlFor={`${fieldPrefix}-url`}>
                {t('productUrl')}
              </label>
              <input
                id={`${fieldPrefix}-url`}
                type="url"
                className="r-input"
                value={editedUrl}
                onChange={(e) => setEditedUrl(e.target.value)}
                autoComplete="off"
              />
              {editedUrl ? (
                <a
                  href={editedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="r-btn r-btn-ghost r-btn-sm"
                  style={{ marginTop: 8 }}
                >
                  {t('openPage')}
                </a>
              ) : null}
            </div>

            {product.external_id ? (
              <div>
                <label className="r-label" htmlFor={`${fieldPrefix}-external-id`}>
                  {t('externalIdLabel')}
                </label>
                <input
                  id={`${fieldPrefix}-external-id`}
                  className="r-input"
                  value={product.external_id}
                  disabled
                />
              </div>
            ) : null}
          </div>
        </div>

        <div
          className="r-card"
          id="product-bot-instructions"
          style={
            !hasGoodInstructions
              ? { background: 'var(--r-warning-bg)', borderColor: 'var(--r-warning)' }
              : undefined
          }
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <div>
              <p className="r-card-title">{t('botInstructions.title')}</p>
              <p className="r-hint" style={{ marginTop: 2 }}>
                {t('botInstructions.description')}
              </p>
            </div>
            {hasGoodInstructions ? (
              <Badge tone="success">{t('botInstructions.readyBadge')}</Badge>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="r-label" htmlFor={`${fieldPrefix}-usage`}>
                {t('botInstructions.usageLabel')} *
              </label>
              <textarea
                id={`${fieldPrefix}-usage`}
                className="r-textarea"
                rows={6}
                value={usageInstructions}
                onChange={(e) => setUsageInstructions(e.target.value)}
                placeholder={t('botInstructions.usagePlaceholder')}
                autoComplete="off"
              />
              <p className="r-field-help">
                {usageInstructions.trim().length > 0
                  ? t('botInstructions.usageCharCount', {
                      count: usageInstructions.length,
                      status: hasGoodInstructions
                        ? t('botInstructions.usageStatusGood')
                        : t('botInstructions.usageStatusShort'),
                    })
                  : t('botInstructions.usageHint')}
              </p>
            </div>

            <div>
              <label className="r-label" htmlFor={`${fieldPrefix}-video`}>
                {t('botInstructions.videoLabel')}
              </label>
              <input
                id={`${fieldPrefix}-video`}
                type="url"
                className="r-input"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={t('botInstructions.videoPlaceholder')}
                autoComplete="off"
              />
              <p className="r-field-help">{t('botInstructions.videoHint')}</p>
            </div>

            <div>
              <label className="r-label" htmlFor={`${fieldPrefix}-prevention`}>
                {t('botInstructions.preventionLabel')}
              </label>
              <textarea
                id={`${fieldPrefix}-prevention`}
                className="r-textarea"
                rows={3}
                value={preventionTips}
                onChange={(e) => setPreventionTips(e.target.value)}
                placeholder={t('botInstructions.preventionPlaceholder')}
                autoComplete="off"
              />
              <p className="r-field-help">{t('botInstructions.preventionHint')}</p>
            </div>
          </div>
        </div>

        <div className="r-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <p className="r-card-title" style={{ margin: 0 }}>
              {t('scrapedContent')}
            </p>
            <button
              className="r-btn r-btn-ghost r-btn-sm"
              onClick={handleRescrape}
              disabled={rescraping}
              aria-busy={rescraping || undefined}
            >
              {rescraping ? t('rescraping') : t('rescrape')}
            </button>
          </div>

          {editedRawText ? (
            <div>
              <textarea
                className="r-textarea"
                rows={20}
                value={editedRawText}
                onChange={(e) => setEditedRawText(e.target.value)}
                placeholder={t('scrapedPlaceholder')}
                autoComplete="off"
                aria-label={t('scrapedContent')}
              />
              <p className="r-hint" style={{ marginTop: 8 }}>
                {t('scrapedChars', { chars: editedRawText.length.toLocaleString('en-GB') })} •{' '}
                {t('scrapedLines', { lines: editedRawText.split('\n').length })}
              </p>
            </div>
          ) : (
            <EmptyState
              title={t('notScrapedYet')}
              action={
                <button
                  className="r-btn r-btn-primary"
                  onClick={handleRescrape}
                  disabled={rescraping}
                  aria-busy={rescraping || undefined}
                >
                  {rescraping ? t('rescraping') : t('scrapeNow')}
                </button>
              }
            />
          )}
        </div>

        {/*
          Same videoUrl/preventionTips fields as the Bot Instructions card above,
          sharing the same state — editing one updates the other immediately.
          Kept as-is (not a data bug, both write the same fields), but this
          duplication reads like two features were merged without deciding which
          card owns these fields. Worth a product call on whether to drop one.
        */}
        <div className="r-card">
          <p className="r-card-title">{rp('analyticsTitle')}</p>
          <p className="r-hint" style={{ marginTop: 2, marginBottom: 16 }}>
            {rp('moduleDescription')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="r-label" htmlFor={`${fieldPrefix}-rp-video`}>
                {rp('videoUrl')}
              </label>
              <input
                id={`${fieldPrefix}-rp-video`}
                type="url"
                className="r-input"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={rp('videoUrlPlaceholder')}
                autoComplete="off"
              />
              <p className="r-field-help">{rp('videoUrlDescription')}</p>
            </div>

            <div>
              <label className="r-label" htmlFor={`${fieldPrefix}-rp-prevention`}>
                {rp('preventionTips')}
              </label>
              <textarea
                id={`${fieldPrefix}-rp-prevention`}
                className="r-textarea"
                rows={4}
                value={preventionTips}
                onChange={(e) => setPreventionTips(e.target.value)}
                placeholder={rp('preventionTipsPlaceholder')}
                autoComplete="off"
              />
              <p className="r-field-help">{rp('preventionTipsDescription')}</p>
            </div>
          </div>
        </div>

        <div className="r-card">
          <p className="r-card-title" style={{ marginBottom: 16 }}>
            {t('metadata.title')}
          </p>
          <div className="r-two-col">
            <div>
              <p className="r-hint" style={{ margin: '0 0 4px' }}>
                {t('metadata.created')}
              </p>
              <p style={{ margin: 0, fontWeight: 'var(--r-weight-semibold)' }}>
                {new Date(product.created_at).toLocaleString('en-GB')}
              </p>
            </div>
            <div>
              <p className="r-hint" style={{ margin: '0 0 4px' }}>
                {t('metadata.lastUpdated')}
              </p>
              <p style={{ margin: 0, fontWeight: 'var(--r-weight-semibold)' }}>
                {new Date(product.updated_at).toLocaleString('en-GB')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
