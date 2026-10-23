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

  try {
    await next();

    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const statusCode = c.res.status;
    const route = routeLabel(c);

    // Record metrics
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    httpRequestTotal.inc({ method, route, status_code: statusCode });

    // Track errors (4xx, 5xx)
    if (statusCode >= 400) {
      const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
      httpRequestErrors.inc({ method, route, error_type: errorType });
    }

    return c.res;
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    const statusCode = c.res.status || 500;
    const route = routeLabel(c);

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
 * The matched route pattern (`/api/products/:id`), read after the handler ran.
 * Raw paths would add a label value per URL, and scanners alone send thousands
 * of distinct ones; requests no route matched share `unmatched`.
 */
function routeLabel(c: Context): string {
  const pattern = c.req.routePath;
  return pattern && pattern !== '/*' ? pattern : 'unmatched';
}
