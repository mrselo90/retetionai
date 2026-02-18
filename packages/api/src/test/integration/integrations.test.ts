/**
 * Integration Endpoints Integration Tests
 * Tests for integration management endpoints
 */

// IMPORTANT: Import middleware mocks BEFORE importing routes
import './middleware-mocks';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import integrationsRoutes from '../../routes/integrations';
import { getSupabaseServiceClient } from '@recete/shared';
import { mockSupabaseClient } from '../mocks';
import { createTestIntegration, createTestMerchant } from '../fixtures';
import { testRequest, setupAuthenticatedContext } from './setup';

// Mock dependencies
vi.mock('@recete/shared', async () => {
  const actual = await vi.importActual('@recete/shared');
  return {
    ...actual,
    getSupabaseServiceClient: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('GET /api/integrations', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/integrations', integrationsRoutes);
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
    setupAuthenticatedContext();
  });

  it('should return merchant integrations', async () => {
    const merchantId = 'test-merchant-id';
    const integrationList = [
      createTestIntegration(merchantId),
      createTestIntegration(merchantId, { provider: 'manual' }),
    ];

    const queryBuilder = mockSupabaseClient.from('integrations');
    // Override order to return a promise with data
    queryBuilder.order = vi.fn().mockResolvedValue({
      data: integrationList,
      error: null,
    });

    const response = await testRequest(app, 'GET', '/api/integrations', {
      merchantId,
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('integrations');
    expect(response.data.integrations).toHaveLength(2);
  });

  it('should return empty array when no integrations', async () => {
    const merchantId = 'test-merchant-id';

    const queryBuilder = mockSupabaseClient.from('integrations');
    queryBuilder.order = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const response = await testRequest(app, 'GET', '/api/integrations', {
      merchantId,
    });

    expect(response.status).toBe(200);
    expect(response.data.integrations).toHaveLength(0);
  });
});

describe('POST /api/integrations', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/integrations', integrationsRoutes);
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
    setupAuthenticatedContext();
  });

  it('should create new integration', async () => {
    const merchantId = 'test-merchant-id';
    const newIntegration = createTestIntegration(merchantId, {
      provider: 'manual',
      status: 'active',
    });

    const integrationsQ = mockSupabaseClient.from('integrations') as any;
    // first: existing integration check
    integrationsQ.__pushResult({ data: null, error: { code: 'PGRST116' } });
    // second: insert result
    integrationsQ.__pushResult({ data: newIntegration, error: null });

    const response = await testRequest(app, 'POST', '/api/integrations', {
      body: {
        provider: 'manual',
        auth_type: 'api_key',
        auth_data: {
          api_key: 'test-api-key',
        },
      },
      merchantId,
    });

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty('integration');
    expect(response.data.integration.provider).toBe('manual');
  });

  it('should validate input', async () => {
    const response = await testRequest(app, 'POST', '/api/integrations', {
      body: {
        // Missing required fields
      },
      merchantId: 'test-merchant-id',
    });

    expect(response.status).toBe(400);
    expect(response.data).toHaveProperty('error');
  });
});

describe('GET /api/integrations/:id', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/integrations', integrationsRoutes);
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
    setupAuthenticatedContext();
  });

  it('should return integration by ID', async () => {
    const merchantId = 'test-merchant-id';
    const integration = createTestIntegration(merchantId);

    const queryBuilder = mockSupabaseClient.from('integrations');
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.single.mockResolvedValue({
      data: integration,
      error: null,
    });

    const response = await testRequest(app, 'GET', `/api/integrations/${integration.id}`, {
      merchantId,
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('integration');
    expect(response.data.integration.id).toBe(integration.id);
  });

  it('should return 404 for non-existent integration', async () => {
    const merchantId = 'test-merchant-id';

    const queryBuilder = mockSupabaseClient.from('integrations');
    queryBuilder.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' },
    });

    const response = await testRequest(app, 'GET', '/api/integrations/non-existent-id', {
      merchantId,
    });

    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/integrations/:id', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/integrations', integrationsRoutes);
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
    setupAuthenticatedContext();
  });

  it('should delete integration', async () => {
    const merchantId = 'test-merchant-id';
    const integration = createTestIntegration(merchantId);

    const integrationsQ = mockSupabaseClient.from('integrations') as any;
    integrationsQ.__pushResult({ data: integration, error: null }); // ownership check
    integrationsQ.__pushResult({ data: null, error: null }); // delete result (await builder)

    const response = await testRequest(app, 'DELETE', `/api/integrations/${integration.id}`, {
      merchantId,
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('message');
  });
});
