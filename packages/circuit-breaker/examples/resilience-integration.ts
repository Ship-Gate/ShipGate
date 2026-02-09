/**
 * Resilience Integration Example
 * 
 * Demonstrates circuit breaker + health checks working together
 * in a sample domain (e-commerce order processing).
 */

import { CircuitBreaker, CircuitOpenError } from '../src/circuit-breaker.js';
import {
  createDatabaseCheck,
  createExternalApiCheck,
  createCacheCheck,
  HealthAggregator,
  healthRouter,
} from '@isl-lang/health-check';
import type { CircuitBreakerConfig } from '../src/types.js';
import type { HealthCheckConfig } from '@isl-lang/health-check';

// ═══════════════════════════════════════════════════════════════════════════
// Sample Domain: E-Commerce Order Processing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * External Payment Service Client
 * Protected by circuit breaker
 */
class PaymentServiceClient {
  private circuitBreaker: CircuitBreaker;

  constructor(config: CircuitBreakerConfig) {
    this.circuitBreaker = new CircuitBreaker({
      name: 'payment-service',
      failureThreshold: 50, // Trip at 50% failure rate
      successThreshold: 2,  // Close after 2 successes
      timeout: 5000,        // 5 second timeout
      resetTimeout: 60000, // Wait 60s before retry
      onStateChange: (from, to) => {
        console.log(`[Payment Service] Circuit ${from} -> ${to}`);
      },
      onFailure: (error) => {
        console.error(`[Payment Service] Failure:`, error.message);
      },
      ...config,
    });
  }

  async processPayment(amount: number, cardToken: string): Promise<PaymentResult> {
    return await this.circuitBreaker.execute(async () => {
      // Simulate API call
      const response = await fetch('https://api.payments.com/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, cardToken }),
      });

      if (!response.ok) {
        throw new Error(`Payment failed: ${response.statusText}`);
      }

      return await response.json();
    });
  }

  getStats() {
    return this.circuitBreaker.getStats();
  }
}

/**
 * Database Service Client
 * Protected by circuit breaker
 */
class DatabaseClient {
  private circuitBreaker: CircuitBreaker;

  constructor(config: CircuitBreakerConfig) {
    this.circuitBreaker = new CircuitBreaker({
      name: 'database',
      failureThreshold: 30, // Lower threshold for critical service
      successThreshold: 3,  // More successes needed
      timeout: 3000,
      resetTimeout: 30000,
      ...config,
    });
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return await this.circuitBreaker.execute(async () => {
      // Simulate database query
      const pool = await getDatabasePool();
      const result = await pool.query(sql, params);
      return result.rows;
    });
  }

  getStats() {
    return this.circuitBreaker.getStats();
  }
}

/**
 * Cache Service Client
 * Protected by circuit breaker
 */
class CacheClient {
  private circuitBreaker: CircuitBreaker;

  constructor(config: CircuitBreakerConfig) {
    this.circuitBreaker = new CircuitBreaker({
      name: 'cache',
      failureThreshold: 60, // Higher threshold for non-critical
      successThreshold: 2,
      timeout: 1000,
      resetTimeout: 30000,
      ...config,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      return await this.circuitBreaker.execute(async () => {
        // Simulate cache get
        const client = await getCacheClient();
        const value = await client.get(key);
        return value ? JSON.parse(value) : null;
      });
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        // Cache is down - return null (graceful degradation)
        console.warn('[Cache] Circuit open, returning null');
        return null;
      }
      throw error;
    }
  }

  async set(key: string, value: unknown, ttl: number = 3600): Promise<void> {
    try {
      await this.circuitBreaker.execute(async () => {
        // Simulate cache set
        const client = await getCacheClient();
        await client.set(key, JSON.stringify(value), 'EX', ttl);
      });
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        // Cache is down - log but don't fail
        console.warn('[Cache] Circuit open, skipping cache set');
        return;
      }
      throw error;
    }
  }

  getStats() {
    return this.circuitBreaker.getStats();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Health Checks with Circuit Breaker Integration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create health checks that use circuit breakers
 */
function createResilientHealthChecks(
  paymentClient: PaymentServiceClient,
  dbClient: DatabaseClient,
  cacheClient: CacheClient
): HealthCheckConfig[] {
  return [
    // Database health check - wraps circuit breaker
    createDatabaseCheck({
      name: 'database',
      type: 'postgresql',
      connectionString: process.env.DATABASE_URL,
      timeout: 5000,
      critical: true,
      check: async () => {
        const stats = dbClient.getStats();
        if (stats.state === 'OPEN') {
          return {
            status: 'unhealthy',
            message: 'Database circuit breaker is open',
            details: { circuitState: stats.state },
          };
        }
        // Run actual health check
        await dbClient.query('SELECT 1');
        return {
          status: 'healthy',
          details: { circuitState: stats.state },
        };
      },
    }),

    // Payment service health check - wraps circuit breaker
    createExternalApiCheck({
      name: 'payment-service',
      url: 'https://api.payments.com',
      healthEndpoint: '/health',
      timeout: 5000,
      critical: true,
      check: async () => {
        const stats = paymentClient.getStats();
        if (stats.state === 'OPEN') {
          return {
            status: 'unhealthy',
            message: 'Payment service circuit breaker is open',
            details: { circuitState: stats.state },
          };
        }
        // Run actual health check
        const response = await fetch('https://api.payments.com/health');
        return {
          status: response.ok ? 'healthy' : 'unhealthy',
          details: { circuitState: stats.state },
        };
      },
    }),

    // Cache health check - wraps circuit breaker
    createCacheCheck({
      name: 'cache',
      type: 'redis',
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      timeout: 2000,
      critical: false, // Non-critical - can degrade gracefully
      check: async () => {
        const stats = cacheClient.getStats();
        if (stats.state === 'OPEN') {
          return {
            status: 'degraded',
            message: 'Cache circuit breaker is open',
            details: { circuitState: stats.state },
          };
        }
        // Run actual health check
        const client = await getCacheClient();
        await client.ping();
        return {
          status: 'healthy',
          details: { circuitState: stats.state },
        };
      },
    }),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// Order Processing Service
// ═══════════════════════════════════════════════════════════════════════════

class OrderProcessingService {
  constructor(
    private paymentClient: PaymentServiceClient,
    private dbClient: DatabaseClient,
    private cacheClient: CacheClient
  ) {}

  async processOrder(orderId: string, amount: number, cardToken: string): Promise<OrderResult> {
    // Check cache first (non-blocking if circuit is open)
    const cached = await this.cacheClient.get<OrderResult>(`order:${orderId}`);
    if (cached) {
      return cached;
    }

    try {
      // Process payment (protected by circuit breaker)
      const paymentResult = await this.paymentClient.processPayment(amount, cardToken);

      // Save to database (protected by circuit breaker)
      await this.dbClient.query(
        'INSERT INTO orders (id, amount, payment_id) VALUES ($1, $2, $3)',
        [orderId, amount, paymentResult.id]
      );

      const result: OrderResult = {
        orderId,
        status: 'completed',
        paymentId: paymentResult.id,
      };

      // Cache result (non-blocking if circuit is open)
      await this.cacheClient.set(`order:${orderId}`, result, 3600);

      return result;
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        // Circuit breaker is open - return error
        throw new Error('Service temporarily unavailable');
      }
      throw error;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Express Application Setup
// ═══════════════════════════════════════════════════════════════════════════

export function createResilientApp() {
  // Initialize clients with circuit breakers
  const paymentClient = new PaymentServiceClient({});
  const dbClient = new DatabaseClient({});
  const cacheClient = new CacheClient({});

  // Create health checks
  const healthChecks = createResilientHealthChecks(
    paymentClient,
    dbClient,
    cacheClient
  );

  // Create health aggregator
  const healthAggregator = new HealthAggregator(healthChecks, {
    timeout: 30000,
    parallel: true,
    cacheResults: true,
    cacheTtl: 5000,
  });

  // Create order processing service
  const orderService = new OrderProcessingService(
    paymentClient,
    dbClient,
    cacheClient
  );

  // Health check router
  const router = healthRouter({
    version: '1.0.0',
    serviceName: 'order-processing',
    checks: healthChecks,
  });

  return {
    router,
    healthAggregator,
    orderService,
    clients: {
      payment: paymentClient,
      database: dbClient,
      cache: cacheClient,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Usage Example
// ═══════════════════════════════════════════════════════════════════════════

/*
import express from 'express';
import { createResilientApp } from './resilience-integration';

const app = express();
const { router, orderService } = createResilientApp();

// Health check endpoints
app.use('/health', router);

// Order processing endpoint
app.post('/orders', async (req, res) => {
  try {
    const result = await orderService.processOrder(
      req.body.orderId,
      req.body.amount,
      req.body.cardToken
    );
    res.json(result);
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.listen(3000);
*/

// ═══════════════════════════════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════════════════════════════

interface PaymentResult {
  id: string;
  status: string;
}

interface OrderResult {
  orderId: string;
  status: string;
  paymentId: string;
}

// Mock functions (replace with actual implementations)
async function getDatabasePool() {
  return {
    query: async (sql: string, params: unknown[]) => ({ rows: [] }),
  };
}

async function getCacheClient() {
  return {
    get: async (key: string) => null,
    set: async (key: string, value: string, mode: string, ttl: number) => {},
    ping: async () => 'PONG',
  };
}
