import { Context, Next } from 'hono';

/**
 * Security headers middleware
 * Adds security headers to all responses
 */
export async function securityHeadersMiddleware(c: Context, next: Next) {
  // Content Security Policy
  // Allow same-origin and trusted sources
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // TODO: Remove unsafe-inline/eval in production
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  c.header('Content-Security-Policy', csp);

  // HTTP Strict Transport Security (HSTS)
  // Force HTTPS for 1 year, include subdomains
  // Only in production with HTTPS
  if (process.env.NODE_ENV === 'production') {
    const protocol = c.req.header('X-Forwarded-Proto') || 
                     (c.req.url.startsWith('https://') ? 'https' : 'http');
    if (protocol === 'https') {
      c.header(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      );
    }
  }

  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  c.header('X-Content-Type-Options', 'nosniff');

  // XSS Protection (legacy, but still useful)
  c.header('X-XSS-Protection', '1; mode=block');

  // Referrer Policy
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (formerly Feature Policy)
  c.header(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=()'
  );

  await next();
}
