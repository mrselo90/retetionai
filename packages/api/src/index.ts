import './loadEnv.js';

import { initSentry } from './lib/sentry.js';

// Initialize Sentry before anything else
initSentry();

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';
import { getSupabaseClient, getRedisClient } from '@recete/shared';
import authRoutes from './routes/auth.js';
import merchantRoutes from './routes/merchants.js';
import integrationRoutes from './routes/integrations.js';
import shopifyRoutes from './routes/shopify.js';
import webhookRoutes from './routes/webhooks.js';
import eventRoutes from './routes/events.js';
import csvRoutes from './routes/csv.js';
import productRoutes from './routes/products.js';
import ragRoutes from './routes/rag.js';
import whatsappRoutes from './routes/whatsapp.js';
import messageRoutes from './routes/messages.js';
import conversationRoutes from './routes/conversations.js';
import analyticsRoutes from './routes/analytics.js';
import testRoutes from './routes/test.js';
import gdprRoutes from './routes/gdpr.js';
import billingRoutes from './routes/billing.js';
import customerRoutes from './routes/customers.js';
import memberRoutes from './routes/members.js';
import adminRoutes from './routes/admin.js';
import shopifyGdprRoutes from './routes/shopifyGdpr.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { securityHeadersMiddleware } from './middleware/securityHeaders.js';
import { loggerMiddleware } from './middleware/logger.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import { cacheMiddleware } from './middleware/cacheMiddleware.js';
import { httpsMiddleware } from './middleware/https.js';
import { register } from './lib/metrics.js';

const app = new Hono();

// Logger middleware (apply first to capture all requests)
app.use('/*', loggerMiddleware);

// HTTPS enforcement (in production, before other middleware)
if (process.env.NODE_ENV === 'production') {
  app.use('/*', httpsMiddleware);
}

// Security headers
app.use('/*', securityHeadersMiddleware);

// CORS middleware (with environment-based origins)
app.use('/*', async (c, next) => {
  const origin = c.req.header('Origin');

  // Get allowed origins from environment variable
  // Format: "http://localhost:3000,https://app.recete.ai,https://staging.recete.ai"
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const allowedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000']; // Default for development

  // Always set CORS headers (even if origin is not in list for development)
  // In production, only allow specific origins
  const isDevelopment = process.env.NODE_ENV !== 'production';

  if (isDevelopment) {
    // In development, allow any localhost origin
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      c.header('Access-Control-Allow-Origin', origin);
    } else if (origin) {
      c.header('Access-Control-Allow-Origin', origin);
    } else {
      // No origin header (e.g., Postman), allow all in dev
      c.header('Access-Control-Allow-Origin', '*');
    }
  } else {
    // In production: allow listed origins, or any localhost/127.0.0.1 (for local/ingress dev)
    if (origin) {
      if (allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        c.header('Access-Control-Allow-Origin', origin);
      }
    }
  }

  // Allow credentials (cookies, authorization headers)
  c.header('Access-Control-Allow-Credentials', 'true');

  // Allowed methods
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');

  // Allowed headers
  c.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Api-Key, X-Requested-With, Accept, Origin'
  );

  // Exposed headers (for rate limiting)
  c.header(
    'Access-Control-Expose-Headers',
    'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset'
  );

  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
});

// Rate limiting (apply after CORS, before routes)
// Skip rate limiting for health checks
app.use('/*', async (c, next) => {
  const path = c.req.path;

  // Skip rate limiting for health checks
  if (path === '/' || path === '/health') {
    await next();
    return;
  }

  // Apply rate limiting to all other routes
  await rateLimitMiddleware(c, next);
});

// Auth routes
app.route('/api/auth', authRoutes);

// Merchant routes
app.route('/api/merchants', merchantRoutes);

// Shopify-specific routes (Mount BEFORE generic integration routes)
app.route('/api/integrations/shopify', shopifyRoutes);

// Integration routes
app.route('/api/integrations', integrationRoutes);

// CSV import routes
app.route('/api/integrations', csvRoutes);

// Product routes
app.route('/api/products', productRoutes);

// RAG routes
app.route('/api/rag', ragRoutes);

// WhatsApp routes
app.route('/api/whatsapp', whatsappRoutes);
// WhatsApp webhooks at root (Meta sends to /webhooks/whatsapp)
// Note: These routes are handled in whatsappRoutes, but we keep them here for clarity

// Message scheduling routes
app.route('/api/messages', messageRoutes);

// Conversation routes
app.route('/api/conversations', conversationRoutes);

// Analytics routes
app.route('/api/analytics', analyticsRoutes);

// Test & Development routes
app.route('/api/test', testRoutes);

// GDPR compliance routes
app.route('/api/gdpr', gdprRoutes);

// Customer 360 routes
app.route('/api/customers', customerRoutes);

// Team member routes
app.route('/api/merchants/me/members', memberRoutes);

// Super Admin routes
app.route('/api/admin', adminRoutes);

// Event processing routes
app.route('/api/events', eventRoutes);

// Webhook routes (public endpoints, authenticated via HMAC/API key)
app.route('/webhooks', webhookRoutes);

// Shopify GDPR Mandatory Webhook routes (public, authenticated via HMAC)
app.route('/api/webhooks/shopify/gdpr', shopifyGdprRoutes);

// Swagger UI Documentation
app.get('/api/docs', swaggerUI({
  url: '/api/docs/openapi.json',
}));

// OpenAPI JSON specification (basic)
app.get('/api/docs/openapi.json', (c) => {
  return c.json({
    openapi: '3.1.0',
    info: {
      title: 'Recete Retention Agent API',
      version: '0.1.0',
      description: 'White-label SaaS platform for post-purchase AI assistance via WhatsApp',
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3001',
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from /api/auth/login',
        },
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Api-Key',
          description: 'API key (format: gg_live_...)',
        },
      },
    },
    paths: {
      // Note: Full OpenAPI spec would be auto-generated from route definitions
      // For now, this is a basic structure. Full documentation in docs/api/OPENAPI_SPEC.md
    },
  });
});

// Platform contact (public, for dashboard footer / support display)
app.get('/api/config/platform-contact', (c) => {
  const whatsappNumber = process.env.PLATFORM_WHATSAPP_NUMBER || '+905545736900';
  return c.json({ whatsapp_number: whatsappNumber });
});

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    message: 'Recete API',
    version: '0.1.0',
    status: 'ok'
  });
});

// Comprehensive health check
app.get('/health', async (c) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
  };

  // Database check
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('merchants').select('count').limit(1);
    health.services.database = error ? 'error' : 'connected';
  } catch (error) {
    health.services.database = 'error';
  }

  // Redis check
  try {
    const redis = getRedisClient();
    await redis.ping();
    health.services.redis = 'connected';
  } catch (error) {
    health.services.redis = 'error';
  }

  const allHealthy =
    health.services.database === 'connected' &&
    health.services.redis === 'connected';

  return c.json(health, allHealthy ? 200 : 503);
});

// Schedule API key expiration cleanup (runs daily)
import { scheduleApiKeyExpirationCleanup } from './lib/apiKeyExpirationScheduler.js';
import { logger } from '@recete/shared';
scheduleApiKeyExpirationCleanup().catch((err) => {
  logger.error(err, 'Failed to schedule API key expiration cleanup');
});

// Production: Nginx proxies to API on 3002; avoid 3000 (conflict with web)
const rawPort = Number(process.env.PORT) || 3002;
const port = rawPort === 3000 ? 3002 : rawPort;
logger.info({ port }, '🚀 Recete API server starting');

serve({
  fetch: app.fetch,
  port,
});
