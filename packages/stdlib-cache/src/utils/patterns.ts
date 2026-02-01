/**
 * Cache Patterns - Common caching patterns.
 */

import type { Cache, SetOptions } from '../types';

/**
 * Cache-aside pattern decorator
 */
export function withCache<T, Args extends unknown[]>(
  cache: Cache<T>,
  keyFn: (...args: Args) => string,
  options?: SetOptions
) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: Args) {
      const key = keyFn(...args);
      
      // Try cache first
      const cached = await cache.get(key);
      if (cached.ok) {
        return cached.data.value;
      }

      // Call original method
      const result = await originalMethod.apply(this, args);

      // Store in cache
      await cache.set(key, result, options);

      return result;
    };

    return descriptor;
  };
}

/**
 * Cache-aside helper function
 */
export async function cacheAside<T>(
  cache: Cache<T>,
  key: string,
  factory: () => Promise<T>,
  options?: SetOptions
): Promise<T> {
  return cache.getOrSet(key, factory, options);
}

/**
 * Write-through pattern
 */
export async function writeThrough<T>(
  cache: Cache<T>,
  key: string,
  value: T,
  persist: (value: T) => Promise<void>,
  options?: SetOptions
): Promise<void> {
  // Write to cache first
  await cache.set(key, value, options);
  
  // Then persist
  await persist(value);
}

/**
 * Write-behind pattern (async write)
 */
export function writeBehind<T>(
  cache: Cache<T>,
  persist: (key: string, value: T) => Promise<void>,
  batchSize = 100,
  flushInterval = 5000
) {
  const pending = new Map<string, T>();
  let flushTimer: NodeJS.Timeout | null = null;

  const flush = async () => {
    if (pending.size === 0) return;

    const batch = new Map(pending);
    pending.clear();

    for (const [key, value] of batch) {
      try {
        await persist(key, value);
      } catch (error) {
        // Re-queue on failure
        pending.set(key, value);
      }
    }
  };

  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      await flush();
    }, flushInterval);
  };

  return {
    async set(key: string, value: T, options?: SetOptions): Promise<void> {
      await cache.set(key, value, options);
      pending.set(key, value);

      if (pending.size >= batchSize) {
        await flush();
      } else {
        scheduleFlush();
      }
    },

    async flush(): Promise<void> {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      await flush();
    },

    get pendingCount(): number {
      return pending.size;
    },
  };
}

/**
 * Read-through pattern
 */
export async function readThrough<T>(
  cache: Cache<T>,
  key: string,
  fetch: () => Promise<T>,
  options?: SetOptions
): Promise<T> {
  const cached = await cache.get(key);
  
  if (cached.ok) {
    return cached.data.value;
  }

  const value = await fetch();
  await cache.set(key, value, options);
  return value;
}

/**
 * Refresh-ahead pattern
 */
export function refreshAhead<T>(
  cache: Cache<T>,
  key: string,
  fetch: () => Promise<T>,
  options?: SetOptions & { refreshThreshold?: number }
) {
  const threshold = options?.refreshThreshold ?? 0.75;

  return async (): Promise<T> => {
    const cached = await cache.get(key);

    if (cached.ok) {
      const entry = cached.data;
      
      // Check if we should refresh
      if (entry.expiresAt) {
        const now = Date.now();
        const created = entry.createdAt.getTime();
        const expires = entry.expiresAt.getTime();
        const elapsed = now - created;
        const ttl = expires - created;

        if (elapsed / ttl >= threshold) {
          // Refresh in background
          fetch().then((value) => {
            cache.set(key, value, options);
          });
        }
      }

      return entry.value;
    }

    const value = await fetch();
    await cache.set(key, value, options);
    return value;
  };
}

/**
 * Circuit breaker for cache
 */
export function withCircuitBreaker<T>(
  cache: Cache<T>,
  options: {
    failureThreshold?: number;
    resetTimeout?: number;
    fallback?: (key: string) => Promise<T>;
  } = {}
) {
  const { failureThreshold = 5, resetTimeout = 30000, fallback } = options;
  
  let failures = 0;
  let lastFailure = 0;
  let isOpen = false;

  return {
    async get(key: string) {
      if (isOpen) {
        if (Date.now() - lastFailure >= resetTimeout) {
          isOpen = false;
          failures = 0;
        } else if (fallback) {
          return fallback(key);
        } else {
          throw new Error('Circuit breaker is open');
        }
      }

      try {
        const result = await cache.get(key);
        failures = 0;
        return result;
      } catch (error) {
        failures++;
        lastFailure = Date.now();

        if (failures >= failureThreshold) {
          isOpen = true;
        }

        throw error;
      }
    },

    get isOpen(): boolean {
      return isOpen;
    },

    reset(): void {
      isOpen = false;
      failures = 0;
    },
  };
}
