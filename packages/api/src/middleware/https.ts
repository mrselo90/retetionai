/**
 * HTTPS Enforcement Middleware
 * Redirects HTTP to HTTPS in production
 */

import { Context, Next } from 'hono';

export async function httpsMiddleware(c: Context, next: Next) {
  // Skip redirect for health/readiness probes (K8s expects 200)
  const path = new URL(c.req.url).pathname;
  if (path === '/health' || path === '/') {
    await next();
    return;
  }
  // Skip redirect for localhost (local dev and ingress at http://localhost)
  const host = c.req.header('Host') || '';
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    await next();
    return;
  }
  // Only enforce HTTPS in production for non-localhost
  if (process.env.NODE_ENV === 'production') {
    const protocol = c.req.header('X-Forwarded-Proto') || 
                     (c.req.url.startsWith('https://') ? 'https' : 'http');
    
    if (protocol === 'http') {
      const httpsUrl = c.req.url.replace('http://', 'https://');
      return c.redirect(httpsUrl, 301);
    }
  }
  
  await next();
}
