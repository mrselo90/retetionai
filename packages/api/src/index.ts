import 'dotenv/config';
import { initSentry } from './lib/sentry';

// Initialize Sentry before anything else
initSentry();

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';
import { getSupabaseClient, getRedisClient } from '@glowguide/shared';
import authRoutes from './routes/auth';
import merchantRoutes from './routes/merchants';
import integrationRoutes from './routes/integrations';
import shopifyRoutes from './routes/shopify';
import webhookRoutes from './routes/webhooks';
import eventRoutes from './routes/events';
import csvRoutes from './routes/csv';
import productRoutes from './routes/products';
import ragRoutes from './routes/rag';
import whatsappRoutes from './routes/whatsapp';
import messageRoutes from './routes/messages';
import conversationRoutes from './routes/conversations';
import analyticsRoutes from './routes/analytics';
import testRoutes from './routes/test';
import gdprRoutes from './routes/gdpr';
import billingRoutes from './routes/billing';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { securityHeadersMiddleware } from './middleware/securityHeaders';
import { loggerMiddleware } from './middleware/logger';
import { metricsMiddleware } from './middleware/metricsMiddleware';
import { cacheMiddleware } from './middleware/cacheMiddleware';
import { httpsMiddleware } from './middleware/https';
import { register } from './lib/metrics';

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
  // Format: "http://localhost:3000,https://app.glowguide.ai,https://staging.glowguide.ai"
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const allowedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001']; // Default for development
  
  // Allow requests from allowed origins
  if (origin && allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
  }
  
  // Allow credentials (cookies, authorization headers)
  c.header('Access-Control-Allow-Credentials', 'true');
  
  // Allowed methods
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  
  // Allowed headers
  c.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Api-Key, X-Requested-With'
  );
  
  // Exposed headers (for rate limiting)
  c.header(
    'Access-Control-Expose-Headers',
    'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset'
  );
  
  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
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

// Integration routes
app.route('/api/integrations', integrationRoutes);

// CSV import routes
app.route('/api/integrations', csvRoutes);

// Shopify-specific routes
app.route('/api/integrations/shopify', shopifyRoutes);

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

// Event processing routes
app.route('/api/events', eventRoutes);

// Webhook routes (public endpoints, authenticated via HMAC/API key)
app.route('/webhooks', webhookRoutes);

// Swagger UI Documentation
app.get('/api/docs', swaggerUI({ 
  url: '/api/docs/openapi.json',
}));

// OpenAPI JSON specification (basic)
app.get('/api/docs/openapi.json', (c) => {
  return c.json({
    openapi: '3.1.0',
    info: {
      title: 'GlowGuide Retention Agent API',
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

// Health check endpoint
app.get('/', (c) => {
  return c.json({ 
    message: 'GlowGuide API',
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
import { scheduleApiKeyExpirationCleanup } from './lib/apiKeyExpirationScheduler';
import { logger } from '@glowguide/shared';
scheduleApiKeyExpirationCleanup().catch((err) => {
  logger.error(err, 'Failed to schedule API key expiration cleanup');
});

const port = Number(process.env.PORT) || 3001;
logger.info({ port }, '🚀 GlowGuide API server starting');

serve({
  fetch: app.fetch,
  port,
});
