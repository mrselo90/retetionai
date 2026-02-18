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

      // Reload product
      await loadProduct();
      toast.success(t('toasts.rescanSuccess.title'), t('toasts.rescanSuccess.message'));
    } catch (err) {
      console.error('Failed to rescrape product:', err);
      toast.error(t('toasts.rescanError.title'), t('toasts.rescanError.message'));
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
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-zinc-600">{t('notFound')}</p>
            <button
              onClick={() => router.push('/dashboard/products')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('backToProducts')}
            </button>
          </div>
        </div>
      
    );
  }

  return (
    
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push('/dashboard/products')}
              className="text-sm text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('backToProducts')}
            </button>
            <h1 className="text-3xl font-bold text-zinc-900">{t('editProduct')}</h1>
            <p className="mt-2 text-zinc-600">{t('editDescription')}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRescrape}
              disabled={rescraping}
              className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rescraping ? 'Taranıyor...' : 'Yeniden Tara'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>

        {/* Product Info */}
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
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
            <label className="block text-sm font-medium text-zinc-700 mb-2">
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
              <label className="block text-sm font-medium text-zinc-700 mb-2">
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

        {/* Scraped Content */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-zinc-900">Taranan İçerik</h2>
            <button
              onClick={handleRescrape}
              disabled={rescraping}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
            >
              {rescraping ? 'Taranıyor...' : 'Yeniden Tara'}
            </button>
          </div>
          
          {editedRawText ? (
            <div className="space-y-4">
              <textarea
                value={editedRawText}
                onChange={(e) => setEditedRawText(e.target.value)}
                rows={20}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-zinc-900"
                placeholder="Taranan içerik burada görünecek..."
              />
              <p className="text-sm text-zinc-600">
                {editedRawText.length.toLocaleString('tr-TR')} karakter • {editedRawText.split('\n').length} satır
              </p>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-2 text-zinc-600">Henüz içerik taranmamış</p>
              <button
                onClick={handleRescrape}
                disabled={rescraping}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {rescraping ? 'Taranıyor...' : 'Şimdi Tara'}
              </button>
            </div>
          )}
        </div>

        {/* Return Prevention Content */}
        <div className="bg-white rounded-lg shadow p-6 space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">{rp('analyticsTitle')}</h2>
            <p className="text-sm text-zinc-500 mt-1">{rp('moduleDescription')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
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
            <label className="block text-sm font-medium text-zinc-700 mb-2">
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
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-zinc-900 mb-4">Metadata</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
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
