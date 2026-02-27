/**
 * Standard HTTP Middleware
 */

import type { Middleware, ServerRequest, ServerResponse, Method } from './types';

/**
 * Logger middleware
 */
export function logger(options: {
  format?: 'combined' | 'common' | 'dev' | 'short';
  skip?: (req: ServerRequest) => boolean;
} = {}): Middleware {
  return async (req, res, next) => {
    if (options.skip?.(req)) {
      return next();
    }

    const start = Date.now();
    
    await next();
    
    const duration = Date.now() - start;
    const log = `${req.method} ${req.path} ${duration}ms`;
    
    console.log(`[HTTP] ${log}`);
  };
}

/**
 * CORS middleware
 */
export function cors(options: {
  origins?: string[] | '*';
  methods?: Method[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
} = {}): Middleware {
  const {
    origins = '*',
    methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false,
    maxAge = 86400,
  } = options;

  return async (req, res, next) => {
    const origin = req.headers['origin'] as string;

    // Check if origin is allowed
    let allowedOrigin: string | null = null;
    if (origins === '*') {
      allowedOrigin = '*';
    } else if (origin && origins.includes(origin)) {
      allowedOrigin = origin;
    }

    if (allowedOrigin) {
      res.header('Access-Control-Allow-Origin', allowedOrigin);
    }

    res.header('Access-Control-Allow-Methods', methods.join(', '));
    res.header('Access-Control-Allow-Headers', headers.join(', '));

    if (credentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    res.header('Access-Control-Max-Age', String(maxAge));

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }

    await next();
  };
}

/**
 * Rate limiting middleware
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: ServerRequest) => string;
  message?: string;
}): Middleware {
  const {
    windowMs,
    max,
    keyGenerator = (req) => req.ip || 'unknown',
    message = 'Too many requests, please try again later.',
  } = options;

  const store = new Map<string, { count: number; resetAt: number }>();

  return async (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let record = store.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      store.set(key, record);
    }

    record.count++;

    res.header('X-RateLimit-Limit', String(max));
    res.header('X-RateLimit-Remaining', String(Math.max(0, max - record.count)));
    res.header('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

    if (record.count > max) {
      res.status(429).json({ error: message });
      return;
    }

    await next();
  };
}

/**
 * Request body parser middleware
 */
export function bodyParser(options: {
  limit?: number;
  types?: string[];
} = {}): Middleware {
  const { limit = 1024 * 1024, types = ['application/json'] } = options;

  return async (req, res, next) => {
    // Body parsing is handled by the server
    await next();
  };
}

/**
 * Request validation middleware
 */
export function validate(schema: {
  params?: Record<string, { type: string; required?: boolean }>;
  query?: Record<string, { type: string; required?: boolean }>;
  body?: Record<string, { type: string; required?: boolean }>;
}): Middleware {
  return async (req, res, next) => {
    const errors: string[] = [];

    // Validate params
    if (schema.params) {
      for (const [key, rules] of Object.entries(schema.params)) {
        const value = req.params[key];
        if (rules.required && !value) {
          errors.push(`Missing required param: ${key}`);
        }
      }
    }

    // Validate query
    if (schema.query) {
      for (const [key, rules] of Object.entries(schema.query)) {
        const value = req.query[key];
        if (rules.required && !value) {
          errors.push(`Missing required query param: ${key}`);
        }
      }
    }

    // Validate body
    if (schema.body) {
      try {
        const body = await req.body.json();
        for (const [key, rules] of Object.entries(schema.body)) {
          const value = (body as Record<string, unknown>)[key];
          if (rules.required && value === undefined) {
            errors.push(`Missing required body field: ${key}`);
          }
        }
      } catch {
        errors.push('Invalid JSON body');
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    await next();
  };
}

/**
 * Authentication middleware
 */
export function auth(options: {
  verify: (token: string) => Promise<{ id: string; [key: string]: unknown } | null>;
  optional?: boolean;
}): Middleware {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization'] as string;

    if (!authHeader) {
      if (options.optional) {
        return next();
      }
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await options.verify(token);

    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    req.context.user = user;
    await next();
  };
}

/**
 * Response compression middleware (placeholder)
 */
export function compression(): Middleware {
  return async (req, res, next) => {
    // Compression would be handled at a lower level
    await next();
  };
}

/**
 * Security headers middleware
 */
export function helmet(): Middleware {
  return async (req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.header('Content-Security-Policy', "default-src 'self'");
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    await next();
  };
}

/**
 * Request timeout middleware
 */
export function timeout(ms: number): Middleware {
  return async (req, res, next) => {
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), ms);
    });

    try {
      await Promise.race([next(), timeoutPromise]);
    } catch (error) {
      if (error instanceof Error && error.message === 'Request timeout') {
        res.status(408).json({ error: 'Request Timeout' });
      } else {
        throw error;
      }
    }
  };
}
