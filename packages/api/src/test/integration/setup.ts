/**
 * Integration Test Setup
 * Sets up test environment for integration tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import { Hono, Context } from 'hono';
import { getSupabaseServiceClient, getRedisClient, getAuthClient } from '@glowguide/shared';
import { mockSupabaseClient, mockRedisClient } from '../mocks';
import { createTestMerchant } from '../fixtures';

// Mock dependencies before importing routes
vi.mock('@glowguide/shared', async () => {
  const actual = await vi.importActual('@glowguide/shared');
  return {
    ...actual,
    getSupabaseServiceClient: vi.fn(),
    getRedisClient: vi.fn(),
    getAuthClient: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  };
});

// Middleware mocks are now in middleware-mocks.ts
// Import that file before importing routes in test files

// Setup mocks
beforeAll(() => {
  (getSupabaseServiceClient as any).mockReturnValue(mockSupabaseClient);
  (getRedisClient as any).mockReturnValue(mockRedisClient);
  
  // Setup default auth client mock
  (getAuthClient as any).mockReturnValue({
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  
  // Setup default mock responses
  mockSupabaseClient.from().select().eq().single.mockResolvedValue({
    data: null,
    error: null,
  });
  
  mockRedisClient.get.mockResolvedValue(null);
  mockRedisClient.set.mockResolvedValue('OK');
  mockRedisClient.setex.mockResolvedValue('OK');
  mockRedisClient.del.mockResolvedValue(1);
  mockRedisClient.exists.mockResolvedValue(0);
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  // Cleanup
});

/**
 * Create test Hono app instance
 */
export function createTestApp() {
  const app = new Hono();
  return app;
}

/**
 * Helper to make test requests
 */
export async function testRequest(
  app: Hono,
  method: string,
  path: string,
  options?: {
    body?: any;
    headers?: Record<string, string>;
    merchantId?: string; // Override default merchant ID
    authMethod?: 'jwt' | 'api-key';
  }
) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...options?.headers,
  });

  // Set Authorization header (required by middleware, even if mocked)
  // This prevents the middleware from returning 401 early
  if (!headers.has('Authorization')) {
    headers.set('Authorization', 'Bearer test-token');
  }

  // Set test merchant ID if provided
  if (options?.merchantId) {
    headers.set('X-Test-Merchant-Id', options.merchantId);
  }

  // Set auth method if provided
  if (options?.authMethod) {
    headers.set('X-Test-Auth-Method', options.authMethod);
  }

  const req = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const res = await app.fetch(req);
  
  // Try to parse JSON, fallback to text
  let data: any;
  const contentType = res.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = await res.text();
    }
  } else {
    data = await res.text();
  }

  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    data,
    ok: res.ok,
  };
}

/**
 * Setup authenticated context for tests
 */
export function setupAuthenticatedContext(merchantId: string = 'test-merchant-id') {
  const merchant = createTestMerchant({ id: merchantId });
  
  // Mock merchant lookup
  mockSupabaseClient.from().select().eq().single.mockResolvedValue({
    data: merchant,
    error: null,
  });

  return merchant;
}

/**
 * Setup test database state
 * This can be extended to use a real test database
 */
export async function setupTestDatabase() {
  // For now, we use mocks
  // In the future, this could connect to a real test database
  // and run migrations/seed data
  
  return {
    merchants: [],
    users: [],
    products: [],
    orders: [],
    conversations: [],
    messages: [],
  };
}

/**
 * Cleanup test database state
 */
export async function cleanupTestDatabase() {
  // Cleanup mocks
  vi.clearAllMocks();
}
