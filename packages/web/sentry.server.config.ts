/**
 * Sentry server-side configuration
 * This file configures Sentry for the Next.js server-side bundle
 */

import * as Sentry from '@sentry/nextjs';
import { sentryDsn, sentryEnvironment } from './lib/sentryDsn';

Sentry.init({
  dsn: sentryDsn(),
  environment: sentryEnvironment(),
  
  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Filter out health checks
  // ignoreSpans works with Sentry 11's default span streaming; ignoreTransactions no longer does.
  ignoreSpans: ['GET /health', 'GET /api/health'],
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
  
  // Filter out sensitive data
  beforeSend(event, hint) {
    // Remove sensitive headers
    if (event.request?.headers) {
      const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];
      sensitiveHeaders.forEach((header) => {
        if (event.request?.headers?.[header]) {
          event.request.headers[header] = '[REDACTED]';
        }
      });
    }
    
    return event;
  },
});
