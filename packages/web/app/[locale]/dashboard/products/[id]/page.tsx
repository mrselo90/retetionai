'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useTranslations } from 'next-intl';

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
}

export default function ProductDetailPage() {
  const t = useTranslations('ProductDetail');
  const rp = useTranslations('ReturnPrevention');
  const params = useParams();
  const router = useRouter();
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

  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);

  const loadProduct = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
        const instrResponse = await authenticatedRequest<{ instruction: ProductInstruction | null }>(
          `/api/products/${productId}/instruction`,
          session.access_token
        );
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
      const { data: { session } } = await supabase.auth.getSession();
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

      // Save instruction fields if usage_instructions has content
      if (usageInstructions.trim()) {
        try {
          await authenticatedRequest(
            `/api/products/${productId}/instruction`,
            session.access_token,
            {
              method: 'PUT',
              body: JSON.stringify({
                usage_instructions: usageInstructions,
                recipe_summary: recipeSummary || undefined,
                video_url: videoUrl || undefined,
                prevention_tips: preventionTips || undefined,
              }),
            }
          );
        } catch (instrErr) {
          console.error('Failed to save instructions:', instrErr);
        }
      }

      await loadProduct();
      toast.success(t('toasts.saved.title'), t('toasts.saved.message'));
    } catch (err: any) {
      console.error('Failed to save product:', err);
      toast.error(t('toasts.saveError.title'), err.message || t('toasts.saveError.message'));
    } finally {
      setSaving(false);
    }
  };

  const handleRescrape = async () => {
    if (!product) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setRescraping(true);

      const scrapeResponse = await authenticatedRequest<{
        message: string;
        scraped: any;
      }>(
        `/api/products/${productId}/scrape`,
        session.access_token,
        {
          method: 'POST',
        }
      );

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
      } catch (err) {
        console.error('Embedding generation failed:', err);
      }

      await loadProduct();
      toast.success(t('toasts.rescanSuccess.title'), t('toasts.rescanSuccess.message'));
    } catch (err: any) {
      console.error('Failed to rescrape product:', err);
      toast.error(t('toasts.rescanError.title'), err.message || t('toasts.rescanError.message'));
    } finally {
      setRescraping(false);
    }
  };

  if (loading) {
    return (

      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-200 rounded w-1/4"></div>
          <div className="h-4 bg-zinc-200 rounded w-1/2"></div>
          <div className="h-64 bg-zinc-200 rounded"></div>
        </div>
      </div>

    );
  }

  if (!product) {
    return (

      <div className="space-y-6">
        <div className="bg-card rounded-lg border border-border shadow-sm p-12 text-center">
          <p className="text-zinc-600">{t('notFound')}</p>
          <button
            onClick={() => router.push('/dashboard/products')}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            {t('backToProducts')}
          </button>
        </div>
      </div>

    );
  }

  // Determine RAG quality status for the alert
  const hasGoodInstructions = usageInstructions.trim().length >= 50;
  const hasAnyInstructions = usageInstructions.trim().length > 0;

  return (

    <div className="space-y-6">

      {/* ── RAG Quality Alert ──────────────────────────────────────── */}
      {!hasGoodInstructions && (
        <div className={`flex gap-4 p-4 rounded-xl border-2 ${!hasAnyInstructions
          ? 'border-amber-300 bg-amber-50'
          : 'border-yellow-200 bg-yellow-50'
          }`}>
          <div className="flex-shrink-0 mt-0.5">
            <svg className={`w-5 h-5 ${!hasAnyInstructions ? 'text-amber-500' : 'text-yellow-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${!hasAnyInstructions ? 'text-amber-800' : 'text-yellow-800'}`}>
              {!hasAnyInstructions
                ? t('ragAlert.emptyTitle')
                : t('ragAlert.thinTitle')}
            </p>
            <p className={`text-sm mt-1 ${!hasAnyInstructions ? 'text-amber-700' : 'text-yellow-700'}`}>
              {!hasAnyInstructions
                ? t('ragAlert.emptyDesc')
                : t('ragAlert.thinDesc')}
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/dashboard/products')}
            className="text-sm text-primary hover:underline mb-2 flex items-center gap-1 font-medium"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('backToProducts')}
          </button>
          <h1 className="text-3xl font-bold text-foreground">{t('editProduct')}</h1>
          <p className="mt-2 text-zinc-600">{t('editDescription')}</p>
        </div>
        <div className="flex w-full sm:w-auto gap-3">
          <button
            onClick={handleRescrape}
            disabled={rescraping}
            className="flex-1 sm:flex-none px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rescraping ? t('rescraping') : t('rescrape')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 sm:flex-none px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>

      {/* Product Info */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6 space-y-6">
        <div>
          <label className="form-label">
            {t('productName')}
          </label>
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900"
          />
        </div>

        <div>
          <label className="form-label">
            {t('productUrl')}
          </label>
          <input
            type="url"
            value={editedUrl}
            onChange={(e) => setEditedUrl(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900"
          />
          <a
            href={editedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-sm text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
          >
            {t('openPage')}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {product.external_id && (
          <div>
            <label className="form-label">
              External ID
            </label>
            <input
              type="text"
              value={product.external_id}
              disabled
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg bg-zinc-50 text-zinc-500"
            />
          </div>
        )}
      </div>

      {/* ── Bot Instructions ──────────────────────────────────────── */}
      <div className={`bg-card rounded-lg border-2 shadow-sm p-6 space-y-5 ${!hasGoodInstructions ? 'border-amber-300' : 'border-border'
        }`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{t('botInstructions.title')}</h2>
            <p className="text-sm text-zinc-500 mt-1">{t('botInstructions.description')}</p>
          </div>
          {hasGoodInstructions && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full shrink-0">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {t('botInstructions.readyBadge')}
            </span>
          )}
        </div>

        {/* Usage Instructions — the main RAG field */}
        <div>
          <label className="form-label">
            {t('botInstructions.usageLabel')}
            <span className="text-amber-500 ml-1">*</span>
          </label>
          <textarea
            value={usageInstructions}
            onChange={(e) => setUsageInstructions(e.target.value)}
            rows={6}
            placeholder={t('botInstructions.usagePlaceholder')}
            className={`w-full px-3 py-2.5 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-zinc-900 text-sm resize-y transition-colors ${!hasAnyInstructions
              ? 'border-amber-300 focus:border-primary bg-amber-50/30'
              : !hasGoodInstructions
                ? 'border-yellow-300 focus:border-primary'
                : 'border-zinc-200 focus:border-primary'
              }`}
          />
          <p className="text-xs text-zinc-500 mt-1.5">
            {usageInstructions.trim().length > 0
              ? `${usageInstructions.length} karakter — ${hasGoodInstructions ? '✅ Yeterli' : '⚠️ 50+ karakter girin'}`
              : t('botInstructions.usageHint')
            }
          </p>
        </div>

        {/* Video URL */}
        <div>
          <label className="form-label">
            {t('botInstructions.videoLabel')}
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder={t('botInstructions.videoPlaceholder')}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-zinc-900 text-sm"
          />
          <p className="text-xs text-zinc-500 mt-1">{t('botInstructions.videoHint')}</p>
        </div>

        {/* Prevention Tips */}
        <div>
          <label className="form-label">
            {t('botInstructions.preventionLabel')}
          </label>
          <textarea
            value={preventionTips}
            onChange={(e) => setPreventionTips(e.target.value)}
            rows={3}
            placeholder={t('botInstructions.preventionPlaceholder')}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-zinc-900 text-sm"
          />
          <p className="text-xs text-zinc-500 mt-1">{t('botInstructions.preventionHint')}</p>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold text-foreground">{t('scrapedContent')}</h2>
          <button
            onClick={handleRescrape}
            disabled={rescraping}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
          >
            {rescraping ? t('rescraping') : t('rescrape')}
          </button>
        </div>

        {editedRawText ? (
          <div className="space-y-4">
            <textarea
              value={editedRawText}
              onChange={(e) => setEditedRawText(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-zinc-900"
              placeholder={t('scrapedPlaceholder')}
            />
            <p className="text-sm text-zinc-600">
              {t('scrapedChars', { chars: editedRawText.length.toLocaleString('tr-TR') })} • {t('scrapedLines', { lines: editedRawText.split('\n').length })}
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-zinc-600">{t('notScrapedYet')}</p>
            <button
              onClick={handleRescrape}
              disabled={rescraping}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-medium disabled:opacity-50"
            >
              {rescraping ? t('rescraping') : t('scrapeNow')}
            </button>
          </div>
        )}
      </div>

      {/* Return Prevention Content */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{rp('analyticsTitle')}</h2>
          <p className="text-sm text-zinc-500 mt-1">{rp('moduleDescription')}</p>
        </div>

        <div>
          <label className="form-label">
            {rp('videoUrl')}
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder={rp('videoUrlPlaceholder')}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900"
          />
          <p className="text-xs text-zinc-500 mt-1">{rp('videoUrlDescription')}</p>
        </div>

        <div>
          <label className="form-label">
            {rp('preventionTips')}
          </label>
          <textarea
            value={preventionTips}
            onChange={(e) => setPreventionTips(e.target.value)}
            rows={4}
            placeholder={rp('preventionTipsPlaceholder')}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900"
          />
          <p className="text-xs text-zinc-500 mt-1">{rp('preventionTipsDescription')}</p>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6 mt-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Metadata</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-zinc-600">Oluşturulma:</span>
            <p className="text-zinc-900 font-medium mt-1">
              {new Date(product.created_at).toLocaleString('tr-TR')}
            </p>
          </div>
          <div>
            <span className="text-zinc-600">Son Güncelleme:</span>
            <p className="text-zinc-900 font-medium mt-1">
              {new Date(product.updated_at).toLocaleString('tr-TR')}
            </p>
          </div>
        </div>
      </div>
    </div>

  );
}
