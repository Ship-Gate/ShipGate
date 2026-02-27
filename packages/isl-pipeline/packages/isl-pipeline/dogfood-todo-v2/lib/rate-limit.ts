/**
 * Rate limiting for API routes
 * @intent rate-limit-required
 */
import type { NextRequest } from 'next/server';

const limit = 100;
const windowMs = 60_000;
const store = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(request: NextRequest): Promise<{ success: boolean }> {
  const key = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'anonymous';
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true };
  }

  if (now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true };
  }

  if (entry.count >= limit) {
    return { success: false };
  }

  entry.count++;
  return { success: true };
}
