/**
 * Sentry client-side configuration
 * This file configures Sentry for the Next.js client-side bundle
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Replay can be used to record user sessions
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
  
  // Filter out sensitive data
  beforeSend(event, hint) {
    // Remove sensitive data from URLs
    if (event.request?.url) {
      const url = new URL(event.request.url);
      // Remove API keys from query params
      url.searchParams.delete('api_key');
      url.searchParams.delete('token');
      event.request.url = url.toString();
    }
    
    return event;
  },
});
