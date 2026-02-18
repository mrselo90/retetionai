/**
 * Product Endpoints Integration Tests
 * Tests for product management endpoints
 */

// IMPORTANT: Import middleware mocks BEFORE importing routes
import './middleware-mocks';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import productsRoutes from '../../routes/products';
import { mockSupabaseClient } from '../mocks';
import { createTestApp, testRequest, setupAuthenticatedContext } from './setup';
import { createTestDatabase } from './db-setup';
import { getSupabaseServiceClient } from '@recete/shared';

// Mock dependencies
vi.mock('../../lib/scraper', () => ({
  scrapeProductPage: vi.fn(),
}));

vi.mock('../../queues', () => ({
  addScrapeJob: vi.fn(),
}));

vi.mock('../../lib/knowledgeBase', () => ({
  processProductForRAG: vi.fn(),
  batchProcessProducts: vi.fn(),
  getProductChunkCount: vi.fn(),
}));

vi.mock('../../lib/planLimits', () => ({
  enforceStorageLimit: vi.fn(),
}));

import { scrapeProductPage } from '../../lib/scraper';
import { addScrapeJob } from '../../queues';
import { processProductForRAG, batchProcessProducts, getProductChunkCount } from '../../lib/knowledgeBase';
import { enforceStorageLimit } from '../../lib/planLimits';

describe('Products Endpoints', () => {
  let app: Hono;
  let testDb: ReturnType<typeof createTestDatabase>;
  let merchant: any;

  beforeEach(() => {
    app = createTestApp();
    app.route('/api/products', productsRoutes);
    testDb = createTestDatabase();
    merchant = setupAuthenticatedContext('test-merchant-id');
    vi.clearAllMocks();
    mockSupabaseClient.__reset();
  });

  it('should list products', async () => {
    const product1 = await testDb.createProduct('test-merchant-id', { name: 'Product 1' });
    const product2 = await testDb.createProduct('test-merchant-id', { name: 'Product 2' });

    // Mock Supabase response for list
    mockSupabaseClient.from('products').select().eq().order.mockResolvedValue({
      data: [product1, product2],
      error: null
    });

    const response = await testRequest(app, 'GET', '/api/products', {
      merchantId: 'test-merchant-id',
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('products');
    expect(response.data.products).toHaveLength(2);
  });

  it('should get product by ID', async () => {
    const product = await testDb.createProduct('test-merchant-id', { name: 'Test Product' });

    // Mock cache miss (Redis returns null)
    const { mockRedisClient } = await import('../mocks');
    mockRedisClient.get.mockResolvedValue(null);

    mockSupabaseClient.from('products').select().eq().eq().single.mockResolvedValue({
      data: product,
      error: null
    });

    const response = await testRequest(app, 'GET', `/api/products/${product.id}`, {
      merchantId: 'test-merchant-id',
    });

    expect(response.status).toBe(200);
    expect(response.data.product).toEqual(product);
  });

  it('should create product', async () => {
    const newProduct = {
      id: 'new-product-id',
      merchant_id: 'test-merchant-id',
      name: 'New Product',
      url: 'https://example.com/product',
      created_at: new Date().toISOString(),
    };

    mockSupabaseClient.from('products').insert().select().single.mockResolvedValue({
      data: newProduct,
      error: null
    });

    // Mock cache set
    const { mockRedisClient } = await import('../mocks');
    mockRedisClient.setex.mockResolvedValue('OK');

    const response = await testRequest(app, 'POST', '/api/products', {
      merchantId: 'test-merchant-id',
      body: {
        name: 'New Product',
        url: 'https://example.com/product',
      },
    });

    expect(response.status).toBe(201);
    expect(response.data.product).toEqual(newProduct);
  });

  it('should update product', async () => {
    const product = await testDb.createProduct('test-merchant-id', { name: 'Original Name' });
    const updatedProduct = { ...product, name: 'Updated Name' };

    mockSupabaseClient.from('products').select().eq().eq().single.mockResolvedValue({
      data: product,
      error: null
    });

    mockSupabaseClient.from('products').update().eq().select().single.mockResolvedValue({
      data: updatedProduct,
      error: null
    });

    const response = await testRequest(app, 'PUT', `/api/products/${product.id}`, {
      merchantId: 'test-merchant-id',
      body: { name: 'Updated Name' },
    });

    expect(response.status).toBe(200);
    expect(response.data.product.name).toBe('Updated Name');
  });

  it('should delete product', async () => {
    const product = await testDb.createProduct('test-merchant-id');

    mockSupabaseClient.from('products').select().eq().eq().single.mockResolvedValue({
      data: product,
      error: null
    });

    // delete returns null data on success, we check for error: null
    // Assuming default mock handles delete().eq() returning success

    const response = await testRequest(app, 'DELETE', `/api/products/${product.id}`, {
      merchantId: 'test-merchant-id',
    });

    expect(response.status).toBe(200);
    expect(response.data.message).toBe('Product deleted');
  });

  // --- New Tests for Missing Endpoints ---

  describe('Scraping Endpoints', () => {
    it('should scrape product immediately', async () => {
      const product = await testDb.createProduct('test-merchant-id', { url: 'http://example.com' });

      mockSupabaseClient.from('products').select().eq().eq().single.mockResolvedValue({
        data: product,
        error: null
      });

      (scrapeProductPage as any).mockResolvedValue({
        success: true,
        product: { rawContent: 'Scraped Content' }
      });

      mockSupabaseClient.from('products').update().eq().select().single.mockResolvedValue({
        data: { ...product, raw_text: 'Scraped Content' },
        error: null
      });

      const response = await testRequest(app, 'POST', `/api/products/${product.id}/scrape`, {
        merchantId: 'test-merchant-id'
      });

      expect(response.status).toBe(200);
      expect(scrapeProductPage).toHaveBeenCalledWith(product.url);
      expect(response.data.product.raw_text).toBe('Scraped Content');
    });

    it('should queue async scrape job', async () => {
      const product = await testDb.createProduct('test-merchant-id', { url: 'http://example.com' });

      mockSupabaseClient.from('products').select().eq().eq().single.mockResolvedValue({
        data: product,
        error: null
      });

      (addScrapeJob as any).mockResolvedValue({ id: 'job-123' });

      const response = await testRequest(app, 'POST', `/api/products/${product.id}/scrape-async`, {
        merchantId: 'test-merchant-id'
      });

      expect(response.status).toBe(200);
      expect(addScrapeJob).toHaveBeenCalledWith(expect.objectContaining({
        productId: product.id,
        url: product.url
      }));
      expect(response.data.jobId).toBe('job-123');
    });
  });

  describe('Embeddings Endpoints', () => {
    it('should generate embeddings', async () => {
      const product = await testDb.createProduct('test-merchant-id', { raw_text: 'Content' });

      mockSupabaseClient.from('products').select().eq().eq().single.mockResolvedValue({
        data: product,
        error: null
      });

      (processProductForRAG as any).mockResolvedValue({
        success: true,
        chunksCreated: 5,
        totalTokens: 100
      });

      const response = await testRequest(app, 'POST', `/api/products/${product.id}/generate-embeddings`, {
        merchantId: 'test-merchant-id'
      });

      expect(response.status).toBe(200);
      expect(processProductForRAG).toHaveBeenCalledWith(product.id, 'Content');
      expect(enforceStorageLimit).toHaveBeenCalled();
      expect(response.data.chunksCreated).toBe(5);
    });
  });

  describe('Instruction Endpoints', () => {
    it('should list instructions', async () => {
      mockSupabaseClient.from('product_instructions').select().eq.mockResolvedValue({
        data: [
          { product_id: 'p1', usage_instructions: 'Use it', products: { name: 'P1' } }
        ],
        error: null
      });

      const response = await testRequest(app, 'GET', '/api/products/instructions/list', {
        merchantId: 'test-merchant-id'
      });

      expect(response.status).toBe(200);
      expect(response.data.instructions).toHaveLength(1);
      expect(response.data.instructions[0].product_name).toBe('P1');
    });

    it('should create usage instruction', async () => {
      const product = await testDb.createProduct('test-merchant-id');

      mockSupabaseClient.from('products').select().eq().eq().single.mockResolvedValue({
        data: product,
        error: null
      });

      mockSupabaseClient.from('product_instructions').upsert().select().single.mockResolvedValue({
        data: { product_id: product.id, usage_instructions: 'New Instructions' },
        error: null
      });

      const response = await testRequest(app, 'PUT', `/api/products/${product.id}/instruction`, {
        merchantId: 'test-merchant-id',
        body: { usage_instructions: 'New Instructions' }
      });

      expect(response.status).toBe(200);
      expect(response.data.instruction.usage_instructions).toBe('New Instructions');
    });
  });
});
