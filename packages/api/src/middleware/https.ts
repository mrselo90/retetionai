/**
 * HTTPS Enforcement Middleware
 * Redirects HTTP to HTTPS in production
 */

import { Context, Next } from 'hono';

export async function httpsMiddleware(c: Context, next: Next) {
  // Only enforce HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    const protocol = c.req.header('X-Forwarded-Proto') || 
                     (c.req.url.startsWith('https://') ? 'https' : 'http');
    
    // If request is HTTP, redirect to HTTPS
    if (protocol === 'http') {
      const httpsUrl = c.req.url.replace('http://', 'https://');
      return c.redirect(httpsUrl, 301);
    }
  }
  
  await next();
}
