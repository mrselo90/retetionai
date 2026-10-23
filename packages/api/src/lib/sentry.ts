/**
 * Sentry error tracking configuration
 */

import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry for backend
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';

  if (!dsn) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [],

    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev

    // Release tracking
    release: process.env.APP_VERSION || '0.1.0',

    // Filter out health check endpoints. ignoreSpans works with Sentry 11's
    // default span streaming; ignoreTransactions no longer does.
    ignoreSpans: ['GET /health', 'GET /'],

    // Sentry 11 collects request/response bodies, cookies, database query data,
    // AI inputs/outputs and queue job arguments by default. Ours carry customer
    // phone numbers and WhatsApp messages, so keep to what v10 sent: request
    // headers (sensitive ones denied, the rest redacted in beforeSend) and query
    // strings, nothing else.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { deny: ['authorization', 'x-api-key', 'cookie'] }, response: false },
      httpBodies: [],
      databaseQueryData: false,
      genAI: { inputs: false, outputs: false },
      queues: false,
      stackFrameVariables: false,
    },

    // Before send hook - filter sensitive data
    beforeSend(event, hint) {
      // Remove sensitive data from event
      if (event.request) {
        // Remove API keys from headers
        if (event.request.headers) {
          const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];
          sensitiveHeaders.forEach((header) => {
            if (event.request?.headers?.[header]) {
              event.request.headers[header] = '[REDACTED]';
            }
          });
        }

        // Remove sensitive query params
        if (event.request.query_string) {
          const queryString = typeof event.request.query_string === 'string'
            ? event.request.query_string
            : String(event.request.query_string);
          if (queryString.includes('api_key') || queryString.includes('token')) {
            event.request.query_string = '[REDACTED]';
          }
        }
      }

      return event;
    },
  });

  console.log('✅ Sentry initialized for backend');
}

/**
 * Capture exception
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Capture message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      scope.setLevel(level);
      Sentry.captureMessage(message);
    });
  } else {
    Sentry.withScope((scope) => {
      scope.setLevel(level);
      Sentry.captureMessage(message);
    });
  }
}

/**
 * Set user context
 */
export function setUserContext(userId: string, email?: string, merchantId?: string) {
  Sentry.setUser({
    id: userId,
    email,
    merchantId,
  });
}

/**
 * Set merchant context
 */
export function setMerchantContext(merchantId: string, merchantName?: string) {
  Sentry.setContext('merchant', {
    id: merchantId,
    name: merchantName,
  });
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(message: string, category?: string, level?: Sentry.SeverityLevel, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    category: category || 'default',
    level: level || 'info',
    data: data || {},
  });
}
