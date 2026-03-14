import type { Context, Next } from 'hono';

const SKIP_AUTH_PATHS = ['/api/v1/health', '/api/v1/openapi.json'];

function loadApiKeys(): Set<string> {
  const raw = process.env['SHIPGATE_API_KEYS'] ?? '';
  const keys = raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  return new Set(keys);
}

export async function authMiddleware(c: Context, next: Next) {
  if (SKIP_AUTH_PATHS.includes(c.req.path)) {
    return next();
  }

  const validKeys = loadApiKeys();

  if (validKeys.size === 0) {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ error: 'Missing Authorization header' }, 401);
  }

  const match = authHeader.match(/^Bearer\s+(sg_key_\S+)$/);
  if (!match) {
    return c.json(
      { error: 'Invalid Authorization format. Expected: Bearer sg_key_...' },
      401,
    );
  }

  const apiKey = match[1]!;
  if (!validKeys.has(apiKey)) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  return next();
}
