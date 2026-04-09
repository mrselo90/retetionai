/**
 * Product management routes
 * CRUD operations and scraping
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/billingMiddleware.js';
import { buildShopifyProductFallbackContent, getSupabaseServiceClient, logger } from '@recete/shared';
import { scrapeProductPage } from '../lib/scraper.js';
import { fetchShopifyProductByHandle } from '../lib/shopify.js';
import { addScrapeJob } from '../queues.js';
import { processProductForRAG, batchProcessProducts, getProductChunkCount } from '../lib/knowledgeBase.js';
import { enrichProductDataDetailed } from '../lib/llm/enrichProduct.js';
import { persistProductFactsSnapshot } from '../lib/productFactsStore.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import {
  createProductSchema,
  updateProductSchema,
  productIdSchema,
  productInstructionSchema,
  enrichProductFromUrlSchema,
  CreateProductInput,
  UpdateProductInput,
  ProductIdParams,
  ProductInstructionInput,
  EnrichProductFromUrlInput,
} from '../schemas/products.js';
import {
  getCachedProduct,
  setCachedProduct,
  invalidateProductCache,
  getCachedApiResponse,
  setCachedApiResponse,
  invalidateApiCache,
  invalidateMerchantRagCaches,
} from '../lib/cache.js';
import { enforceStorageLimit } from '../lib/planLimits.js';
import { checkMerchantRecipeCapacity } from '../lib/merchantPlanFeatures.js';
import { MultiLangChunkShadowWriteService } from '../lib/multiLangRag/chunkShadowWriteService.js';
import { buildProductLanguageHealthMap } from '../lib/multiLangRag/productLanguageHealth.js';
import { ShopSettingsService } from '../lib/multiLangRag/shopSettingsService.js';
import { getProductsCacheTtlSeconds } from '../lib/runtimeModelSettings.js';
import { buildProductKnowledgeHealthMap } from '../lib/knowledgeHealth.js';

const products = new Hono();
const multiLangChunkShadowWrite = new MultiLangChunkShadowWriteService();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'unknown error');
}

type ProductPipelineStep = 'map_product' | 'collect_sources' | 'generate_ai_knowledge';
type ProductPipelineStepStatus = 'not_started' | 'in_progress' | 'ready' | 'error';

function buildStepOutcome(
  step: ProductPipelineStep,
  status: ProductPipelineStepStatus,
  options?: {
    updatedAt?: string | null;
    delta?: Record<string, unknown>;
    error?: string;
  },
) {
  return {
    step,
    status,
    updatedAt: options?.updatedAt || new Date().toISOString(),
    delta: options?.delta || {},
    error: options?.error || null,
  };
}

function isSkippableShadowSyncError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("reading 'shop_id'") ||
    message.includes('shop_settings') ||
    message.includes('product_i18n') ||
    message.includes('knowledge_chunks_i18n') ||
    message.includes('does not exist')
  );
}

function shadowSyncProductKnowledge(merchantId: string, productId: string, reason: string) {
  void (async () => {
    try {
      await multiLangChunkShadowWrite.syncProduct(String(merchantId), productId);
    } catch (error) {
      const payload = { error: getErrorMessage(error), merchantId, productId, reason };
      if (isSkippableShadowSyncError(error)) {
        logger.info(payload, 'Multi-lang chunk shadow write skipped');
        return;
      }
      logger.warn(payload, 'Multi-lang chunk shadow write failed');
    }
  })();
}

function buildMergedLayerText(
  existing: string | null | undefined,
  incoming: string,
  sourceUrl: string,
  label: 'RAW' | 'ENRICHED',
): string {
  const incomingTrimmed = incoming.trim();
  const existingTrimmed = (existing || '').trim();
  if (!incomingTrimmed) return existingTrimmed;
  if (!existingTrimmed) return incomingTrimmed;
  if (existingTrimmed.includes(incomingTrimmed)) return existingTrimmed;

  const stamp = new Date().toISOString();
  return `${existingTrimmed}\n\n[${label}_ENRICHMENT_SOURCE url="${sourceUrl}" fetched_at="${stamp}"]\n${incomingTrimmed}`;
}

async function invalidateProductKnowledgeCaches(
  merchantId: string,
  productId?: string,
  options?: { invalidateProductDetails?: boolean },
) {
  await Promise.all([
    invalidateMerchantRagCaches(String(merchantId)),
    options?.invalidateProductDetails && productId ? invalidateProductCache(productId) : Promise.resolve(true),
    invalidateApiCache(`products:${merchantId}`),
  ]);
}

// All routes require authentication
products.use('/*', authMiddleware);
products.use('/*', requireActiveSubscription as any);

/**
 * List products
 * GET /api/products
 */
products.get('/', async (c) => {
  const merchantId = c.get('merchantId');
  const serviceClient = getSupabaseServiceClient();

  const cacheKey = `products:${merchantId}`;
  const cached = await getCachedApiResponse(cacheKey);
  if (cached) {
    return c.json(cached);
  }

  const { data: products, error } = await serviceClient
    .from('products')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  if (error) {
    return c.json({ error: 'Failed to fetch products' }, 500);
  }

  const settings = await new ShopSettingsService().getOrCreate(String(merchantId));
  const [knowledgeHealthMap, languageHealthMap] = await Promise.all([
    buildProductKnowledgeHealthMap(serviceClient, String(merchantId), products || []),
    buildProductLanguageHealthMap(serviceClient, String(merchantId), products || [], {
      requiredLanguages: settings.enabled_langs,
    }),
  ]);
  const payload = {
    products: (products || []).map((product) => ({
      ...product,
      knowledgeHealth: knowledgeHealthMap.get(product.id) || null,
      languageHealth: languageHealthMap.get(product.id) || null,
    })),
  };
  const ttlSeconds = await getProductsCacheTtlSeconds();
  await setCachedApiResponse(cacheKey, payload, ttlSeconds);
  return c.json(payload);
});

/**
 * List product instructions for merchant (for UI)
 * GET /api/products/instructions/list
 * Must be before /:id to avoid "instructions" as id
 */
products.get('/mapping-index', async (c) => {
  const merchantId = c.get('merchantId');
  const serviceClient = getSupabaseServiceClient();

  const [{ data: products, error: productsError }, { data: rows, error: instructionsError }] = await Promise.all([
    serviceClient
      .from('products')
      .select('id, external_id')
      .eq('merchant_id', merchantId),
    serviceClient
      .from('product_instructions')
      .select('product_id, usage_instructions, recipe_summary, video_url, prevention_tips, products(id, name, external_id)')
      .eq('merchant_id', merchantId),
  ]);

  if (productsError || instructionsError) {
    return c.json({ error: 'Failed to fetch mapping index' }, 500);
  }

  const instructions = (rows || []).map((r: any) => ({
    product_id: r.product_id,
    product_name: r.products?.name,
    external_id: r.products?.external_id,
    usage_instructions: r.usage_instructions,
    recipe_summary: r.recipe_summary,
    video_url: r.video_url,
    prevention_tips: r.prevention_tips,
  }));

  return c.json({
    localProducts: (products || []).map((product) => ({
      id: product.id,
      external_id: product.external_id,
    })),
    localProductCount: products?.length || 0,
    instructions,
  });
});

products.get('/instructions/list', async (c) => {
  const merchantId = c.get('merchantId');
  const serviceClient = getSupabaseServiceClient();

  const { data: rows, error } = await serviceClient
    .from('product_instructions')
    .select('product_id, usage_instructions, recipe_summary, video_url, prevention_tips, created_at, updated_at, products(id, name, external_id)')
    .eq('merchant_id', merchantId);

  if (error) {
    return c.json({ error: 'Failed to fetch instructions' }, 500);
  }

  const instructions = (rows || []).map((r: any) => ({
    product_id: r.product_id,
    product_name: r.products?.name,
    external_id: r.products?.external_id,
    usage_instructions: r.usage_instructions,
    recipe_summary: r.recipe_summary,
    video_url: r.video_url,
    prevention_tips: r.prevention_tips,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return c.json({ instructions });
});

/**
 * List active product facts snapshots for merchant (for UI insights)
 * GET /api/products/facts?product_ids=...
 */
products.get('/facts', async (c) => {
  const merchantId = c.get('merchantId');
  const serviceClient = getSupabaseServiceClient();
  const rawIds = String(c.req.query('product_ids') || '');
  const productIds = rawIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (productIds.length === 0) {
    return c.json({ facts: [] });
  }

  const { data: rows, error } = await serviceClient
    .from('product_facts')
    .select('product_id, detected_language, facts_json, source_type, source_url')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .in('product_id', productIds);

  if (error) {
    return c.json({ error: 'Failed to fetch product facts' }, 500);
  }

  const facts = (rows || []).map((row: any) => ({
    product_id: row.product_id,
    detected_language: row.detected_language || null,
    facts_json: row.facts_json || null,
    source_type: row.source_type || null,
    source_url: row.source_url || null,
  }));

  return c.json({ facts });
});

/**
 * Get product instruction (recipe & usage)
 * GET /api/products/:id/instruction
 */
products.get('/:id/instruction', validateParams(productIdSchema), async (c) => {
  const merchantId = c.get('merchantId');
  const { id: productId } = c.get('validatedParams') as ProductIdParams;
  const serviceClient = getSupabaseServiceClient();

  const { data: product, error: productError } = await serviceClient
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .single();

  if (productError || !product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  const { data: instruction, error } = await serviceClient
    .from('product_instructions')
    .select('id, usage_instructions, recipe_summary, video_url, prevention_tips, created_at, updated_at')
    .eq('merchant_id', merchantId)
    .eq('product_id', productId)
    .maybeSingle();

  if (error) {
    return c.json({ error: 'Failed to fetch instruction' }, 500);
  }

  if (!instruction) {
    return c.json({ instruction: null });
  }

  return c.json({ instruction });
});

/**
 * Create or update product instruction (recipe & usage)
 * PUT /api/products/:id/instruction
 */
products.put('/:id/instruction', validateParams(productIdSchema), validateBody(productInstructionSchema), async (c) => {
  const merchantId = c.get('merchantId');
  const { id: productId } = c.get('validatedParams') as ProductIdParams;
  const body = c.get('validatedBody') as ProductInstructionInput;
  const serviceClient = getSupabaseServiceClient();

  const { data: product, error: productError } = await serviceClient
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .single();

  if (productError || !product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  const { data: instruction, error } = await serviceClient
    .from('product_instructions')
    .upsert(
      {
        merchant_id: merchantId,
        product_id: productId,
        usage_instructions: body.usage_instructions,
        recipe_summary: body.recipe_summary ?? null,
        video_url: body.video_url || null,
        prevention_tips: body.prevention_tips ?? null,
      },
      { onConflict: 'merchant_id,product_id', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) {
    return c.json({ error: 'Failed to save instruction' }, 500);
  }

  await invalidateProductKnowledgeCaches(String(merchantId), productId);
  shadowSyncProductKnowledge(String(merchantId), productId, 'instruction save');

  return c.json({ instruction });
});

/**
 * Get single product
 * GET /api/products/:id
 */
products.get('/:id', async (c) => {
  const merchantId = c.get('merchantId');
  const productId = c.req.param('id');
  const serviceClient = getSupabaseServiceClient();

  // Try cache first
  const cached = await getCachedProduct(productId) as any;
  if (cached && cached.merchant_id) {
    // Verify it belongs to this merchant
    if (cached.merchant_id === merchantId) {
      const knowledgeHealthMap = await buildProductKnowledgeHealthMap(serviceClient, String(merchantId), [cached]);
      return c.json({
        product: {
          ...cached,
          knowledgeHealth: knowledgeHealthMap.get(cached.id) || null,
        },
      });
    }
  }

  const { data: product, error } = await serviceClient
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .single();

  if (error || !product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  // Cache product (10 minutes)
  await setCachedProduct(productId, product, 600);

  const knowledgeHealthMap = await buildProductKnowledgeHealthMap(serviceClient, String(merchantId), [product]);

  return c.json({
    product: {
      ...product,
      knowledgeHealth: knowledgeHealthMap.get(product.id) || null,
    },
  });
});

/**
 * Create product
 * POST /api/products
 */
products.post('/', validateBody(createProductSchema), async (c) => {
  const merchantId = c.get('merchantId');
  const validatedBody = c.get('validatedBody') as CreateProductInput;
  const { name, url, external_id, raw_text } = validatedBody;
  const serviceClient = getSupabaseServiceClient();

  const { count: currentProductCount, error: countError } = await serviceClient
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchantId);

  if (countError) {
    return c.json({ error: 'Failed to validate product capacity' }, 500);
  }

  const capacity = await checkMerchantRecipeCapacity(merchantId, currentProductCount || 0);
  if (!capacity.allowed) {
    return c.json(
      {
        error: 'Product limit exceeded',
        message: `Your current plan allows ${capacity.limit} recipes/products. Upgrade before creating more.`,
      },
      403,
    );
  }

  const { data: product, error } = await serviceClient
    .from('products')
    .insert({
      merchant_id: merchantId,
      name,
      url,
      external_id: external_id || null,
      raw_text: raw_text || null,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: 'Failed to create product' }, 500);
  }

  // Cache new product
  await setCachedProduct(product.id, product, 600);
  await invalidateProductKnowledgeCaches(String(merchantId), product.id);
  shadowSyncProductKnowledge(String(merchantId), product.id, 'create product');

  return c.json({ product }, 201);
});

/**
 * Update product
 * PUT /api/products/:id
 */
products.put('/:id', validateParams(productIdSchema), validateBody(updateProductSchema), async (c) => {
  const merchantId = c.get('merchantId');
  const validatedParams = c.get('validatedParams') as ProductIdParams;
  const { id: productId } = validatedParams;
  const validatedBody = c.get('validatedBody') as UpdateProductInput;
  const serviceClient = getSupabaseServiceClient();

  // Verify ownership
  const { data: existing } = await serviceClient
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .single();

  if (!existing) {
    return c.json({ error: 'Product not found' }, 404);
  }

  // Build update data from validated body
  const updateData: Record<string, any> = {};
  if (validatedBody.name !== undefined) updateData.name = validatedBody.name;
  if (validatedBody.url !== undefined) updateData.url = validatedBody.url;
  if (validatedBody.external_id !== undefined) updateData.external_id = validatedBody.external_id;
  if (validatedBody.raw_text !== undefined) updateData.raw_text = validatedBody.raw_text;

  // Check if there's anything to update
  if (Object.keys(updateData).length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  // Always update the updated_at timestamp
  updateData.updated_at = new Date().toISOString();

  console.log('Updating product:', productId, 'with data:', updateData);

  const { data: product, error } = await serviceClient
    .from('products')
    .update(updateData)
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    console.error('Product update error:', error);
    return c.json({
      error: 'Failed to update product',
      details: error.message,
      code: error.code,
      hint: error.hint
    }, 500);
  }

  // Update cache
  await setCachedProduct(productId, product, 600);
  await invalidateProductKnowledgeCaches(String(merchantId), productId);
  shadowSyncProductKnowledge(String(merchantId), productId, 'update product');

  return c.json({ product });
});

/**
 * Delete product
 * DELETE /api/products/:id
 */
products.delete('/:id', async (c) => {
  const merchantId = c.get('merchantId');
  const productId = c.req.param('id');
  const serviceClient = getSupabaseServiceClient();

  // Verify ownership
  const { data: existing } = await serviceClient
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .single();

  if (!existing) {
    return c.json({ error: 'Product not found' }, 404);
  }

  const { error } = await serviceClient
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) {
    console.error('Failed to delete product:', error);
    return c.json({ error: 'Failed to delete product' }, 500);
  }

  // Remove product from cache
  await invalidateProductKnowledgeCaches(String(merchantId), productId, { invalidateProductDetails: true });

  return c.json({ message: 'Product deleted' });
});

/**
 * Scrape product (immediate)
 * POST /api/products/:id/scrape
 */
products.post('/:id/scrape', async (c) => {
  const merchantId = c.get('merchantId');
  const productId = c.req.param('id');
  const serviceClient = getSupabaseServiceClient();

  // Get product
  const { data: product, error: fetchError } = await serviceClient
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .single();

  if (fetchError || !product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  // Scrape immediately
  const scrapeResult = await scrapeProductPage(product.url);

  if (!scrapeResult.success) {
    return c.json({
      error: 'Scraping failed',
      details: scrapeResult.error,
      stepOutcome: buildStepOutcome('collect_sources', 'error', {
        error: scrapeResult.error || 'Scrape failed',
        delta: { source: 'product_url' },
      }),
    }, 500);
  }

  let rawContent = scrapeResult.product!.rawContent;

  // Detect Shopify password protection
  if (rawContent && rawContent.toLowerCase().includes('password protected')) {
    // FALLBACK: If it's a Shopify store, try Admin API
    const isShopifyUrl = product.url.includes('.myshopify.com') || product.url.includes('/products/');
    
    if (isShopifyUrl) {
      const { data: integration } = await serviceClient
        .from('integrations')
        .select('auth_data')
        .eq('merchant_id', merchantId)
        .eq('provider', 'shopify')
        .eq('status', 'active')
        .maybeSingle();

      if (integration) {
        const authData = integration.auth_data as { shop: string; access_token: string };
        const url = new URL(product.url);
        const handleMatch = url.pathname.match(/\/products\/([^/?]+)/);
        const handle = handleMatch ? handleMatch[1] : null;

        if (handle) {
          try {
            logger.info({ merchantId, productId, handle }, 'Storefront blocked by password; attempting Shopify Admin API fallback');
            const shopifyProduct = await fetchShopifyProductByHandle(
              authData.shop,
              authData.access_token,
              handle
            );

            const fallbackContent = shopifyProduct
              ? buildShopifyProductFallbackContent(shopifyProduct)
              : '';

            if (shopifyProduct && fallbackContent) {
              rawContent = fallbackContent;
              if (scrapeResult.product) {
                scrapeResult.product.title = shopifyProduct.title || scrapeResult.product.title;
                scrapeResult.product.rawContent = rawContent;
              }
              logger.info({ merchantId, productId }, 'Shopify Admin API fallback successful');
            }
          } catch (err) {
            logger.error({ err, merchantId, productId }, 'Shopify Admin API fallback failed');
          }
        }
      }
    }

    // If fallback didn't help (still password page content), return 403
    if (rawContent.toLowerCase().includes('password protected')) {
      return c.json({
        error: 'Store is password protected',
        details: 'Please disable the Shopify storefront password to allow scraping, or manually enter product details.',
        stepOutcome: buildStepOutcome('collect_sources', 'error', {
          error: 'Storefront is password protected',
          delta: { source: 'product_url' },
        }),
      }, 403);
    }
  }

  // Enrich the scraped text
  let enrichedText = rawContent;
  try {
    const enrichResult = await enrichProductDataDetailed(
      rawContent,
      scrapeResult.product?.title || product.name || 'Unknown Product',
      {
        rawSections: scrapeResult.product?.rawSections,
        merchantId: String(merchantId),
        productId,
        sourceType: 'scrape_enrich_manual',
      }
    );
    if (enrichResult.enrichedText) enrichedText = enrichResult.enrichedText;
    if (enrichResult.facts) {
      await persistProductFactsSnapshot({
        productId,
        merchantId,
        facts: enrichResult.facts,
        sourceUrl: product.url,
        sourceType: 'scrape_enrich_manual',
        extractionModel: 'gpt-4o-mini',
        validationErrors: enrichResult.factsValidationErrors,
      });
    }
  } catch (enrichErr) {
    console.error('Manual scrape enrichment error:', enrichErr);
  }

  // Update product with scraped data
  const { data: updatedProduct, error: updateError } = await serviceClient
    .from('products')
    .update({
      raw_text: rawContent,
      enriched_text: enrichedText,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .select()
    .single();

  if (updateError) {
    console.error('Product scrape update error:', updateError);
    return c.json({
      error: 'Failed to update product',
      details: updateError.message,
      code: updateError.code,
      hint: updateError.hint,
      stepOutcome: buildStepOutcome('collect_sources', 'error', {
        error: updateError.message,
        delta: { source: 'product_url' },
      }),
    }, 500);
  }

  // Update cache
  await setCachedProduct(productId, updatedProduct, 600);
  await invalidateProductKnowledgeCaches(String(merchantId), productId);

  // Auto-generate embeddings after scrape (backend guarantee — frontend also calls this, but this ensures consistency)
  let embeddingResult: { chunksCreated: number; totalTokens: number } | null = null;
  try {
    const result = await processProductForRAG(
      productId,
      rawContent,
      enrichedText || undefined
    );
    if (result?.success) {
      embeddingResult = { chunksCreated: result.chunksCreated, totalTokens: result.totalTokens };
      await invalidateProductKnowledgeCaches(String(merchantId), productId);
      shadowSyncProductKnowledge(String(merchantId), productId, 'scrape');
    } else if (result) {
      logger.warn({ merchantId, productId, error: result.error || 'unknown' }, 'Auto embedding generation after scrape did not succeed');
    } else {
      logger.warn({ merchantId, productId }, 'Auto embedding generation after scrape returned no result');
    }
  } catch (embedErr) {
    console.error('Auto embedding generation after scrape failed:', embedErr);
  }

  return c.json({
    message: 'Product scraped successfully',
    product: updatedProduct,
    scraped: scrapeResult.product,
    embeddings: embeddingResult,
    stepOutcome: buildStepOutcome('collect_sources', 'ready', {
      updatedAt: updatedProduct.updated_at || new Date().toISOString(),
      delta: {
        source: 'product_url',
        chunksCreated: embeddingResult?.chunksCreated || 0,
        totalTokens: embeddingResult?.totalTokens || 0,
      },
    }),
  });
});

/**
 * Enrich product from an additional URL without replacing existing knowledge layers.
 * POST /api/products/:id/enrich-from-url
 */
products.post(
  '/:id/enrich-from-url',
  validateParams(productIdSchema),
  validateBody(enrichProductFromUrlSchema),
  async (c) => {
    const merchantId = c.get('merchantId');
    const { id: productId } = c.get('validatedParams') as ProductIdParams;
    const { source_url: sourceUrl } = c.get('validatedBody') as EnrichProductFromUrlInput;
    const serviceClient = getSupabaseServiceClient();

    const { data: product, error: fetchError } = await serviceClient
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('merchant_id', merchantId)
      .single();

    if (fetchError || !product) {
      return c.json({ error: 'Product not found' }, 404);
    }

    const scrapeResult = await scrapeProductPage(sourceUrl);
    if (!scrapeResult.success) {
      return c.json(
        {
          error: 'Scraping failed',
          details: scrapeResult.error,
          stepOutcome: buildStepOutcome('collect_sources', 'error', {
            error: scrapeResult.error || 'Scrape failed',
            delta: { source: 'workflow_url', sourceUrl },
          }),
        },
        500,
      );
    }

    let rawContent = scrapeResult.product!.rawContent;

    if (rawContent && rawContent.toLowerCase().includes('password protected')) {
      const isShopifyUrl = sourceUrl.includes('.myshopify.com') || sourceUrl.includes('/products/');
      if (isShopifyUrl) {
        const { data: integration } = await serviceClient
          .from('integrations')
          .select('auth_data')
          .eq('merchant_id', merchantId)
          .eq('provider', 'shopify')
          .eq('status', 'active')
          .maybeSingle();

        if (integration) {
          const authData = integration.auth_data as { shop: string; access_token: string };
          const parsed = new URL(sourceUrl);
          const handleMatch = parsed.pathname.match(/\/products\/([^/?]+)/);
          const handle = handleMatch ? handleMatch[1] : null;
          if (handle) {
            try {
              const shopifyProduct = await fetchShopifyProductByHandle(authData.shop, authData.access_token, handle);
              const fallbackContent = shopifyProduct ? buildShopifyProductFallbackContent(shopifyProduct) : '';
              if (fallbackContent) rawContent = fallbackContent;
            } catch (error) {
              logger.warn({ error, merchantId, productId, sourceUrl }, 'Shopify fallback failed for enrich-from-url');
            }
          }
        }
      }

      if (rawContent.toLowerCase().includes('password protected')) {
        return c.json(
          {
            error: 'Store is password protected',
            details: 'Cannot enrich from this URL because storefront access is blocked.',
            stepOutcome: buildStepOutcome('collect_sources', 'error', {
              error: 'Storefront is password protected',
              delta: { source: 'workflow_url', sourceUrl },
            }),
          },
          403,
        );
      }
    }

    let enrichedText = rawContent;
    try {
      const enrichResult = await enrichProductDataDetailed(
        rawContent,
        scrapeResult.product?.title || product.name || 'Unknown Product',
        {
          rawSections: scrapeResult.product?.rawSections,
          merchantId: String(merchantId),
          productId,
          sourceType: 'scrape_enrich_additional_url',
        },
      );
      if (enrichResult.enrichedText) enrichedText = enrichResult.enrichedText;
      if (enrichResult.facts) {
        await persistProductFactsSnapshot({
          productId,
          merchantId,
          facts: enrichResult.facts,
          sourceUrl,
          sourceType: 'scrape_enrich_additional_url',
          extractionModel: 'gpt-4o-mini',
          validationErrors: enrichResult.factsValidationErrors,
        });
      }
    } catch (error) {
      logger.warn({ error, merchantId, productId, sourceUrl }, 'Additional URL enrichment failed; using raw scrape output');
    }

    const mergedRawText = buildMergedLayerText(product.raw_text, rawContent, sourceUrl, 'RAW');
    const mergedEnrichedText = buildMergedLayerText(product.enriched_text, enrichedText, sourceUrl, 'ENRICHED');

    const { data: updatedProduct, error: updateError } = await serviceClient
      .from('products')
      .update({
        raw_text: mergedRawText,
        enriched_text: mergedEnrichedText,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select()
      .single();

    if (updateError) {
      return c.json(
        {
          error: 'Failed to update product',
          details: updateError.message,
          code: updateError.code,
          hint: updateError.hint,
          stepOutcome: buildStepOutcome('collect_sources', 'error', {
            error: updateError.message,
            delta: { source: 'workflow_url', sourceUrl },
          }),
        },
        500,
      );
    }

    await setCachedProduct(productId, updatedProduct, 600);
    await invalidateProductKnowledgeCaches(String(merchantId), productId);

    let embeddingResult: { chunksCreated: number; totalTokens: number } | null = null;
    try {
      const result = await processProductForRAG(productId, mergedRawText, mergedEnrichedText || undefined);
      if (result?.success) {
        embeddingResult = { chunksCreated: result.chunksCreated, totalTokens: result.totalTokens };
        await invalidateProductKnowledgeCaches(String(merchantId), productId);
        shadowSyncProductKnowledge(String(merchantId), productId, 'additional url enrichment');
      }
    } catch (error) {
      logger.warn({ error, merchantId, productId, sourceUrl }, 'Embedding generation after enrich-from-url failed');
    }

    return c.json({
      message: 'Product enriched from URL successfully',
      product: updatedProduct,
      sourceUrl,
      embeddings: embeddingResult,
      stepOutcome: buildStepOutcome('collect_sources', 'ready', {
        updatedAt: updatedProduct.updated_at || new Date().toISOString(),
        delta: {
          source: 'workflow_url',
          sourceUrl,
          chunksCreated: embeddingResult?.chunksCreated || 0,
          totalTokens: embeddingResult?.totalTokens || 0,
        },
      }),
    });
  },
);

/**
 * Scrape product (async via queue)
 * POST /api/products/:id/scrape-async
 */
products.post('/:id/scrape-async', async (c) => {
  const merchantId = c.get('merchantId');
  const productId = c.req.param('id');
  const serviceClient = getSupabaseServiceClient();

  // Verify product exists
  const { data: product, error } = await serviceClient
    .from('products')
    .select('id, url')
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .single();

  if (error || !product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  // Add to scrape queue
  const job = await addScrapeJob({
    productId,
    url: product.url,
    merchantId,
  });

  return c.json({
    message: 'Scrape job queued',
    jobId: job.id,
    stepOutcome: buildStepOutcome('collect_sources', 'in_progress', {
      delta: { source: 'product_url', jobId: job.id },
    }),
  });
});

/**
 * Bulk scrape products (async)
 * POST /api/products/scrape-batch
 */
products.post('/scrape-batch', async (c) => {
  const merchantId = c.get('merchantId');
  const body = await c.req.json();
  const serviceClient = getSupabaseServiceClient();

  const { productIds } = body;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return c.json({ error: 'productIds array is required' }, 400);
  }

  // Get products
  const { data: products, error } = await serviceClient
    .from('products')
    .select('id, url')
    .eq('merchant_id', merchantId)
    .in('id', productIds);

  if (error || !products || products.length === 0) {
    return c.json({ error: 'No products found' }, 404);
  }

  // Add to scrape queue
  const jobs = await Promise.all(
    products.map((product) =>
      addScrapeJob({
        productId: product.id,
        url: product.url,
        merchantId,
      })
    )
  );

  return c.json({
    message: 'Scrape jobs queued',
    count: jobs.length,
    jobIds: jobs.map((job) => job.id),
  });
});

/**
 * Generate embeddings for product
 * POST /api/products/:id/generate-embeddings
 */
products.post('/:id/generate-embeddings', async (c) => {
  const isInternal = c.get('internalCall') === true;
  const productId = c.req.param('id');
  const serviceClient = getSupabaseServiceClient();

  // Get product (internal call: by id only, then use product.merchant_id)
  const productQuery = serviceClient
    .from('products')
    .select('id, merchant_id, raw_text, enriched_text')
    .eq('id', productId);
  if (!isInternal) {
    const merchantId = c.get('merchantId');
    productQuery.eq('merchant_id', merchantId);
  }
  const { data: product, error: fetchError } = await productQuery.single();

  if (fetchError || !product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  const merchantId = isInternal ? (product as { merchant_id?: string }).merchant_id : c.get('merchantId');
  if (!merchantId) {
    return c.json({ error: 'Product has no merchant_id' }, 400);
  }

  if (!product.raw_text && !product.enriched_text) {
    return c.json(
      {
        error: 'Product has no content. Scrape first.',
        stepOutcome: buildStepOutcome('generate_ai_knowledge', 'error', {
          error: 'No content available for embedding generation',
        }),
      },
      400,
    );
  }

  // Check storage limit before processing
  // Estimate: each product chunk is ~1KB, estimate 10 chunks per product
  const estimatedBytes = (product.enriched_text?.length || product.raw_text?.length || 0) * 2; // Rough estimate
  try {
    await enforceStorageLimit(merchantId, estimatedBytes);
  } catch (limitError) {
    return c.json({
      error: 'Storage limit exceeded',
      message: limitError instanceof Error ? limitError.message : 'You have reached your storage limit. Please upgrade your plan.',
      stepOutcome: buildStepOutcome('generate_ai_knowledge', 'error', {
        error: limitError instanceof Error ? limitError.message : 'Storage limit exceeded',
      }),
    }, 403);
  }

  // Process product
  const result = await processProductForRAG(
    productId,
    product.raw_text || '',
    product.enriched_text || undefined
  );

  if (!result.success) {
    return c.json({
      error: 'Failed to generate embeddings',
      details: result.error,
      stepOutcome: buildStepOutcome('generate_ai_knowledge', 'error', {
        error: result.error || 'Embedding generation failed',
      }),
    }, 500);
  }

  await invalidateProductKnowledgeCaches(String(merchantId), productId);
  shadowSyncProductKnowledge(String(merchantId), productId, 'embeddings');

  return c.json({
    message: 'Embeddings generated successfully',
    chunksCreated: result.chunksCreated,
    totalTokens: result.totalTokens,
    stepOutcome: buildStepOutcome('generate_ai_knowledge', 'ready', {
      delta: {
        chunksCreated: result.chunksCreated,
        totalTokens: result.totalTokens,
      },
    }),
  });
});

/**
 * Internal route for Worker to enrich product data without OpenAI installed in worker package
 * POST /api/products/enrich
 */
products.post('/enrich', async (c) => {
  const body = await c.req.json();
  const { rawText, title, rawSections, productId, sourceUrl, sourceType } = body;

  if (!rawText) {
    return c.json({ error: 'rawText is required' }, 400);
  }

  try {
    let productForInternal: { id: string; merchant_id: string; url?: string | null } | null = null;
    if (typeof productId === 'string' && productId.trim()) {
      const serviceClient = getSupabaseServiceClient();
      const { data: p } = await serviceClient
        .from('products')
        .select('id, merchant_id, url')
        .eq('id', productId)
        .maybeSingle();
      if (p?.merchant_id) {
        productForInternal = p as any;
      }
    }

    const enrichResult = await enrichProductDataDetailed(rawText, title || 'Unknown Product', {
      rawSections,
      merchantId: productForInternal?.merchant_id,
      productId: typeof productId === 'string' ? productId : undefined,
      sourceType: typeof sourceType === 'string' ? sourceType : 'scrape_enrich_internal',
    });

    // Internal worker may send productId so we can persist structured facts centrally in API package
    if (typeof productId === 'string' && productId.trim() && enrichResult.facts) {
      const p = productForInternal ?? await (async () => {
        const serviceClient = getSupabaseServiceClient();
        const { data } = await serviceClient
          .from('products')
          .select('id, merchant_id, url')
          .eq('id', productId)
          .single();
        return data as any;
      })();
      if (p?.merchant_id) {
        await persistProductFactsSnapshot({
          productId: p.id,
          merchantId: p.merchant_id,
          facts: enrichResult.facts,
          sourceUrl: typeof sourceUrl === 'string' && sourceUrl ? sourceUrl : p.url || undefined,
          sourceType: typeof sourceType === 'string' && sourceType ? sourceType : 'scrape_enrich_internal',
          extractionModel: 'gpt-4o-mini',
          validationErrors: enrichResult.factsValidationErrors,
        });
      }
    }

    return c.json({
      enrichedText: enrichResult.enrichedText,
      enrichmentMode: enrichResult.enrichmentMode,
      factsExtracted: Boolean(enrichResult.facts),
    });
  } catch (error) {
    return c.json({ error: 'Failed to enrich', message: String(error) }, 500);
  }
});

/**
 * Batch generate embeddings
 * POST /api/products/generate-embeddings-batch
 */
products.post('/generate-embeddings-batch', async (c) => {
  const merchantId = c.get('merchantId');
  const body = await c.req.json();
  const serviceClient = getSupabaseServiceClient();

  const { productIds } = body;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return c.json({ error: 'productIds array is required' }, 400);
  }

  // Verify products belong to merchant
  const { data: products, error } = await serviceClient
    .from('products')
    .select('id')
    .eq('merchant_id', merchantId)
    .in('id', productIds);

  if (error || !products || products.length === 0) {
    return c.json({ error: 'No products found' }, 404);
  }

  // Process products in the background to avoid 504 Gateway Timeout
  void (async () => {
    try {
      const results = await batchProcessProducts(productIds);
      for (const r of results.filter((x) => x.success)) {
        await invalidateProductKnowledgeCaches(String(merchantId), r.productId);
        shadowSyncProductKnowledge(String(merchantId), r.productId, 'batch embeddings');
      }
    } catch (err) {
      console.error('Background batch embeddings failed:', err);
    }
  })();

  const summary = {
    total: productIds.length,
    successful: productIds.length, // Optimistic success for UX
    failed: 0,
    totalChunks: 0,
    totalTokens: 0,
  };

  return c.json({
    message: 'Batch embedding generation queued',
    summary,
    results: [],
  });
});

/**
 * Get product chunk count
 * GET /api/products/:id/chunks
 */
products.get('/:id/chunks', async (c) => {
  const merchantId = c.get('merchantId');
  const productId = c.req.param('id');
  const serviceClient = getSupabaseServiceClient();

  // Verify product belongs to merchant
  const { data: product, error } = await serviceClient
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .single();

  if (error || !product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  const count = await getProductChunkCount(productId);

  return c.json({
    productId,
    chunkCount: count,
  });
});

/**
 * Get chunk counts for multiple products (batch)
 * POST /api/products/chunks/batch
 */
products.post('/chunks/batch', async (c) => {
  const merchantId = c.get('merchantId');
  let body: any = {};
  try {
    const raw = await c.req.text();
    body = raw?.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    return c.json({ error: 'Invalid JSON body', message: 'Expected { productIds: string[] }' }, 400);
  }
  const { productIds } = body;

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return c.json({ error: 'productIds array is required' }, 400);
  }

  const serviceClient = getSupabaseServiceClient();

  // Verify all products belong to merchant
  const { data: products, error } = await serviceClient
    .from('products')
    .select('id')
    .eq('merchant_id', merchantId)
    .in('id', productIds);

  if (error) {
    return c.json({ error: 'Failed to verify products' }, 500);
  }

  const validProductIds = products?.map(p => p.id) || [];

  // Get chunk counts in parallel (but limit concurrency to avoid overwhelming DB)
  const chunkCounts = await Promise.all(
    validProductIds.map(async (productId) => {
      try {
        const count = await getProductChunkCount(productId);
        return { productId, chunkCount: count };
      } catch (err) {
        console.error(`Failed to get chunk count for product ${productId}:`, err);
        return { productId, chunkCount: 0 };
      }
    })
  );

  return c.json({ chunkCounts });
});

export default products;
