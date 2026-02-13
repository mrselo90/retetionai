/**
 * Metrics Middleware
 * Tracks HTTP request metrics for Prometheus
 */

import { Context, Next } from 'hono';
import { httpRequestDuration, httpRequestTotal, httpRequestErrors } from '../lib/metrics.js';
import { incrementApiCallCount } from '../lib/usageTracking.js';

/**
 * Metrics middleware
 * Tracks request duration, count, and errors
 */
export async function metricsMiddleware(c: Context, next: Next) {
  const startTime = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  
  // Normalize route path (remove IDs, etc.)
  const route = normalizeRoute(path);
  
  try {
    await next();
    
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const statusCode = c.res.status;
    
    // Record metrics
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    httpRequestTotal.inc({ method, route, status_code: statusCode });
    
    // Track errors (4xx, 5xx)
    if (statusCode >= 400) {
      const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
      httpRequestErrors.inc({ method, route, error_type: errorType });
    }
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    const statusCode = c.res.status || 500;
    
    // Record error metrics
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    httpRequestTotal.inc({ method, route, status_code: statusCode });
    httpRequestErrors.inc({ 
      method, 
      route, 
      error_type: error instanceof Error ? error.name : 'unknown_error' 
    });
    
    throw error;
  }
}

/**
 * Normalize route path for metrics
 * Replaces UUIDs and IDs with placeholders
 */
function normalizeRoute(path: string): string {
  // Replace UUIDs
  let normalized = path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );
  
  // Replace numeric IDs
  normalized = normalized.replace(/\/\d+/g, '/:id');
  
  // Replace hash-like strings (API keys, etc.)
  normalized = normalized.replace(/\/[a-zA-Z0-9]{32,}/g, '/:hash');
  
  return normalized;
}
