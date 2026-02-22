/**
 * RAG (Retrieval Augmented Generation) routes
 * Semantic search over product knowledge base
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/billingMiddleware.js';
import { queryKnowledgeBase, formatRAGResultsForLLM, getOrderProductContext } from '../lib/rag.js';
import { getCachedRAGQuery, setCachedRAGQuery } from '../lib/cache.js';

const rag = new Hono();

// All routes require authentication
rag.use('/*', authMiddleware);
rag.use('/*', requireActiveSubscription as any);

/**
 * Query knowledge base (semantic search)
 * POST /api/rag/query
 */
rag.post('/query', async (c) => {
  const merchantId = c.get('merchantId');
  const body = await c.req.json();

  const {
    query,
    productIds,
    topK = 5,
    similarityThreshold = 0.7,
    format = 'json', // 'json' or 'text' (for LLM)
  } = body;

  if (!query || typeof query !== 'string') {
    return c.json({ error: 'query is required and must be a string' }, 400);
  }

  if (topK && (typeof topK !== 'number' || topK < 1 || topK > 50)) {
    return c.json({ error: 'topK must be a number between 1 and 50' }, 400);
  }

  if (
    similarityThreshold &&
    (typeof similarityThreshold !== 'number' ||
      similarityThreshold < 0 ||
      similarityThreshold > 1)
  ) {
    return c.json(
      { error: 'similarityThreshold must be a number between 0 and 1' },
      400
    );
  }

  try {
    // Try cache first (1 hour TTL for RAG queries)
    const cacheKey = productIds && productIds.length > 0
      ? `${merchantId}:${productIds.join(',')}:${query}`
      : `${merchantId}:${query}`;
    const cached = await getCachedRAGQuery(cacheKey, merchantId);
    if (cached) {
      if (format === 'text') {
        const formattedText = formatRAGResultsForLLM(cached.results);
        return c.json({
          query,
          context: formattedText,
          totalResults: cached.totalResults,
          executionTime: 0,
          cached: true,
        });
      }
      return c.json({
        query,
        results: cached.results,
        totalResults: cached.totalResults,
        executionTime: 0,
        cached: true,
      });
    }

    const result = await queryKnowledgeBase({
      merchantId,
      query,
      productIds,
      topK,
      similarityThreshold,
    });

    // Cache the result (1 hour)
    await setCachedRAGQuery(cacheKey, merchantId, {
      results: result.results,
      totalResults: result.totalResults,
    }, 3600);

    if (format === 'text') {
      // Return formatted text for LLM
      const formattedText = formatRAGResultsForLLM(result.results);
      return c.json({
        query: result.query,
        context: formattedText,
        totalResults: result.totalResults,
        executionTime: result.executionTime,
      });
    }

    // Return JSON
    return c.json(result);
  } catch (error) {
    console.error('RAG query error:', error);
    return c.json(
      {
        error: 'Failed to query knowledge base',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Get product context for an order
 * GET /api/rag/order/:orderId/context
 */
rag.get('/order/:orderId/context', async (c) => {
  const merchantId = c.get('merchantId');
  const orderId = c.req.param('orderId');

  try {
    const context = await getOrderProductContext(orderId);

    return c.json({
      orderId,
      totalChunks: context.length,
      products: Array.from(
        new Set(context.map((c) => ({ id: c.productId, name: c.productName })))
      ),
      chunks: context,
    });
  } catch (error) {
    console.error('Get order context error:', error);
    return c.json(
      {
        error: 'Failed to get order context',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Test RAG endpoint (for development)
 * POST /api/rag/test
 */
rag.post('/test', async (c) => {
  const merchantId = c.get('merchantId');
  const body = await c.req.json();

  const { query, topK = 3 } = body;

  if (!query) {
    return c.json({ error: 'query is required' }, 400);
  }

  try {
    // Query with lower threshold for testing
    const result = await queryKnowledgeBase({
      merchantId,
      query,
      topK,
      similarityThreshold: 0.5,
    });

    // Format for LLM
    const formattedText = formatRAGResultsForLLM(result.results);

    return c.json({
      query: result.query,
      results: result.results,
      formattedContext: formattedText,
      executionTime: result.executionTime,
    });
  } catch (error) {
    console.error('RAG test error:', error);
    return c.json(
      {
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default rag;
