/**
 * Cache Middleware
 * Adds caching layer to API responses
 */

import { Context, Next } from 'hono';
import { getCachedApiResponse, setCachedApiResponse } from '../lib/cache';

/**
 * Cache middleware for GET requests
 * Caches successful responses based on path and query params
 */
export async function cacheMiddleware(c: Context, next: Next) {
  // Only cache GET requests
  if (c.req.method !== 'GET') {
    await next();
    return;
  }

  const path = c.req.path;
  const query = c.req.query();
  
  // Skip caching for certain paths
  if (path.startsWith('/health') || path.startsWith('/metrics') || path.startsWith('/api/docs')) {
    await next();
    return;
  }

  // Try to get from cache
  const cached = await getCachedApiResponse(path, query);
  if (cached) {
    return c.json(cached, 200);
  }

  // Continue to handler
  await next();

  // Cache successful responses (status 200)
  if (c.res.status === 200) {
    const response = await c.res.clone().json().catch(() => null);
    if (response) {
      // Cache for 1 minute
      await setCachedApiResponse(path, response, 60, query);
    }
  }
}
