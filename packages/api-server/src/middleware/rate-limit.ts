import type { Context, Next } from 'hono';

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

const WINDOW_MS = 60_000;

function getLimit(): number {
  const env = process.env['SHIPGATE_RATE_LIMIT'];
  if (env) {
    const parsed = Number.parseInt(env, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return 100;
}

function getClientIP(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'unknown'
  );
}

function pruneExpired() {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(ip);
    }
  }
}

export async function rateLimitMiddleware(c: Context, next: Next) {
  const limit = getLimit();
  const ip = getClientIP(c);
  const now = Date.now();

  if (buckets.size > 10_000) {
    pruneExpired();
  }

  let bucket = buckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, bucket);
  }

  bucket.count++;

  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
  c.header('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    c.header('Retry-After', String(retryAfter));
    return c.json(
      { error: 'Rate limit exceeded', retryAfter },
      429,
    );
  }

  return next();
}
