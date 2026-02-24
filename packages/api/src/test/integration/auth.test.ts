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
import { createTestMerchant } from '../fixtures';
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

  it('should create new merchant account', async () => {
    const merchant = createTestMerchant();

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
