/**
 * Test Helpers
 * Utility functions for testing
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { vi } from 'vitest';
import { createTestMerchant } from './fixtures';
import { mockSupabaseClient, mockRedisClient } from './mocks';

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Create a mock Hono context
 */
export function createMockContext(overrides?: Partial<Context>): Partial<Context> {
  return {
    req: {
      param: vi.fn(),
      query: vi.fn(),
      header: vi.fn(),
      json: vi.fn(),
      text: vi.fn(),
      method: 'GET',
      path: '/',
    } as any,
    res: {
      status: 200,
      json: vi.fn(),
      text: vi.fn(),
      header: vi.fn(),
    } as any,
    set: vi.fn(),
    get: vi.fn(),
    header: vi.fn(),
    json: vi.fn((body: any, status: number = 200) => ({ status, body })),
    text: vi.fn((body: any, status: number = 200) => ({ status, body: String(body) })),
    ...overrides,
  };
}

/**
 * Create authenticated context with merchant ID
 */
export function createAuthenticatedContext(merchantId: string, overrides?: Partial<Context>): Partial<Context> {
  const context = createMockContext(overrides);
  context.get = vi.fn((key: string) => {
    if (key === 'merchantId') return merchantId;
    if (key === 'authMethod') return 'jwt';
    if (key === 'validatedBody') return {};
    if (key === 'validatedParams') return {};
    if (key === 'validatedQuery') return {};
    return undefined;
  });
  return context;
}

// ============================================================================
// Auth Helpers
// ============================================================================

/**
 * Create a test JWT token (mock)
 */
export function createTestJWT(merchantId: string): string {
  // In real tests, you might want to use actual JWT generation
  // For now, return a mock token
  return `mock-jwt-token-${merchantId}`;
}

/**
 * Setup authenticated request headers
 */
export function createAuthHeaders(type: 'jwt' = 'jwt', merchantId?: string) {
  return {
    Authorization: `Bearer ${createTestJWT(merchantId || 'test-merchant-id')}`,
  };
}

// ============================================================================
// Database Helpers
// ============================================================================

/**
 * Setup mock Supabase response for merchant query
 */
export function setupMerchantMock(merchant: any) {
  mockSupabaseClient.from().select().eq().single.mockResolvedValue({
    data: merchant,
    error: null,
  });
}

/**
 * Setup mock Supabase response for product query
 */
export function setupProductMock(product: any) {
  mockSupabaseClient.from().select().eq().single.mockResolvedValue({
    data: product,
    error: null,
  });
}

/**
 * Setup mock Supabase response for list query
 */
export function setupListMock(items: any[]) {
  mockSupabaseClient.from().select().eq().order().mockResolvedValue({
    data: items,
    error: null,
  });
}

// ============================================================================
// Redis Helpers
// ============================================================================

/**
 * Setup mock Redis cache response
 */
export function setupCacheMock(key: string, value: any) {
  mockRedisClient.get.mockImplementation((k: string) => {
    if (k === key) {
      return Promise.resolve(JSON.stringify(value));
    }
    return Promise.resolve(null);
  });
}

/**
 * Setup mock Redis rate limit response
 */
export function setupRateLimitMock(identifier: string, allowed: boolean, remaining: number) {
  mockRedisClient.get.mockImplementation((key: string) => {
    if (key.includes(identifier)) {
      return Promise.resolve(allowed ? remaining.toString() : '0');
    }
    return Promise.resolve(null);
  });
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert JSON response
 */
export function assertJsonResponse(response: any, expectedStatus: number, expectedData?: any) {
  expect(response.status).toBe(expectedStatus);
  if (expectedData) {
    expect(response.body).toMatchObject(expectedData);
  }
}

/**
 * Assert error response
 */
export function assertErrorResponse(response: any, expectedStatus: number, expectedError?: string) {
  expect(response.status).toBe(expectedStatus);
  if (expectedError) {
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain(expectedError);
  }
}
