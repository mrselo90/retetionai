/**
 * HTTPS Enforcement Middleware
 * Redirects HTTP to HTTPS in production
 */

import { Context, Next } from 'hono';

export async function httpsMiddleware(c: Context, next: Next) {
  // HTTPS redirect disabled: no SSL certificate installed yet
  // Enable after Let's Encrypt setup (Phase 1.5)
  await next();
}
