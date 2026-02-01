// ============================================================================
// ISL Standard Library - Idempotency
// @intentos/stdlib-idempotency
// ============================================================================

// Core types
export * from './types';

// Utilities
export {
  validateKey,
  prefixKey,
  unprefixKey,
  computeRequestHash,
  computeHttpRequestHash,
  canonicalize,
  generateLockToken,
  isValidLockToken,
  calculateExpiration,
  isExpired,
  remainingTtl,
  serializeResponse,
  deserializeResponse,
  parseResponseBody,
  byteSize,
  validateResponseSize,
  calculateBackoff,
  sleep,
  generateIdempotencyKey,
  generateDeterministicKey,
  wrapError,
  isRetriableError,
} from './utils';

// Store implementations
export { MemoryIdempotencyStore, createMemoryStore } from './store/memory';
export type { MemoryStoreOptions } from './store/memory';

export { RedisIdempotencyStore, createRedisStore } from './store/redis';
export type { RedisStoreOptions, RedisClient } from './store/redis';

export { PostgresIdempotencyStore, createPostgresStore, CREATE_TABLE_SQL } from './store/postgres';
export type { PostgresStoreOptions, PostgresClient, PostgresPool } from './store/postgres';

// Manager
export { IdempotencyManager, createIdempotencyManager } from './manager';
export type { IdempotencyManagerOptions, ExecuteResult } from './manager';

// Express middleware
export { createIdempotencyMiddleware, skipIdempotency } from './middleware/express';
export type { ExpressIdempotencyOptions, ExpressMiddleware } from './middleware/express';

// Fastify plugin
export { idempotencyPlugin, createIdempotencyHandler } from './middleware/fastify';
export type { FastifyPluginOptions } from './middleware/fastify';
