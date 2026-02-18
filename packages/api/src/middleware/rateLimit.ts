import { Context, Next } from 'hono';
import { getRedisClient } from '@recete/shared';

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
  // Per IP: 100 requests per minute
  ip: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyPrefix: 'ratelimit:ip:',
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
    // If Redis fails, allow the request (fail open)
    console.error('Rate limit check failed:', error);
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      reset: Math.ceil((now + config.windowMs) / 1000),
    };
  }
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(c: Context): {
  type: 'ip' | 'apiKey' | 'merchant';
  identifier: string;
} {
  // Try to get merchant ID from context (JWT auth)
  const merchantId = c.get('merchantId');
  if (merchantId) {
    return { type: 'merchant', identifier: merchantId };
  }

  // Try to get API key from header
  const authHeader = c.req.header('Authorization') || c.req.header('X-Api-Key');
  if (authHeader && authHeader.startsWith('gg_live_')) {
    // API key format detected
    return { type: 'apiKey', identifier: authHeader };
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
 * Applies rate limiting based on client type (IP, API key, or merchant)
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  const { type, identifier } = getClientIdentifier(c);
  const config = RATE_LIMITS[type];

  const result = await checkRateLimit(identifier, config);

  // Add rate limit headers
  c.header('X-RateLimit-Limit', result.limit.toString());
  c.header('X-RateLimit-Remaining', result.remaining.toString());
  c.header('X-RateLimit-Reset', result.reset.toString());

  if (!result.allowed) {
    return c.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${result.limit} per ${config.windowMs / 1000} seconds. Try again after ${new Date(result.reset * 1000).toISOString()}`,
        retryAfter: result.reset - Math.floor(Date.now() / 1000),
      },
      429
    );
  }

  await next();
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
    console.warn(
      `Rate limit warning: ${type}:${identifier} has ${result.remaining} requests remaining`
    );
  }

  await next();
}
