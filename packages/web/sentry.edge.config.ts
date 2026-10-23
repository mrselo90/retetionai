/**
 * Sentry edge runtime configuration
 * For Next.js Edge Runtime
 */

import * as Sentry from '@sentry/nextjs';
import { sentryDsn, sentryEnvironment } from './lib/sentryDsn';

Sentry.init({
  dsn: sentryDsn(),
  environment: sentryEnvironment(),
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Same limits as sentry.server.config.ts: Sentry 11 would otherwise collect
  // bodies, cookies and other data that carries customer details.
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
});
