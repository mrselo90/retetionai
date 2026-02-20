/**
 * Product management routes
 * CRUD operations and scraping
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseServiceClient } from '@recete/shared';
import { scrapeProductPage } from '../lib/scraper.js';
import { addScrapeJob } from '../queues.js';
import { processProductForRAG, batchProcessProducts, getProductChunkCount } from '../lib/knowledgeBase.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { createProductSchema, updateProductSchema, productIdSchema, productInstructionSchema, CreateProductInput, UpdateProductInput, ProductIdParams, ProductInstructionInput } from '../schemas/products.js';
import { getCachedProduct, setCachedProduct } from '../lib/cache.js';
import { enforceStorageLimit } from '../lib/planLimits.js';

const products = new Hono();

// All routes require authentication
products.use('/*', authMiddleware);

/**
 * List products
 * GET /api/products
 */
products.get('/', async (c) => {
  const merchantId = c.get('merchantId');
  const serviceClient = getSupabaseServiceClient();

  const { data: products, error } = await serviceClient
    .from('products')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  if (error) {
    return c.json({ error: 'Failed to fetch products' }, 500);
  }

  return c.json({ products });
});

/**
 * List product instructions for merchant (for UI)
 * GET /api/products/instructions/list
 * Must be before /:id to avoid "instructions" as id
 */
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

  return c.json({ instruction });
});

/**
 * Get single product
 * GET /api/products/:id
 */
products.get('/:id', async (c) => {
  const merchantId = c.get('merchantId');
  const productId = c.req.param('id');

  // Try cache first
  const cached = await getCachedProduct(productId) as any;
  if (cached && cached.merchant_id) {
    // Verify it belongs to this merchant
    if (cached.merchant_id === merchantId) {
      return c.json({ product: cached });
    }
  }

  const serviceClient = getSupabaseServiceClient();

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

  return c.json({ product });
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
    return c.json({ error: 'Failed to delete product' }, 500);
  }

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
    }, 500);
  }

  // Update product with scraped data
  const { data: updatedProduct, error: updateError } = await serviceClient
    .from('products')
    .update({
      raw_text: scrapeResult.product!.rawContent,
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
      hint: updateError.hint
    }, 500);
  }

  // Update cache
  await setCachedProduct(productId, updatedProduct, 600);

  return c.json({
    message: 'Product scraped successfully',
    product: updatedProduct,
    scraped: scrapeResult.product,
  });
});

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
  const merchantId = c.get('merchantId');
  const productId = c.req.param('id');
  const serviceClient = getSupabaseServiceClient();

  // Get product
  const { data: product, error: fetchError } = await serviceClient
    .from('products')
    .select('id, raw_text')
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .single();

  if (fetchError || !product) {
    return c.json({ error: 'Product not found' }, 404);
  }

  if (!product.raw_text) {
    return c.json({ error: 'Product has no content. Scrape first.' }, 400);
  }

  // Check storage limit before processing
  // Estimate: each product chunk is ~1KB, estimate 10 chunks per product
  const estimatedBytes = product.raw_text.length * 2; // Rough estimate
  try {
    await enforceStorageLimit(merchantId, estimatedBytes);
  } catch (limitError) {
    return c.json({
      error: 'Storage limit exceeded',
      message: limitError instanceof Error ? limitError.message : 'You have reached your storage limit. Please upgrade your plan.',
    }, 403);
  }

  // Process product
  const result = await processProductForRAG(productId, product.raw_text);

  if (!result.success) {
    return c.json({
      error: 'Failed to generate embeddings',
      details: result.error,
    }, 500);
  }

  return c.json({
    message: 'Embeddings generated successfully',
    chunksCreated: result.chunksCreated,
    totalTokens: result.totalTokens,
  });
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

  // Process products
  const results = await batchProcessProducts(productIds);

  const summary = {
    total: results.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    totalChunks: results.reduce((sum, r) => sum + r.chunksCreated, 0),
    totalTokens: results.reduce((sum, r) => sum + r.totalTokens, 0),
  };

  return c.json({
    message: 'Batch embedding generation completed',
    summary,
    results,
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
  const body = await c.req.json();
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
