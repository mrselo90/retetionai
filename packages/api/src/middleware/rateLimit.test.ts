/**
 * Rate Limit Middleware Tests
 * Tests for rate limiting functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimitMiddleware } from './rateLimit';
import { getRedisClient } from '@recete/shared';
import { mockRedisClient } from '../test/mocks';
import { createMockContext } from '../test/helpers';

// Mock Redis client
vi.mock('@recete/shared', async () => {
  const actual = await vi.importActual('@recete/shared');
  return {
    ...actual,
    getRedisClient: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('rateLimitMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRedisClient as any).mockReturnValue(mockRedisClient);
  });

  it('should allow request within rate limit', async () => {
    const context = createMockContext({
      req: {
        header: vi.fn((name: string) => {
          if (name === 'x-forwarded-for') return '192.168.1.1';
          return undefined;
        }),
        method: 'GET',
        path: '/api/products',
      } as any,
    });

    // Mock: no requests in current window
    mockRedisClient.zrangebyscore.mockResolvedValue([]);
    mockRedisClient.zadd.mockResolvedValue(1);
    mockRedisClient.pexpire.mockResolvedValue(1);
    mockRedisClient.zremrangebyscore.mockResolvedValue(0);

    const next = vi.fn();
    await rateLimitMiddleware(context as any, next);

    expect(next).toHaveBeenCalled();
    expect(context.header).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
    expect(context.header).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
  });

  it('should reject request over rate limit', async () => {
    const context = createMockContext({
      req: {
        header: vi.fn((name: string) => {
          if (name === 'x-forwarded-for') return '192.168.1.1';
          return undefined;
        }),
        method: 'GET',
        path: '/api/products',
      } as any,
    });

    // Mock: 100 requests already in window (ip limit is 100/min)
    const many = Array.from({ length: 200 }, (_, i) => String(1000 + i)); // WITHSCORES => pairs
    mockRedisClient.zrangebyscore.mockResolvedValue(many);

    const next = vi.fn();
    const result = await rateLimitMiddleware(context as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.status).toBe(429);
  });

  it('should identify client by IP address', async () => {
    const context = createMockContext({
      req: {
        header: vi.fn((name: string) => {
          if (name === 'x-forwarded-for') return '192.168.1.100';
          return undefined;
        }),
        method: 'GET',
        path: '/api/products',
      } as any,
    });

    mockRedisClient.zrangebyscore.mockResolvedValue([]);
    mockRedisClient.zadd.mockResolvedValue(1);
    mockRedisClient.pexpire.mockResolvedValue(1);
    mockRedisClient.zremrangebyscore.mockResolvedValue(0);

    const next = vi.fn();
    await rateLimitMiddleware(context as any, next);

    // Should use IP address for rate limiting
    expect(mockRedisClient.zrangebyscore).toHaveBeenCalled();
    const redisKey = (mockRedisClient.zrangebyscore as any).mock.calls[0][0];
    expect(redisKey).toContain('ratelimit:ip:');
    expect(redisKey).toContain('192.168.1.100');
  });

  it('should set rate limit headers', async () => {
    const context = createMockContext({
      req: {
        header: vi.fn((name: string) => {
          if (name === 'x-forwarded-for') return '192.168.1.1';
          return undefined;
        }),
        method: 'GET',
        path: '/api/products',
      } as any,
    });

    mockRedisClient.zrangebyscore.mockResolvedValue([]);
    mockRedisClient.zadd.mockResolvedValue(1);
    mockRedisClient.pexpire.mockResolvedValue(1);
    mockRedisClient.zremrangebyscore.mockResolvedValue(0);

    const next = vi.fn();
    await rateLimitMiddleware(context as any, next);

    expect(context.header).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
    expect(context.header).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
    expect(context.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });
});
