/**
 * Sentry helper functions for frontend
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Capture exception in frontend
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * Capture message in frontend
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      Sentry.captureMessage(message, level);
    });
  } else {
    Sentry.captureMessage(message, level);
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
 * Add breadcrumb
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addBreadcrumb(message: string, category?: string, level?: Sentry.SeverityLevel, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    category: category || 'default',
    level: level || 'info',
    data,
  });
}
