'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { toast } from '@/lib/toast';
import {
  Banner,
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Text,
  TextField,
} from '@shopify/polaris';
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
      } catch (err: any) {
        console.error('Embedding generation failed:', err);
        toast.warning(
          t('toasts.embeddingWarning.title'),
          err.message || t('toasts.embeddingWarning.message')
        );
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
      <SkeletonPage title={t('editProduct')}>
        <Layout>
          <Layout.Section>
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-200 rounded w-1/4"></div>
          <div className="h-4 bg-zinc-200 rounded w-1/2"></div>
          <div className="h-64 bg-zinc-200 rounded"></div>
        </div>
      </div>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  if (!product) {
    return (
      <Page title={t('editProduct')}>
        <Layout>
          <Layout.Section>
      <div className="space-y-6">
        <Card>
          <div className="p-12 text-center">
            <Text as="p" tone="subdued">{t('notFound')}</Text>
            <div className="mt-4 flex justify-center">
              <Button onClick={() => router.push('/dashboard/products')}>{t('backToProducts')}</Button>
            </div>
          </div>
        </Card>
      </div>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // Determine RAG quality status for the alert
  const hasGoodInstructions = usageInstructions.trim().length >= 50;
  const hasAnyInstructions = usageInstructions.trim().length > 0;
  const instructionCharStatus = usageInstructions.trim().length > 0
    ? `${usageInstructions.length} karakter — ${hasGoodInstructions ? '✅ Yeterli' : '⚠️ 50+ karakter girin'}`
    : t('botInstructions.usageHint');

  return (
    <Page title={t('editProduct')} subtitle={t('editDescription')} fullWidth>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">

            {!hasGoodInstructions && (
              <Banner tone="warning" title={!hasAnyInstructions ? t('ragAlert.emptyTitle') : t('ragAlert.thinTitle')}>
                <p>{!hasAnyInstructions ? t('ragAlert.emptyDesc') : t('ragAlert.thinDesc')}</p>
              </Banner>
            )}

            <Card>
              <Box padding="400">
                <InlineGrid columns={{ xs: '1fr', md: '2fr auto' }} gap="400" alignItems="center">
                  <BlockStack gap="200">
                    <Button onClick={() => router.push('/dashboard/products')} variant="plain" textAlign="left">
                      {t('backToProducts')}
                    </Button>
                    <BlockStack gap="100">
                      <Text as="h1" variant="headingLg">
                        {t('editProduct')}
                      </Text>
                      <Text as="p" tone="subdued">
                        {t('editDescription')}
                      </Text>
                    </BlockStack>
                  </BlockStack>
                  <InlineStack gap="300" wrap={false} align="end">
                    <Button onClick={handleRescrape} disabled={rescraping} loading={rescraping}>
                      {rescraping ? t('rescraping') : t('rescrape')}
                    </Button>
                    <Button onClick={handleSave} disabled={saving} loading={saving} variant="primary">
                      {saving ? t('saving') : t('save')}
                    </Button>
                  </InlineStack>
                </InlineGrid>
              </Box>
            </Card>

            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    {t('productName')}
                  </Text>
                  <TextField
                    label={t('productName')}
                    labelHidden
                    value={editedName}
                    onChange={setEditedName}
                    autoComplete="off"
                  />
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">
                      {t('productUrl')}
                    </Text>
                    <TextField
                      label={t('productUrl')}
                      labelHidden
                      type="url"
                      value={editedUrl}
                      onChange={setEditedUrl}
                      autoComplete="off"
                    />
                    {editedUrl && (
                      <InlineStack align="start">
                        <Button url={editedUrl} target="_blank" variant="plain">
                          {t('openPage')}
                        </Button>
                      </InlineStack>
                    )}
                  </BlockStack>

                  {product.external_id && (
                    <TextField
                      label="External ID"
                      value={product.external_id}
                      disabled
                      autoComplete="off"
                    />
                  )}
                </BlockStack>
              </Box>
            </Card>

            <Card background={!hasGoodInstructions ? 'bg-surface-warning' : undefined}>
              <Box padding="400">
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="start" gap="300">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">
                        {t('botInstructions.title')}
                      </Text>
                      <Text as="p" tone="subdued">
                        {t('botInstructions.description')}
                      </Text>
                    </BlockStack>
                    {hasGoodInstructions && <Badge tone="success">{t('botInstructions.readyBadge')}</Badge>}
                  </InlineStack>

                  <TextField
                    label={`${t('botInstructions.usageLabel')} *`}
                    multiline={6}
                    value={usageInstructions}
                    onChange={setUsageInstructions}
                    placeholder={t('botInstructions.usagePlaceholder')}
                    autoComplete="off"
                    helpText={instructionCharStatus}
                  />

                  <TextField
                    label={t('botInstructions.videoLabel')}
                    type="url"
                    value={videoUrl}
                    onChange={setVideoUrl}
                    placeholder={t('botInstructions.videoPlaceholder')}
                    autoComplete="off"
                    helpText={t('botInstructions.videoHint')}
                  />

                  <TextField
                    label={t('botInstructions.preventionLabel')}
                    multiline={3}
                    value={preventionTips}
                    onChange={setPreventionTips}
                    placeholder={t('botInstructions.preventionPlaceholder')}
                    autoComplete="off"
                    helpText={t('botInstructions.preventionHint')}
                  />
                </BlockStack>
              </Box>
            </Card>

            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center" gap="300">
                    <Text as="h2" variant="headingMd">
                      {t('scrapedContent')}
                    </Text>
                    <Button onClick={handleRescrape} disabled={rescraping} loading={rescraping} variant="plain">
                      {rescraping ? t('rescraping') : t('rescrape')}
                    </Button>
                  </InlineStack>

                  {editedRawText ? (
                    <BlockStack gap="300">
                      <TextField
                        label={t('scrapedContent')}
                        labelHidden
                        value={editedRawText}
                        onChange={setEditedRawText}
                        multiline={20}
                        autoComplete="off"
                        placeholder={t('scrapedPlaceholder')}
                      />
                      <Text as="p" tone="subdued">
                        {t('scrapedChars', { chars: editedRawText.length.toLocaleString('tr-TR') })} •{' '}
                        {t('scrapedLines', { lines: editedRawText.split('\n').length })}
                      </Text>
                    </BlockStack>
                  ) : (
                    <Box paddingBlock="800">
                      <BlockStack gap="300" align="center">
                        <Text as="p" tone="subdued">
                          {t('notScrapedYet')}
                        </Text>
                        <Button onClick={handleRescrape} disabled={rescraping} loading={rescraping} variant="primary">
                          {rescraping ? t('rescraping') : t('scrapeNow')}
                        </Button>
                      </BlockStack>
                    </Box>
                  )}
                </BlockStack>
              </Box>
            </Card>

            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">
                      {rp('analyticsTitle')}
                    </Text>
                    <Text as="p" tone="subdued">
                      {rp('moduleDescription')}
                    </Text>
                  </BlockStack>

                  <TextField
                    label={rp('videoUrl')}
                    type="url"
                    value={videoUrl}
                    onChange={setVideoUrl}
                    placeholder={rp('videoUrlPlaceholder')}
                    autoComplete="off"
                    helpText={rp('videoUrlDescription')}
                  />

                  <TextField
                    label={rp('preventionTips')}
                    multiline={4}
                    value={preventionTips}
                    onChange={setPreventionTips}
                    placeholder={rp('preventionTipsPlaceholder')}
                    autoComplete="off"
                    helpText={rp('preventionTipsDescription')}
                  />
                </BlockStack>
              </Box>
            </Card>

            <Card>
              <Box padding="400">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Metadata
                  </Text>
                  <InlineGrid columns={{ xs: '1fr', sm: '1fr 1fr' }} gap="400">
                    <BlockStack gap="100">
                      <Text as="span" tone="subdued">
                        Oluşturulma:
                      </Text>
                      <Text as="p" variant="bodyMd" fontWeight="medium">
                        {new Date(product.created_at).toLocaleString('tr-TR')}
                      </Text>
                    </BlockStack>
                    <BlockStack gap="100">
                      <Text as="span" tone="subdued">
                        Son Güncelleme:
                      </Text>
                      <Text as="p" variant="bodyMd" fontWeight="medium">
                        {new Date(product.updated_at).toLocaleString('tr-TR')}
                      </Text>
                    </BlockStack>
                  </InlineGrid>
                </BlockStack>
              </Box>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
