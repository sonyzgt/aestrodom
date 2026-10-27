import Redis from "ioredis";

/**
 * Fixed-window rate limiter. In-memory for development / single node; Redis when REDIS_URL is set
 * so limits hold across multiple app instances.
 */
export interface RateLimitOptions {
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetSec: number;
}

interface Store {
  hit(key: string, windowSec: number): Promise<{ count: number; ttl: number }>;
}

class MemoryStore implements Store {
  private buckets = new Map<string, { count: number; expires: number }>();
  async hit(key: string, windowSec: number) {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b || b.expires <= now) {
      b = { count: 0, expires: now + windowSec * 1000 };
      this.buckets.set(key, b);
    }
    b.count++;
    if (this.buckets.size > 50_000) {
      for (const [k, v] of this.buckets) if (v.expires <= now) this.buckets.delete(k);
    }
    return { count: b.count, ttl: Math.ceil((b.expires - now) / 1000) };
  }
}

class RedisStore implements Store {
  constructor(private redis: Redis) {}
  async hit(key: string, windowSec: number) {
    const k = `rl:${key}`;
    const res = await this.redis.multi().incr(k).expire(k, windowSec, "NX").ttl(k).exec();
    const count = Number(res?.[0]?.[1] ?? 1);
    const ttl = Number(res?.[2]?.[1] ?? windowSec);
    return { count, ttl: ttl > 0 ? ttl : windowSec };
  }
}

const g = globalThis as unknown as { __rlStore?: Store };

function store(): Store {
  if (!g.__rlStore) {
    const url = process.env.REDIS_URL;
    g.__rlStore = url ? new RedisStore(new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false })) : new MemoryStore();
  }
  return g.__rlStore;
}

export async function rateLimit(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
  const { count, ttl } = await store().hit(key, opts.windowSec);
  return { ok: count <= opts.limit, remaining: Math.max(0, opts.limit - count), resetSec: ttl };
}

/** Named limits used across the API. */
export const LIMITS = {
  ai: { limit: 10, windowSec: 60 },
  projectCreate: { limit: 5, windowSec: 60 * 10 },
  deploy: { limit: 10, windowSec: 60 * 10 },
  tokenPrepare: { limit: 30, windowSec: 60 * 10 },
  register: { limit: 5, windowSec: 60 * 60 },
  billing: { limit: 20, windowSec: 60 * 10 },
  apiKeys: { limit: 20, windowSec: 60 * 60 },
  vote: { limit: 60, windowSec: 60 * 10 },
  freeLaunch: { limit: 10, windowSec: 60 * 60 },
  passStatus: { limit: 120, windowSec: 60 * 10 },
  default: { limit: 120, windowSec: 60 },
} satisfies Record<string, RateLimitOptions>;

export function createMemoryLimiter() {
  const s = new MemoryStore();
  return async (key: string, opts: RateLimitOptions): Promise<RateLimitResult> => {
    const { count, ttl } = await s.hit(key, opts.windowSec);
    return { ok: count <= opts.limit, remaining: Math.max(0, opts.limit - count), resetSec: ttl };
  };
}
