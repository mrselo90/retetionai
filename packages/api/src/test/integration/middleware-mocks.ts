/**
 * Middleware Mocks for Integration Tests
 * This file must be imported before any routes are imported
 */

import { vi } from 'vitest';
import { Context } from 'hono';

// Mock auth middleware - MUST be hoisted before routes import
vi.mock('../../middleware/auth', async () => {
  const actual = await vi.importActual('../../middleware/auth');
  return {
    ...actual,
    authMiddleware: vi.fn(async (c: Context, next: () => Promise<void>) => {
      // Check for test headers first (for integration tests)
      const testMerchantId = c.req.header('X-Test-Merchant-Id');
      const testAuthMethod = c.req.header('X-Test-Auth-Method') || 'jwt';
      
      if (testMerchantId) {
        // Use test merchant ID from header
        c.set('merchantId', testMerchantId);
        c.set('authMethod', testAuthMethod);
        await next();
        return;
      }
      
      // Default merchant ID for tests (if no header provided)
      const merchantId = 'test-merchant-id';
      const authMethod = 'jwt';
      
      // Always allow in tests - set merchant context
      c.set('merchantId', merchantId);
      c.set('authMethod', authMethod);
      await next();
    }),
    optionalAuthMiddleware: vi.fn(async (c: Context, next: () => Promise<void>) => {
      // Try to extract merchant ID if available
      const merchantId = c.req.header('X-Test-Merchant-Id') || 'test-merchant-id';
      if (merchantId) {
        c.set('merchantId', merchantId);
        c.set('authMethod', 'jwt');
      }
      await next();
    }),
  };
});

// Mock validation middleware
vi.mock('../../middleware/validation', () => {
  const validateBody = (schema: any) => {
    return async (c: Context, next: () => Promise<void>) => {
      try {
        const body = await c.req.json();
        const validated = schema.parse(body);
        c.set('validatedBody', validated);
        await next();
      } catch (error: any) {
        return c.json({ error: 'Validation failed', details: error.errors }, 400);
      }
    };
  };

  const validateQuery = (schema: any) => {
    return async (c: Context, next: () => Promise<void>) => {
      try {
        const query = Object.fromEntries(c.req.query());
        const validated = schema.parse(query);
        c.set('validatedQuery', validated);
        await next();
      } catch (error: any) {
        return c.json({ error: 'Validation failed', details: error.errors }, 400);
      }
    };
  };

  const validateParams = (schema: any) => {
    return async (c: Context, next: () => Promise<void>) => {
      try {
        const params = c.req.param();
        const validated = schema.parse(params);
        c.set('validatedParams', validated);
        await next();
      } catch (error: any) {
        return c.json({ error: 'Validation failed', details: error.errors }, 400);
      }
    };
  };

  return {
    validateBody,
    validateQuery,
    validateParams,
  };
});

// Mock rate limit middleware
vi.mock('../../middleware/rateLimit', () => {
  const rateLimitMiddleware = vi.fn(async (c: Context, next: () => Promise<void>) => {
    // Skip rate limiting in tests
    await next();
  });

  return {
    rateLimitMiddleware,
  };
});
