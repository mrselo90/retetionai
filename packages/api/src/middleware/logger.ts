/**
 * Logger Middleware
 * Adds correlation IDs and request context to logs
 */

import { Context, Next } from 'hono';
import { createLogger, LogContext } from '@glowguide/shared';
import { randomUUID } from 'crypto';

/**
 * Generate correlation ID for request
 */
function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Logger middleware
 * Adds correlation ID and request context to all logs
 */
export async function loggerMiddleware(c: Context, next: Next) {
  const correlationId = generateCorrelationId();
  const startTime = Date.now();

  // Add correlation ID to response headers
  c.header('X-Correlation-ID', correlationId);

  // Create logger with request context
  const requestLogger = createLogger({
    correlationId,
    requestId: correlationId,
    method: c.req.method,
    path: c.req.path,
    merchantId: c.get('merchantId'),
    authMethod: c.get('authMethod'),
  });

  // Store logger in context for use in route handlers
  c.set('logger', requestLogger);

  // Log request start
  requestLogger.info('Request started');

  try {
    await next();

    // Log request completion
    const duration = Date.now() - startTime;
    requestLogger.info(
      {
        statusCode: c.res.status,
        duration: `${duration}ms`,
      },
      'Request completed'
    );
  } catch (error) {
    // Log request error
    const duration = Date.now() - startTime;
    requestLogger.error(
      {
        statusCode: c.res.status || 500,
        duration: `${duration}ms`,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : error,
      },
      'Request failed'
    );
    throw error;
  }
}
