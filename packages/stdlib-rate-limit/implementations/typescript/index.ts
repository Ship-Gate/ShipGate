// ============================================================================
// ISL Standard Library - Rate Limit
// @stdlib/rate-limit
// Version: 1.0.0
// ============================================================================

// Core types
export * from './types';

// Main rate limiter
export { RateLimiter, createRateLimiter } from './rate-limiter';

// Storage implementations
export { MemoryRateLimitStorage, createMemoryStorage } from './storage/memory';
export { RedisRateLimitStorage, createRedisStorage, type RedisClient, type RedisStorageOptions } from './storage/redis';

// Express adapter
export {
  rateLimitMiddleware,
  ipRateLimit,
  userRateLimit,
  apiKeyRateLimit,
  endpointRateLimit,
  slowDown,
  type RateLimitMiddlewareOptions,
  type SlowDownOptions,
  type Request,
  type Response,
  type NextFunction,
  type ExpressMiddleware,
} from './adapters/express';

// Re-export commonly used types for convenience
export {
  RateLimitAction,
  RateLimitAlgorithm,
  IdentifierType,
  RateLimitScope,
} from './types';
