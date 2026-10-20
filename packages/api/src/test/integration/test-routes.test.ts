/**
 * /api/test access control: only the Shopify app's internal /events call and
 * super admins get through.
 */

// IMPORTANT: Import middleware mocks BEFORE importing routes
import './middleware-mocks';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import testRoutes from '../../routes/test';
import { adminAuthMiddleware } from '../../middleware/adminAuth';
import { testRequest } from './setup';

vi.mock('../../middleware/adminAuth', () => ({
  adminAuthMiddleware: vi.fn(async (c: any, next: () => Promise<void>) => {
    if (c.req.header('X-Test-Super-Admin') !== 'true') {
      return c.json({ error: 'Forbidden: Requires Super Admin privileges' }, 403);
    }
    await next();
  }),
}));

vi.mock('../../lib/orderProcessor', () => ({
  processNormalizedEvent: vi.fn(async () => ({ success: true })),
}));

describe('/api/test access control', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api/test', testRoutes);
  });

  const eventBody = {
    event_type: 'order_created',
    external_order_id: 'test-1',
    customer_phone: '+905551112233',
    products: [{ name: 'Serum' }],
  };

  it.each([
    ['POST', '/api/test/events'],
    ['POST', '/api/test/rag'],
    ['POST', '/api/test/rag/answer'],
    ['POST', '/api/test/whatsapp-live'],
    ['GET', '/api/test/debug-billing'],
  ])('refuses %s %s for an ordinary merchant JWT', async (method, path) => {
    const response = await testRequest(app, method, path, {
      merchantId: 'merchant-1',
      authMethod: 'jwt',
      body: method === 'POST' ? eventBody : undefined,
    });

    expect(response.status).toBe(403);
  });

  it('lets the Shopify app reach /events over internal auth without the admin check', async () => {
    const response = await testRequest(app, 'POST', '/api/test/events', {
      merchantId: 'merchant-1',
      authMethod: 'internal',
      body: eventBody,
    });

    expect(response.status).not.toBe(403);
    expect(adminAuthMiddleware).not.toHaveBeenCalled();
  });

  it('keeps internal auth limited to /events', async () => {
    const response = await testRequest(app, 'POST', '/api/test/rag', {
      merchantId: 'merchant-1',
      authMethod: 'internal',
      body: { query: 'hi' },
    });

    expect(response.status).toBe(403);
  });

  it('lets a super admin through', async () => {
    const response = await testRequest(app, 'GET', '/api/test/debug-billing', {
      merchantId: 'admin-merchant',
      headers: { 'X-Test-Super-Admin': 'true' },
    });

    expect(response.status).not.toBe(403);
    expect(adminAuthMiddleware).toHaveBeenCalled();
  });
});
