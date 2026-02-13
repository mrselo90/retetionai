/**
 * Test Mocks
 * Mock implementations for external services
 */

import { vi } from 'vitest';

// ============================================================================
// Supabase Mocks
// ============================================================================

export const createMockSupabaseClient = () => {
  const createQueryBuilder = () => {
    // Supabase query builders are thenable (awaitable). We'll emulate that.
    let defaultResult: any = { data: null, error: null };
    const queuedResults: any[] = [];

    const builder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn(async () => (queuedResults.length ? queuedResults.shift() : defaultResult)),
      maybeSingle: vi.fn(async () => (queuedResults.length ? queuedResults.shift() : defaultResult)),
      csv: vi.fn(),
      geojson: vi.fn(),
      explain: vi.fn(),
      rollback: vi.fn(),
      returns: vi.fn().mockReturnThis(),

      // Helpers for tests to control awaited results
      __setDefaultResult: (result: any) => {
        defaultResult = result;
        return builder;
      },
      __pushResult: (result: any) => {
        queuedResults.push(result);
        return builder;
      },

      // Thenable support: `await builder` should yield a result object
      then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve(queuedResults.length ? queuedResults.shift() : defaultResult).then(
          onFulfilled,
          onRejected
        ),
      catch: (onRejected: any) =>
        Promise.resolve(queuedResults.length ? queuedResults.shift() : defaultResult).catch(onRejected),
      finally: (onFinally: any) =>
        Promise.resolve(queuedResults.length ? queuedResults.shift() : defaultResult).finally(onFinally),
    };
    return builder;
  };

  const buildersByTable = new Map<string, any>();

  return {
    from: vi.fn((table: string = '__default__') => {
      if (!buildersByTable.has(table)) {
        buildersByTable.set(table, createQueryBuilder());
      }
      return buildersByTable.get(table);
    }),
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
    rpc: vi.fn(),
    __reset: () => {
      buildersByTable.clear();
    },
  };
};

export const mockSupabaseClient = createMockSupabaseClient();

// ============================================================================
// Redis Mocks
// ============================================================================

export const createMockRedisClient = () => {
  return {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(), // Added setex for TTL
    pexpire: vi.fn(),
    del: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    exists: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    keys: vi.fn(),
    flushall: vi.fn(),
    incr: vi.fn(),
    decr: vi.fn(),
    hget: vi.fn(),
    hset: vi.fn(),
    hdel: vi.fn(),
    hgetall: vi.fn(),
    zadd: vi.fn(),
    zrange: vi.fn(),
    zrangebyscore: vi.fn(),
    zrem: vi.fn(),
    zremrangebyscore: vi.fn(),
    zcard: vi.fn(),
    quit: vi.fn(),
    disconnect: vi.fn(),
  };
};

export const mockRedisClient = createMockRedisClient();

// ============================================================================
// OpenAI Mocks
// ============================================================================

export const createMockOpenAI = () => {
  return {
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [
          {
            embedding: new Array(1536).fill(0).map(() => Math.random()),
            index: 0,
          },
        ],
        usage: {
          prompt_tokens: 10,
          total_tokens: 10,
        },
      }),
    },
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Test AI response',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        }),
      },
    },
  };
};

export const mockOpenAI = createMockOpenAI();

// ============================================================================
// WhatsApp Mocks
// ============================================================================

export const createMockWhatsApp = () => {
  return {
    sendMessage: vi.fn().mockResolvedValue({
      messageId: 'test-message-id',
      status: 'sent',
    }),
    verifyWebhook: vi.fn().mockReturnValue(true),
    parseWebhook: vi.fn().mockReturnValue({
      from: '+905551112233',
      message: 'Test message',
      timestamp: Date.now(),
    }),
  };
};

export const mockWhatsApp = createMockWhatsApp();

// ============================================================================
// BullMQ Mocks
// ============================================================================

export const createMockQueue = () => {
  return {
    add: vi.fn().mockResolvedValue({
      id: 'test-job-id',
      name: 'test-job',
      data: {},
    }),
    getJob: vi.fn(),
    getJobs: vi.fn(),
    remove: vi.fn(),
    clean: vi.fn(),
    close: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  };
};

export const mockQueue = createMockQueue();

// ============================================================================
// Shopify Mocks
// ============================================================================

export const createMockShopify = () => {
  return {
    verifyHMAC: vi.fn().mockReturnValue(true),
    getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
    subscribeToWebhooks: vi.fn().mockResolvedValue(true),
    getShop: vi.fn().mockResolvedValue({
      id: 'test-shop-id',
      name: 'Test Shop',
      domain: 'test-shop.myshopify.com',
    }),
  };
};

export const mockShopify = createMockShopify();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Reset all mocks
 */
export function resetAllMocks() {
  vi.clearAllMocks();
}

/**
 * Setup default mock responses
 */
export function setupDefaultMocks() {
  // Setup default Supabase responses
  mockSupabaseClient.from().select().eq().single.mockResolvedValue({
    data: null,
    error: null,
  });

  // Setup default Redis responses
  mockRedisClient.get.mockResolvedValue(null);
  mockRedisClient.set.mockResolvedValue('OK');
  mockRedisClient.ping.mockResolvedValue('PONG');

  // Setup default OpenAI responses
  mockOpenAI.embeddings.create.mockResolvedValue({
    data: [
      {
        embedding: new Array(1536).fill(0).map(() => Math.random()),
        index: 0,
      },
    ],
    usage: {
      prompt_tokens: 10,
      total_tokens: 10,
    },
  });
}
