import {
  RATE_LIMIT_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
} from './constants';
import { shouldTrustProxy } from './env';

/** In-memory store for rate limiting when Redis is not configured. */
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/** Track if we've warned about TRUST_PROXY (once per process). */
let trustProxyWarned = false;

function memoryPrune() {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetAt <= now) memoryStore.delete(key);
  }
}

async function rateLimitMemory(key: string): Promise<boolean> {
  const now = Date.now();
  if (memoryStore.size > 10000) memoryPrune();

  const entry = memoryStore.get(key);
  if (!entry) {
    memoryStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_REQUESTS) return false;
  entry.count += 1;
  return true;
}

type RedisLike = { incr: (k: string) => Promise<number>; expire: (k: string, s: number) => Promise<number | string> };
let redisClient: RedisLike | null | undefined = undefined;
let redisInitPromise: Promise<RedisLike | null> | null = null;

async function getRedisClient(): Promise<RedisLike | null> {
  if (redisClient !== undefined) return redisClient;
  
  // Prevent multiple concurrent initializations
  if (redisInitPromise) return redisInitPromise;
  
  redisInitPromise = (async () => {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      redisClient = null;
      return null;
    }
    try {
      const { Redis } = await import('@upstash/redis');
      redisClient = Redis.fromEnv() as RedisLike;
      return redisClient;
    } catch {
      redisClient = null;
      return null;
    }
  })();
  
  return redisInitPromise;
}

/**
 * Returns true if the request is allowed, false if rate limited.
 * Uses Redis (Upstash) when UPSTASH_REDIS_REST_URL or KV_REST_API_URL is set;
 * otherwise falls back to in-memory (single-instance only).
 */
export async function rateLimit(key: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return rateLimitMemory(key);

  const rlKey = `rl:${key}`;
  const windowSeconds = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);
  try {
    const count = await redis.incr(rlKey);
    if (count === 1) await redis.expire(rlKey, windowSeconds);
    return count <= RATE_LIMIT_REQUESTS;
  } catch {
    return rateLimitMemory(key);
  }
}

/**
 * Get client IP from request.
 * Only trusts X-Forwarded-For / X-Real-IP when behind a known proxy (TRUST_PROXY=1 or Vercel).
 * Otherwise returns 'unknown' to avoid IP spoofing bypass of rate limits.
 * 
 * WARNING: When TRUST_PROXY is not set and not on Vercel, all clients share
 * a single rate limit bucket ('unknown'), which may cause issues in production.
 */
export function getClientIp(request: Request): string {
  if (shouldTrustProxy()) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
    const real = request.headers.get('x-real-ip');
    if (real) return real;
  }

  // Warn once per process about potential rate-limit sharing
  if (!trustProxyWarned && process.env.NODE_ENV === 'production') {
    trustProxyWarned = true;
    console.warn(
      '⚠️  TRUST_PROXY not set. All clients share one rate-limit bucket. ' +
        'Set TRUST_PROXY=1 if behind a reverse proxy (nginx, Cloudflare, etc.).'
    );
  }

  return 'unknown';
}
