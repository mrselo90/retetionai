/**
 * Test Setup
 * Global test configuration and utilities
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import { mockRedisClient, mockSupabaseClient } from './mocks';

// Mock environment variables - MUST be set before any imports
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64); // 32-byte hex key
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || 'test-shopify-key';
process.env.SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || 'test-shopify-secret';
process.env.WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || 'test-wa-access';
process.env.WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || 'test-wa-phone-id';
process.env.WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'test-wa-verify';

// ----------------------------------------------------------------------------
// Global module mocks (shared clients, OpenAI, fetch)
// ----------------------------------------------------------------------------

vi.mock('@glowguide/shared', async () => {
  const actual = await vi.importActual<any>('@glowguide/shared');
  return {
    ...actual,
    getRedisClient: vi.fn(() => mockRedisClient as any),
    getSupabaseClient: vi.fn(() => mockSupabaseClient as any),
    getSupabaseServiceClient: vi.fn(() => mockSupabaseClient as any),
    getAuthClient: vi.fn(() => ({ auth: (mockSupabaseClient as any).auth })),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock('openai', () => {
  class OpenAI {
    public embeddings = {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0), index: 0 }],
        usage: { prompt_tokens: 10, total_tokens: 10 },
      }),
    };

    public chat = {
      completions: {
        create: vi.fn().mockImplementation(async (args: any) => {
          const wantsJson = args?.response_format?.type === 'json_object';
          const userText = String(args?.messages?.find((m: any) => m?.role === 'user')?.content || '').toLowerCase();
          const isNegative =
            ['terrible', 'hate', 'not satisfied', 'bad', 'awful', 'worst'].some((w) => userText.includes(w));
          const isPositive =
            ['great', 'love', 'perfect', 'amazing', 'thank you', 'harika', 'mükemmel'].some((w) =>
              userText.includes(w)
            );
          const json = isNegative
            ? { satisfied: false, confidence: 0.9, sentiment: 'negative' }
            : isPositive
              ? { satisfied: true, confidence: 0.9, sentiment: 'positive' }
              : { satisfied: false, confidence: 0.6, sentiment: 'neutral' };
          return {
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: wantsJson
                    ? JSON.stringify(json)
                    : 'Test AI response',
                },
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
          };
        }),
      },
    };
  }

  return { default: OpenAI };
});

// Mock fetch for all tests (unit tests will override per-file if needed)
const defaultFetch = vi.fn(async (input: any) => {
  const url = typeof input === 'string' ? input : input?.url;

  // Shopify token exchange + basic endpoints
  if (typeof url === 'string' && url.includes('/admin/oauth/access_token')) {
    return new Response(JSON.stringify({ access_token: 'test-access-token', scope: 'read_orders' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // WhatsApp send message
  if (typeof url === 'string' && url.includes('graph.facebook.com')) {
    return new Response(JSON.stringify({ messages: [{ id: 'test-message-id' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Generic HTML for scraper
  return new Response(
    '<html><head><title>Test Product</title><meta name="description" content="Desc" /></head><body>kullanım şekli: günde 1 kez</body></html>',
    { status: 200, headers: { 'content-type': 'text/html' } }
  );
});

vi.stubGlobal('fetch', defaultFetch as any);

// Global test setup
beforeAll(async () => {
  // Setup test database connection if needed
  // Setup test Redis connection if needed
});

afterAll(async () => {
  // Cleanup test database
  // Cleanup test Redis
  // Close connections
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
  (mockSupabaseClient as any).__reset?.();

  // Redis defaults for rate limiter + cache usage
  mockRedisClient.get.mockResolvedValue(null);
  mockRedisClient.set.mockResolvedValue('OK');
  mockRedisClient.setex.mockResolvedValue('OK');
  mockRedisClient.del.mockResolvedValue(1);
  mockRedisClient.zrangebyscore.mockResolvedValue([]); // sliding window empty
  mockRedisClient.zadd.mockResolvedValue(1);
  mockRedisClient.zremrangebyscore.mockResolvedValue(0);
  mockRedisClient.pexpire.mockResolvedValue(1);
});

afterEach(() => {
  // Cleanup after each test
});
