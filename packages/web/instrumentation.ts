/**
 * This file configures Next.js to load Sentry on the server-side
 * See: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */

import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Hands errors from server components, route handlers and server actions to
// Sentry. Without it Next.js handles them itself and Sentry never sees them.
export const onRequestError = Sentry.captureRequestError;
