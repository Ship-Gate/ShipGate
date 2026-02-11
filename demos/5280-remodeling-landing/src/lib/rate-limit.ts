/**
 * Simple in-memory rate limiter (BR-001).
 * Limits contact submissions per IP to prevent spam.
 */

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

const requests = new Map<string, number[]>();

function getClientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() ?? realIp ?? 'unknown';
}

function pruneOldEntries(entries: number[]): number[] {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  return entries.filter((t) => t > cutoff);
}

export function isRateLimited(request: Request): boolean {
  const id = getClientId(request);
  const now = Date.now();

  let entries = requests.get(id) ?? [];
  entries = pruneOldEntries(entries);
  requests.set(id, entries);

  if (entries.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  entries.push(now);
  requests.set(id, entries);
  return false;
}
