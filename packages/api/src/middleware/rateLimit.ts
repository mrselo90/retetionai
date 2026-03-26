import { Context, Next } from 'hono';
import { getRedisClient, logger } from '@recete/shared';

const inMemoryCounters = new Map<string, { count: number; resetAt: number }>();
const IN_MEMORY_WINDOW_MS = 60_000;
const IN_MEMORY_MAX = 30;

function checkInMemoryRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = inMemoryCounters.get(key);
  if (!entry || now > entry.resetAt) {
    inMemoryCounters.set(key, { count: 1, resetAt: now + IN_MEMORY_WINDOW_MS });
    return { allowed: true, remaining: IN_MEMORY_MAX - 1 };
  }
  entry.count++;
  if (entry.count > IN_MEMORY_MAX) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: IN_MEMORY_MAX - entry.count };
}

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix: string; // Redis key prefix
}

/**
 * Default rate limit configurations
 */
const RATE_LIMITS = {
  // Per IP: 100 requests per minute (general API)
  ip: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,
    keyPrefix: 'ratelimit:ip:',
  },
  // Per IP: 200 requests per minute (Shopify webhook endpoint)
  webhookIp: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
    keyPrefix: 'ratelimit:webhook:ip:',
  },
  // Per API key: 1000 requests per hour
  apiKey: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 1000,
    keyPrefix: 'ratelimit:apikey:',
  },
  // Per merchant (JWT): 5000 requests per hour
  merchant: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5000,
    keyPrefix: 'ratelimit:merchant:',
  },
  // Per IP: 10 requests per minute (login/signup)
  auth: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'ratelimit:auth:ip:',
  },
} as const;


/**
 * Sliding window rate limiter using Redis
 */
async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const redis = getRedisClient();
  const redisKey = `${config.keyPrefix}${key}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Get all requests in the current window
    const requests = await redis.zrangebyscore(
      redisKey,
      windowStart,
      now,
      'WITHSCORES'
    );

    const requestCount = Math.ceil(requests.length / 2);

    if (requestCount >= config.maxRequests) {
      // Get the oldest request timestamp to calculate reset time
      const oldestRequest = requests[0];
      const oldestTimestamp = oldestRequest
        ? parseInt(oldestRequest as string)
        : now;
      const reset = oldestTimestamp + config.windowMs;

      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        reset: Math.ceil(reset / 1000), // Convert to seconds
      };
    }

    // Add current request to the window
    await redis.zadd(redisKey, now, `${now}-${Math.random()}`);

    // Set expiration for the key (windowMs + 1 second buffer)
    await redis.pexpire(redisKey, config.windowMs + 1000);

    // Clean up old entries (outside the window)
    await redis.zremrangebyscore(redisKey, 0, windowStart);

    const remaining = config.maxRequests - requestCount - 1;
    const reset = Math.ceil((now + config.windowMs) / 1000);

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: Math.max(0, remaining),
      reset,
    };
  } catch (error) {
    logger.error({ err: error }, 'Rate limit Redis check failed, using in-memory fallback');
    const fallback = checkInMemoryRateLimit(`${config.keyPrefix}${key}`);
    return {
      allowed: fallback.allowed,
      limit: IN_MEMORY_MAX,
      remaining: fallback.remaining,
      reset: Math.ceil((now + IN_MEMORY_WINDOW_MS) / 1000),
    };
  }
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(c: Context): {
  type: 'ip' | 'merchant';
  identifier: string;
} {
  // Try to get merchant ID from context (JWT auth)
  const merchantId = c.get('merchantId');
  if (merchantId) {
    return { type: 'merchant', identifier: merchantId };
  }

  // Fall back to IP address
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';

  return { type: 'ip', identifier: ip };
}

/**
 * Rate limit middleware
 * Applies rate limiting based on client type (IP or merchant)
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  // Bypass rate limiting for internal localhost requests
  const host = c.req.header('host') || '';
  const xff = c.req.header('x-forwarded-for');
  
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return await next();
  }

  const { type, identifier } = getClientIdentifier(c);
  const config = RATE_LIMITS[type];

  const result = await checkRateLimit(identifier, config);

  // Add rate limit headers
  c.header('X-RateLimit-Limit', result.limit.toString());
  c.header('X-RateLimit-Remaining', result.remaining.toString());
  c.header('X-RateLimit-Reset', result.reset.toString());

  if (!result.allowed) {
    logger.warn(
      { host, xff, identifier, type, path: c.req.path },
      `Rate limit exceeded for ${identifier}`
    );
    return c.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${result.limit} per ${config.windowMs / 1000} seconds. Try again after ${new Date(result.reset * 1000).toISOString()}`,
        retryAfter: result.reset - Math.floor(Date.now() / 1000),
      },
      429
    );
  }

  return await next();
}

/**
 * Optional rate limit middleware (doesn't fail, just logs)
 * Useful for monitoring without blocking
 */
export async function optionalRateLimitMiddleware(c: Context, next: Next) {
  const { type, identifier } = getClientIdentifier(c);
  const config = RATE_LIMITS[type];

  const result = await checkRateLimit(identifier, config);

  // Add rate limit headers
  c.header('X-RateLimit-Limit', result.limit.toString());
  c.header('X-RateLimit-Remaining', result.remaining.toString());
  c.header('X-RateLimit-Reset', result.reset.toString());

  // Log if approaching limit (80% threshold)
  if (result.remaining < config.maxRequests * 0.2) {
    logger.warn(
      {
        type,
        identifier,
        remaining: result.remaining,
      },
      `Rate limit warning: ${type}:${identifier} has ${result.remaining} requests remaining`
    );
  }

  return await next();
}

/**
 * Webhook-specific rate limit middleware
 * 200 req/min per IP (separate bucket from general API limits)
 * High enough for legitimate Shopify bursts, low enough to block floods
 */
export async function webhookRateLimitMiddleware(c: Context, next: Next) {
  // Bypass rate limiting for internal localhost requests
  const host = c.req.header('host') || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return await next();
  }

  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';

  const config = RATE_LIMITS.webhookIp;
  const result = await checkRateLimit(ip, config);

  c.header('X-RateLimit-Limit', result.limit.toString());
  c.header('X-RateLimit-Remaining', result.remaining.toString());
  c.header('X-RateLimit-Reset', result.reset.toString());

  if (!result.allowed) {
    return c.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many webhook requests from this IP. Limit: ${result.limit}/min.`,
        retryAfter: result.reset - Math.floor(Date.now() / 1000),
      },
      429
    );
  }

  return await next();
}

/**
 * Auth-specific rate limit middleware
 * 10 req/min per IP for login/signup to prevent credential stuffing
 */
export async function authRateLimitMiddleware(c: Context, next: Next) {
  // Bypass rate limiting for internal localhost requests
  const host = c.req.header('host') || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return await next();
  }

  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';

  const config = RATE_LIMITS.auth;
  const result = await checkRateLimit(ip, config);

  c.header('X-RateLimit-Limit', result.limit.toString());
  c.header('X-RateLimit-Remaining', result.remaining.toString());
  c.header('X-RateLimit-Reset', result.reset.toString());

  if (!result.allowed) {
    return c.json(
      {
        error: 'Too many authentication attempts. Please try again later.',
        retryAfter: result.reset - Math.floor(Date.now() / 1000),
      },
      429
    );
  }

  return await next();
}
