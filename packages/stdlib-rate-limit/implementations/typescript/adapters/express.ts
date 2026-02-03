// ============================================================================
// ISL Standard Library - Express Rate Limit Middleware
// @stdlib/rate-limit/adapters/express
// Version: 1.0.0
// ============================================================================

import {
  RateLimitAction,
  IdentifierType,
  type RateLimitConfig,
  type CheckResult,
} from '../types';
import { RateLimiter } from '../rate-limiter';

// ============================================================================
// EXPRESS TYPES (minimal to avoid dependency)
// ============================================================================

export interface Request {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  path?: string;
  method?: string;
  user?: { id?: string; role?: string };
  session?: { id?: string };
  get(name: string): string | undefined;
}

export interface Response {
  status(code: number): Response;
  json(body: unknown): Response;
  set(field: string, value: string): Response;
  setHeader(name: string, value: string): Response;
}

export type NextFunction = (err?: Error) => void;

export type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

// ============================================================================
// MIDDLEWARE OPTIONS
// ============================================================================

export interface RateLimitMiddlewareOptions {
  limiter: RateLimiter;
  
  // Config selection
  configName?: string;
  getConfigName?: (req: Request) => string;
  
  // Key extraction
  keyGenerator?: (req: Request) => string;
  identifierType?: IdentifierType;
  getIdentifierType?: (req: Request) => IdentifierType;
  
  // Weight/cost
  getWeight?: (req: Request) => number;
  
  // Response customization
  handler?: (req: Request, res: Response, result: CheckResult) => void;
  message?: string | ((result: CheckResult) => string);
  statusCode?: number;
  
  // Skip conditions
  skip?: (req: Request) => boolean | Promise<boolean>;
  
  // Headers
  includeHeaders?: boolean;
  standardHeaders?: boolean;  // Use draft-6 standard headers
  legacyHeaders?: boolean;    // Use X-RateLimit-* headers
  
  // Logging
  onRateLimited?: (req: Request, result: CheckResult) => void | Promise<void>;
}

// ============================================================================
// DEFAULT IMPLEMENTATIONS
// ============================================================================

function defaultKeyGenerator(req: Request): string {
  // Try multiple sources for IP
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    if (ip) return ip.trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0]! : realIp;
  }
  
  return req.ip ?? '127.0.0.1';
}

function defaultHandler(req: Request, res: Response, result: CheckResult): void {
  res.status(429).json({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: result.retryAfterMs ? Math.ceil(result.retryAfterMs / 1000) : undefined,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.resetAt.toISOString(),
  });
}

// ============================================================================
// MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create Express middleware for rate limiting
 * 
 * @example
 * ```typescript
 * import { createRateLimiter, createMemoryStorage } from '@isl-lang/stdlib-rate-limit';
 * import { rateLimitMiddleware } from '@isl-lang/stdlib-rate-limit/adapters/express';
 * 
 * const limiter = createRateLimiter({
 *   storage: createMemoryStorage(),
 *   configs: [{ name: 'api', limit: 100, windowMs: 60000 }]
 * });
 * 
 * app.use('/api', rateLimitMiddleware({
 *   limiter,
 *   configName: 'api'
 * }));
 * ```
 */
export function rateLimitMiddleware(options: RateLimitMiddlewareOptions): ExpressMiddleware {
  const {
    limiter,
    configName,
    getConfigName,
    keyGenerator = defaultKeyGenerator,
    identifierType = IdentifierType.IP,
    getIdentifierType,
    getWeight,
    handler = defaultHandler,
    message,
    statusCode = 429,
    skip,
    includeHeaders = true,
    standardHeaders = true,
    legacyHeaders = true,
    onRateLimited,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check skip condition
      if (skip && await skip(req)) {
        return next();
      }

      // Extract key and config
      const key = keyGenerator(req);
      const config = getConfigName?.(req) ?? configName ?? 'default';
      const idType = getIdentifierType?.(req) ?? identifierType;
      const weight = getWeight?.(req) ?? 1;

      // Check rate limit
      const result = await limiter.checkAndIncrement({
        key,
        identifierType: idType,
        configName: config,
        weight,
        metadata: {
          path: req.path ?? '',
          method: req.method ?? '',
          userAgent: req.get?.('user-agent') ?? '',
        },
      });

      // Set headers
      if (includeHeaders && result.headers) {
        for (const [name, value] of Object.entries(result.headers)) {
          res.setHeader(name, value);
        }
      }

      // Add standard headers
      if (standardHeaders) {
        res.setHeader('RateLimit-Limit', String(result.limit));
        res.setHeader('RateLimit-Remaining', String(result.remaining));
        res.setHeader('RateLimit-Reset', String(Math.ceil(result.resetAt.getTime() / 1000)));
        
        if (result.retryAfterMs) {
          res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
        }
      }

      // Add legacy headers
      if (legacyHeaders) {
        res.setHeader('X-RateLimit-Limit', String(result.limit));
        res.setHeader('X-RateLimit-Remaining', String(result.remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt.getTime() / 1000)));
      }

      // Handle result
      if (result.allowed) {
        return next();
      }

      // Rate limited
      if (onRateLimited) {
        await onRateLimited(req, result);
      }

      // Handle rate limit response
      if (handler !== defaultHandler) {
        return handler(req, res, result);
      }

      // Default response
      const errorMessage = typeof message === 'function' ? message(result) : message;
      
      res.status(statusCode).json({
        error: 'Too Many Requests',
        message: errorMessage ?? 'Rate limit exceeded. Please try again later.',
        retryAfter: result.retryAfterMs ? Math.ceil(result.retryAfterMs / 1000) : undefined,
        limit: result.limit,
        remaining: result.remaining,
        resetAt: result.resetAt.toISOString(),
      });
    } catch (error) {
      // Fail open on errors
      next();
    }
  };
}

// ============================================================================
// CONVENIENCE MIDDLEWARE FACTORIES
// ============================================================================

/**
 * Create IP-based rate limit middleware
 */
export function ipRateLimit(
  limiter: RateLimiter,
  configName: string,
  options?: Partial<RateLimitMiddlewareOptions>
): ExpressMiddleware {
  return rateLimitMiddleware({
    limiter,
    configName,
    identifierType: IdentifierType.IP,
    ...options,
  });
}

/**
 * Create user-based rate limit middleware
 */
export function userRateLimit(
  limiter: RateLimiter,
  configName: string,
  options?: Partial<RateLimitMiddlewareOptions>
): ExpressMiddleware {
  return rateLimitMiddleware({
    limiter,
    configName,
    identifierType: IdentifierType.USER_ID,
    keyGenerator: (req) => req.user?.id ?? 'anonymous',
    ...options,
  });
}

/**
 * Create API key-based rate limit middleware
 */
export function apiKeyRateLimit(
  limiter: RateLimiter,
  configName: string,
  options?: Partial<RateLimitMiddlewareOptions>
): ExpressMiddleware {
  return rateLimitMiddleware({
    limiter,
    configName,
    identifierType: IdentifierType.API_KEY,
    keyGenerator: (req) => {
      const apiKey = req.headers['x-api-key'] ?? req.headers['authorization'];
      return (Array.isArray(apiKey) ? apiKey[0] : apiKey) ?? 'no-key';
    },
    ...options,
  });
}

/**
 * Create endpoint-specific rate limit middleware
 */
export function endpointRateLimit(
  limiter: RateLimiter,
  configName: string,
  options?: Partial<RateLimitMiddlewareOptions>
): ExpressMiddleware {
  return rateLimitMiddleware({
    limiter,
    configName,
    keyGenerator: (req) => {
      const ip = defaultKeyGenerator(req);
      return `${req.method ?? 'GET'}:${req.path ?? '/'}:${ip}`;
    },
    ...options,
  });
}

// ============================================================================
// SLOW DOWN MIDDLEWARE
// ============================================================================

export interface SlowDownOptions {
  limiter: RateLimiter;
  configName: string;
  delayAfter?: number;      // Start delaying after this many requests
  delayMs?: number;         // Initial delay in ms
  maxDelayMs?: number;      // Maximum delay in ms
  skip?: (req: Request) => boolean | Promise<boolean>;
}

/**
 * Create slow-down middleware that adds progressive delay
 */
export function slowDown(options: SlowDownOptions): ExpressMiddleware {
  const {
    limiter,
    configName,
    delayAfter = 1,
    delayMs = 1000,
    maxDelayMs = 30000,
    skip,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (skip && await skip(req)) {
        return next();
      }

      const key = defaultKeyGenerator(req);
      const status = await limiter.getStatus({
        key,
        identifierType: IdentifierType.IP,
        configName,
      });

      const excess = Math.max(0, status.state.currentCount - delayAfter);
      if (excess > 0) {
        const delay = Math.min(excess * delayMs, maxDelayMs);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      next();
    } catch {
      next();
    }
  };
}
