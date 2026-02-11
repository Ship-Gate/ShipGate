// ============================================================================
// ISL Standard Library - Cache Middleware
// @isl-lang/stdlib-api
// ============================================================================

import type { Result } from '@isl-lang/stdlib-core';
import type { Middleware, ApiResponse } from '../types.js';
import type { ApiError } from '../errors.js';

export interface CacheEntry {
  response: Result<ApiResponse, ApiError>;
  expiresAt: number;
}

export interface CacheStore {
  get(key: string): CacheEntry | undefined;
  set(key: string, entry: CacheEntry): void;
  delete(key: string): void;
  clear(): void;
}

export interface CacheOptions {
  ttlMs: number;
  methods?: string[];
  store?: CacheStore;
  /** Inject clock for deterministic testing. */
  nowFn?: () => number;
}

/**
 * Simple in-memory cache store.
 */
export function createMemoryCacheStore(): CacheStore {
  const cache = new Map<string, CacheEntry>();
  return {
    get(key) { return cache.get(key); },
    set(key, entry) { cache.set(key, entry); },
    delete(key) { cache.delete(key); },
    clear() { cache.clear(); },
  };
}

/**
 * Build a cache key from method + url.
 */
function cacheKey(method: string, url: string): string {
  return `${method}:${url}`;
}

/**
 * Cache middleware with TTL. Only caches safe (GET/HEAD) methods by default.
 */
export function cacheMiddleware(options: CacheOptions): Middleware {
  const {
    ttlMs,
    methods = ['GET', 'HEAD'],
    store = createMemoryCacheStore(),
    nowFn = Date.now,
  } = options;

  return {
    name: 'cache',
    async execute(ctx, next) {
      const { method, url } = ctx.request;

      // Only cache specified methods
      if (!methods.includes(method)) {
        return next(ctx);
      }

      const key = cacheKey(method, url);
      const cached = store.get(key);

      if (cached && cached.expiresAt > nowFn()) {
        return cached.response;
      }

      // Cache miss or expired — delete stale entry
      if (cached) {
        store.delete(key);
      }

      const result = await next(ctx);

      // Only cache successful responses
      if (result.ok) {
        store.set(key, {
          response: result,
          expiresAt: nowFn() + ttlMs,
        });
      }

      return result;
    },
  };
}
