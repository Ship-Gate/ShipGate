/**
 * Cache Health Checks
 * 
 * Health check implementations for caching systems.
 */

import type {
  HealthCheckConfig,
  CheckResult,
  CacheCheckConfig,
  CacheConnection,
} from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════
// Cache Check Factory
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a cache health check
 */
export function createCacheCheck(config: CacheCheckConfig): HealthCheckConfig {
  return {
    name: config.name,
    critical: config.critical ?? false,
    timeout: config.timeout ?? 2000,
    check: async () => performCacheCheck(config),
  };
}

/**
 * Perform the actual cache health check
 */
async function performCacheCheck(config: CacheCheckConfig): Promise<CheckResult> {
  const start = Date.now();

  try {
    switch (config.type) {
      case 'redis':
        return await checkRedis(config, start);
      case 'memcached':
        return await checkMemcached(config, start);
      case 'in-memory':
        return checkInMemory(start);
      default:
        return {
          status: 'unhealthy',
          message: `Unknown cache type: ${config.type}`,
          timestamp: Date.now(),
        };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Redis Check
// ═══════════════════════════════════════════════════════════════════════════

async function checkRedis(config: CacheCheckConfig, start: number): Promise<CheckResult> {
  try {
    const Redis = (await import('ioredis')).default;
    const redis = new Redis({
      host: config.host ?? 'localhost',
      port: config.port ?? 6379,
      connectTimeout: config.timeout ?? 2000,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      const pong = await redis.ping();
      const latency = Date.now() - start;

      // Get additional info for detailed health
      const info = await redis.info('server');
      const memoryInfo = await redis.info('memory');

      const usedMemory = parseRedisInfoValue(memoryInfo, 'used_memory_human');
      const version = parseRedisInfoValue(info, 'redis_version');

      return {
        status: pong === 'PONG' ? 'healthy' : 'degraded',
        latency,
        details: {
          type: 'redis',
          version,
          memory: usedMemory,
        },
        timestamp: Date.now(),
      };
    } finally {
      await redis.quit();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      return {
        status: 'unhealthy',
        message: 'Redis driver (ioredis) not installed',
        timestamp: Date.now(),
      };
    }
    throw error;
  }
}

/**
 * Parse a value from Redis INFO output
 */
function parseRedisInfoValue(info: string, key: string): string | undefined {
  const match = info.match(new RegExp(`${key}:(.+?)\\r?\\n`));
  return match ? match[1].trim() : undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// Memcached Check
// ═══════════════════════════════════════════════════════════════════════════

async function checkMemcached(config: CacheCheckConfig, start: number): Promise<CheckResult> {
  try {
    const Memcached = (await import('memcached')).default;
    
    return new Promise((resolve) => {
      const memcached = new Memcached(`${config.host ?? 'localhost'}:${config.port ?? 11211}`, {
        timeout: config.timeout ?? 2000,
      });

      memcached.stats((err, stats) => {
        const latency = Date.now() - start;

        if (err) {
          memcached.end();
          resolve({
            status: 'unhealthy',
            latency,
            message: err.message,
            timestamp: Date.now(),
          });
          return;
        }

        memcached.end();
        resolve({
          status: 'healthy',
          latency,
          details: {
            type: 'memcached',
            stats: stats?.[0],
          },
          timestamp: Date.now(),
        });
      });
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
      return {
        status: 'unhealthy',
        message: 'Memcached driver (memcached) not installed',
        timestamp: Date.now(),
      };
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// In-Memory Cache Check
// ═══════════════════════════════════════════════════════════════════════════

function checkInMemory(start: number): CheckResult {
  // In-memory cache is always healthy if the process is running
  return {
    status: 'healthy',
    latency: Date.now() - start,
    details: {
      type: 'in-memory',
      heapUsed: process.memoryUsage().heapUsed,
    },
    timestamp: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Generic Cache Check with Connection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a cache check using an existing connection
 */
export function createCacheCheckWithConnection(
  name: string,
  connection: CacheConnection,
  options: {
    critical?: boolean;
    timeout?: number;
  } = {}
): HealthCheckConfig {
  return {
    name,
    critical: options.critical ?? false,
    timeout: options.timeout ?? 2000,
    check: async () => {
      const start = Date.now();

      try {
        const result = await Promise.race([
          connection.ping(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Ping timeout')), options.timeout ?? 2000)
          ),
        ]);

        const latency = Date.now() - start;

        return {
          status: result === 'PONG' ? 'healthy' : 'degraded',
          latency,
          timestamp: Date.now(),
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          latency: Date.now() - start,
          message: error instanceof Error ? error.message : 'Ping failed',
          timestamp: Date.now(),
        };
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Cache Statistics Check
// ═══════════════════════════════════════════════════════════════════════════

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize?: number;
}

/**
 * Create a check for cache hit rate and memory usage
 */
export function createCacheStatsCheck(
  name: string,
  getCacheStats: () => CacheStats | Promise<CacheStats>,
  options: {
    minHitRate?: number;
    maxSizePercent?: number;
    critical?: boolean;
  } = {}
): HealthCheckConfig {
  const minHitRate = options.minHitRate ?? 0.5; // 50% hit rate
  const maxSizePercent = options.maxSizePercent ?? 0.9; // 90% of max size

  return {
    name: `${name}-stats`,
    critical: options.critical ?? false,
    check: async () => {
      const start = Date.now();

      try {
        const stats = await getCacheStats();
        const totalRequests = stats.hits + stats.misses;
        const hitRate = totalRequests > 0 ? stats.hits / totalRequests : 1;

        let status: CheckResult['status'] = 'healthy';
        const messages: string[] = [];

        if (hitRate < minHitRate) {
          status = 'degraded';
          messages.push(`Low hit rate: ${(hitRate * 100).toFixed(1)}%`);
        }

        if (stats.maxSize && stats.size / stats.maxSize > maxSizePercent) {
          status = 'degraded';
          messages.push(`Cache near capacity: ${((stats.size / stats.maxSize) * 100).toFixed(1)}%`);
        }

        return {
          status,
          latency: Date.now() - start,
          message: messages.join('; ') || undefined,
          details: {
            hits: stats.hits,
            misses: stats.misses,
            hitRate: `${(hitRate * 100).toFixed(1)}%`,
            size: stats.size,
            maxSize: stats.maxSize,
          },
          timestamp: Date.now(),
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          latency: Date.now() - start,
          message: error instanceof Error ? error.message : 'Failed to get cache stats',
          timestamp: Date.now(),
        };
      }
    },
  };
}
