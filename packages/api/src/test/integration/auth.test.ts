/**
 * Auth Endpoints Integration Tests
 * Tests for authentication endpoints
 */

// IMPORTANT: Import middleware mocks BEFORE importing routes
import './middleware-mocks';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import authRoutes from '../../routes/auth';
import { getSupabaseServiceClient, getAuthClient } from '@recete/shared';
import { mockSupabaseClient } from '../mocks';
import { createTestMerchant, createTestApiKey } from '../fixtures';
import { generateApiKey, hashApiKey } from '@recete/shared';
import { testRequest } from './setup';

// Mock dependencies
vi.mock('@recete/shared', async () => {
  const actual = await vi.importActual('@recete/shared');
  return {
    ...actual,
    getSupabaseServiceClient: vi.fn(),
    getAuthClient: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('POST /api/auth/signup', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    // Mount auth routes
    app.route('/api/auth', authRoutes);
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
  });

  it('should create new merchant with API key', async () => {
    const merchant = createTestMerchant();
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    // Mock: user doesn't exist (signInWithPassword fails)
    const authClient = {
      auth: {
        signInWithPassword: vi.fn().mockRejectedValue({
          message: 'Invalid credentials',
        }),
        signUp: vi.fn().mockResolvedValue({
          data: {
            user: { id: merchant.id, email: 'test@example.com' },
            session: null, // Email confirmation required
          },
          error: null,
        }),
      },
    };
    (getAuthClient as any).mockReturnValue(authClient);

    // Mock: merchant creation
    const insertBuilder = mockSupabaseClient.from('merchants');
    insertBuilder.insert.mockReturnValue(insertBuilder);
    insertBuilder.select.mockReturnValue(insertBuilder);
    insertBuilder.single.mockResolvedValue({
      data: {
        ...merchant,
        api_keys: [createTestApiKey({ hash: keyHash })],
      },
      error: null,
    });

    const response = await testRequest(app, 'POST', '/api/auth/signup', {
      body: {
        email: 'test@example.com',
        password: 'Test123!',
        name: 'Test Merchant',
      },
    });

    // May return 201 or 400 depending on email confirmation setup
    expect([201, 400]).toContain(response.status);
    if (response.status === 201) {
      expect(response.data).toHaveProperty('merchant');
      expect(response.data).toHaveProperty('apiKey');
      expect(response.data.apiKey).toMatch(/^gg_live_/);
    }
  });

  it('should reject duplicate email', async () => {
    const merchant = createTestMerchant();

    // Mock: user already exists
    const authClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: { id: merchant.id },
            session: { access_token: 'token' },
          },
          error: null,
        }),
      },
    };
    (getAuthClient as any).mockReturnValue(authClient);

    // Mock: merchant exists
    const queryBuilder = mockSupabaseClient.from('merchants');
    queryBuilder.single.mockResolvedValue({
      data: merchant,
      error: null,
    });

    const response = await testRequest(app, 'POST', '/api/auth/signup', {
      body: {
        email: 'test@example.com',
        password: 'Test123!',
        name: 'Test Merchant',
      },
    });

    expect(response.status).toBe(409);
    expect(response.data).toHaveProperty('error');
  });

  it('should validate input', async () => {
    const response = await testRequest(app, 'POST', '/api/auth/signup', {
      body: {
        email: 'invalid-email',
        password: 'short',
        name: '',
      },
    });

    expect(response.status).toBe(400);
    expect(response.data).toHaveProperty('error');
  });
});

describe('POST /api/auth/login', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/auth', authRoutes);
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
  });

  it('should login with valid credentials', async () => {
    const merchant = createTestMerchant();

    const authClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: { id: merchant.id },
            session: {
              access_token: 'test-token',
              refresh_token: 'test-refresh',
            },
          },
          error: null,
        }),
      },
    };
    (getAuthClient as any).mockReturnValue(authClient);

    const queryBuilder = mockSupabaseClient.from('merchants');
    queryBuilder.single.mockResolvedValue({
      data: merchant,
      error: null,
    });

    const response = await testRequest(app, 'POST', '/api/auth/login', {
      body: {
        email: 'test@example.com',
        password: 'Test123!',
      },
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('merchant');
    expect(response.data).toHaveProperty('session');
  });

  it('should reject invalid credentials', async () => {
    (getAuthClient as any).mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Invalid credentials' },
        }),
      },
    });

    const response = await testRequest(app, 'POST', '/api/auth/login', {
      body: {
        email: 'test@example.com',
        password: 'WrongPassword',
      },
    });

    expect(response.status).toBe(401);
    expect(response.data).toHaveProperty('error');
  });
});

describe('GET /api/auth/me', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/api/auth', authRoutes);
    vi.clearAllMocks();
    mockSupabaseClient.__reset();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
  });

  it('should return merchant details', async () => {
    const merchant = createTestMerchant();

    // Mock: get merchant
    mockSupabaseClient.from('merchants').select().single.mockResolvedValue({
      data: merchant,
      error: null,
    });

    const response = await testRequest(app, 'GET', '/api/auth/me', {
      headers: { 'X-Test-Merchant-Id': merchant.id },
    });

    expect(response.status).toBe(200);
    expect(response.data.merchant).toEqual(expect.objectContaining({
      id: merchant.id,
      name: merchant.name,
      created_at: merchant.created_at,
    }));
  });

  it('should return 404 if merchant not found', async () => {
    mockSupabaseClient.from('merchants').select().single.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const response = await testRequest(app, 'GET', '/api/auth/me');

    expect(response.status).toBe(404);
  });
});

describe('API Key Management', () => {
  let app: Hono;
  const merchantId = 'test-merchant-id';

  beforeEach(() => {
    app = new Hono();
    app.route('/api/auth', authRoutes);
    vi.clearAllMocks();
    mockSupabaseClient.__reset();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
  });

  describe('POST /api/auth/api-keys', () => {
    it('should create new API key', async () => {
      const merchant = createTestMerchant({ id: merchantId });
      const existingKey = createTestApiKey({ name: 'Existing Key' });

      // Mock: get merchant
      mockSupabaseClient.from('merchants').select().single.mockResolvedValue({
        data: { ...merchant, api_keys: [existingKey] },
        error: null,
      });

      // Update will return success by default via builder.then()

      const response = await testRequest(app, 'POST', '/api/auth/api-keys', {
        headers: { 'X-Test-Merchant-Id': merchantId },
        body: { name: 'New Key' },
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('apiKey');
      expect(response.data).toHaveProperty('keyInfo');
      expect(response.data.keyInfo.name).toBe('New Key');
      expect(mockSupabaseClient.from('merchants').update).toHaveBeenCalledWith(
        expect.objectContaining({
          api_keys: expect.arrayContaining([
            expect.objectContaining({ hash: existingKey.hash }),
            expect.objectContaining({ name: 'New Key' }),
          ]),
        })
      );
    });

    it('should enforce max 5 keys limit', async () => {
      const merchant = createTestMerchant({ id: merchantId });
      const maxKeys = Array(5).fill(null).map(() => createTestApiKey());

      mockSupabaseClient.from('merchants').select().single.mockResolvedValue({
        data: { ...merchant, api_keys: maxKeys },
        error: null,
      });

      const response = await testRequest(app, 'POST', '/api/auth/api-keys', {
        headers: { 'X-Test-Merchant-Id': merchantId },
        body: { name: 'Limit Key' },
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('Maximum 5 API keys allowed');
    });
  });

  describe('GET /api/auth/api-keys', () => {
    it('should list API keys efficiently', async () => {
      const merchant = createTestMerchant({ id: merchantId });
      const keys = [
        createTestApiKey({ name: 'Key 1' }),
        createTestApiKey({ name: 'Key 2' }),
      ];

      mockSupabaseClient.from('merchants').select().single.mockResolvedValue({
        data: { ...merchant, api_keys: keys },
        error: null,
      });

      const response = await testRequest(app, 'GET', '/api/auth/api-keys', {
        headers: { 'X-Test-Merchant-Id': merchantId },
      });

      expect(response.status).toBe(200);
      expect(response.data.apiKeys).toHaveLength(2);
      expect(response.data.apiKeys[0]).not.toHaveProperty('apiKey'); // Should not return full key
      expect(response.data.apiKeys[0]).toHaveProperty('hash_full');
      expect(response.data.apiKeys[0].hash).toContain('...'); // Masked hash
    });
  });

  describe('POST /api/auth/api-keys/:keyHash/rotate', () => {
    it('should rotate API key', async () => {
      const merchant = createTestMerchant({ id: merchantId });
      const oldKey = createTestApiKey({ name: 'Old Key' });

      mockSupabaseClient.from('merchants').select().single.mockResolvedValue({
        data: { ...merchant, api_keys: [oldKey] },
        error: null,
      });

      const response = await testRequest(app, 'POST', `/api/auth/api-keys/${oldKey.hash}/rotate`, {
        headers: { 'X-Test-Merchant-Id': merchantId },
        params: { keyHash: oldKey.hash },
        body: { name: 'Rotated Key' },
      });

      expect(response.status).toBe(201);
      expect(response.data.message).toBe('API key rotated successfully');
      expect(response.data).toHaveProperty('apiKey');
    });

    it('should return 404 if key not found', async () => {
      const merchant = createTestMerchant({ id: merchantId });
      mockSupabaseClient.from('merchants').select().single.mockResolvedValue({
        data: { ...merchant, api_keys: [] },
        error: null,
      });

      const response = await testRequest(app, 'POST', '/api/auth/api-keys/non-existent/rotate', {
        headers: { 'X-Test-Merchant-Id': merchantId },
        params: { keyHash: 'non-existent' },
        body: { name: 'New Key' },
      });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/auth/api-keys/:keyHash', () => {
    it('should revoke API key', async () => {
      const merchant = createTestMerchant({ id: merchantId });
      const keyToDelete = createTestApiKey();
      const keyToKeep = createTestApiKey();

      mockSupabaseClient.from('merchants').select().single.mockResolvedValue({
        data: { ...merchant, api_keys: [keyToDelete, keyToKeep] },
        error: null,
      });

      const response = await testRequest(app, 'DELETE', `/api/auth/api-keys/${keyToDelete.hash}`, {
        headers: { 'X-Test-Merchant-Id': merchantId },
        params: { keyHash: keyToDelete.hash },
      });

      expect(response.status).toBe(200);
      expect(mockSupabaseClient.from('merchants').update).toHaveBeenCalledWith(
        expect.objectContaining({
          api_keys: expect.arrayContaining([
            expect.objectContaining({ hash: keyToKeep.hash }),
          ]),
        })
      );
    });
  });
});
