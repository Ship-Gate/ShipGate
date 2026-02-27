# @isl-lang/health-check

> Generate health check endpoints from ISL dependencies

A comprehensive health check system with composable checks, dependency analysis, and Kubernetes/Express integration.

## Features

- **Composable Checks**: Database, cache, queue, external API, and custom checks
- **Liveness/Readiness**: Kubernetes-style probes with separate liveness and readiness checks
- **Dependency Analysis**: Automatic detection of dependencies from ISL domains
- **Express Middleware**: Ready-to-use Express.js middleware and routers
- **Kubernetes Integration**: Generate probe configurations for K8s deployments
- **Event System**: Health check events for monitoring and alerting
- **Caching**: Optional result caching to reduce load

## Installation

```bash
pnpm add @isl-lang/health-check
```

## Quick Start

### Basic Health Check

```typescript
import { createDatabaseCheck, HealthAggregator } from '@isl-lang/health-check';

// Create a database check
const dbCheck = createDatabaseCheck({
  name: 'postgres',
  type: 'postgresql',
  connectionString: process.env.DATABASE_URL,
  timeout: 5000,
  critical: true,
});

// Create aggregator
const aggregator = new HealthAggregator([dbCheck]);

// Run all checks
const result = await aggregator.checkAll();
console.log('Overall status:', result.status); // 'healthy' | 'degraded' | 'unhealthy'
```

### Express Integration

```typescript
import express from 'express';
import { healthRouter, createDatabaseCheck } from '@isl-lang/health-check';

const app = express();

// Create checks
const dbCheck = createDatabaseCheck({
  name: 'postgres',
  type: 'postgresql',
  connectionString: process.env.DATABASE_URL,
  critical: true,
});

const cacheCheck = createCacheCheck({
  name: 'redis',
  type: 'redis',
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  critical: false,
});

// Create router with checks
const router = healthRouter({
  version: '1.0.0',
  serviceName: 'my-service',
  checks: [dbCheck, cacheCheck],
});

app.use('/health', router);
// GET /health/live - Liveness probe
// GET /health/ready - Readiness probe
// GET /health - Full health check
```

### Kubernetes Probes

```typescript
import { KubernetesProbeGenerator, createDatabaseCheck } from '@isl-lang/health-check';

const dbCheck = createDatabaseCheck({
  name: 'postgres',
  type: 'postgresql',
  connectionString: process.env.DATABASE_URL,
  critical: true,
});

const generator = new KubernetesProbeGenerator({
  version: '1.0.0',
  serviceName: 'my-service',
  checks: [dbCheck],
});

// Generate probe handlers
const probes = generator.getProbeHandlers();
// probes.liveness - Liveness probe handler
// probes.readiness - Readiness probe handler

// Generate YAML configuration
const yaml = generator.generateProbeYaml({
  containerPort: 8080,
  initialDelaySeconds: 10,
  periodSeconds: 10,
  timeoutSeconds: 5,
});
```

## Composable Checks

### Database Check

```typescript
import { createDatabaseCheck } from '@isl-lang/health-check';

const dbCheck = createDatabaseCheck({
  name: 'postgres',
  type: 'postgresql', // 'postgresql' | 'mysql' | 'mongodb' | 'sqlite'
  connectionString: process.env.DATABASE_URL,
  query: 'SELECT 1', // Optional custom query
  timeout: 5000,
  critical: true,
});
```

### Cache Check

```typescript
import { createCacheCheck } from '@isl-lang/health-check';

const cacheCheck = createCacheCheck({
  name: 'redis',
  type: 'redis', // 'redis' | 'memcached' | 'in-memory'
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  timeout: 5000,
  critical: false,
});
```

### Queue Check

```typescript
import { createQueueCheck } from '@isl-lang/health-check';

const queueCheck = createQueueCheck({
  name: 'rabbitmq',
  type: 'rabbitmq', // 'rabbitmq' | 'kafka' | 'sqs' | 'redis-queue'
  connectionString: process.env.QUEUE_URL,
  queueName: 'tasks',
  timeout: 5000,
  critical: true,
});
```

### External API Check

```typescript
import { createExternalApiCheck } from '@isl-lang/health-check';

const apiCheck = createExternalApiCheck({
  name: 'payment-service',
  url: 'https://api.payments.com',
  healthEndpoint: '/health',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.API_KEY}`,
  },
  expectedStatus: [200],
  timeout: 5000,
  critical: true,
});
```

### Custom Check

```typescript
import { createCustomCheck } from '@isl-lang/health-check';

const customCheck = createCustomCheck({
  name: 'disk-space',
  check: async () => {
    const stats = await getDiskStats();
    return {
      status: stats.usedPercent < 90,
      message: stats.usedPercent < 90 ? 'OK' : 'Disk space low',
      details: { usedPercent: stats.usedPercent },
    };
  },
  timeout: 5000,
  critical: false,
});
```

### Composite Checks

```typescript
import { createCompositeCheck } from '@isl-lang/health-check';

// Combine multiple checks into one
const compositeCheck = createCompositeCheck({
  name: 'storage',
  checks: [
    createDatabaseCheck({ name: 'db', type: 'postgresql', ... }),
    createCacheCheck({ name: 'cache', type: 'redis', ... }),
  ],
  // All checks must pass for composite to be healthy
  requireAll: true,
});
```

## Health Aggregator

The `HealthAggregator` combines multiple checks and computes overall health:

```typescript
import { HealthAggregator, createDatabaseCheck, createCacheCheck } from '@isl-lang/health-check';

const aggregator = new HealthAggregator([
  createDatabaseCheck({ name: 'db', ... }),
  createCacheCheck({ name: 'cache', ... }),
], {
  timeout: 30000,        // Overall timeout
  parallel: true,        // Run checks in parallel
  failFast: false,       // Continue even if critical check fails
  cacheResults: true,    // Cache results
  cacheTtl: 5000,        // Cache TTL in ms
});

// Run all checks
const result = await aggregator.checkAll();
console.log({
  status: result.status,              // 'healthy' | 'degraded' | 'unhealthy'
  criticalFailures: result.criticalFailures,
  nonCriticalFailures: result.nonCriticalFailures,
  duration: result.duration,
});

// Run single check
const dbResult = await aggregator.checkOne('db');

// Get critical checks only
const criticalChecks = aggregator.getCriticalChecks();
```

## Liveness vs Readiness

- **Liveness**: Is the service running? (process health, basic functionality)
- **Readiness**: Can the service handle traffic? (dependencies available, initialized)

```typescript
import { createHealthAggregator } from '@isl-lang/health-check';

const aggregator = createHealthAggregator([
  // Liveness checks - basic service health
  createCustomCheck({
    name: 'process',
    check: async () => process.memoryUsage().heapUsed < 1e9,
    critical: true,
  }),
  
  // Readiness checks - dependencies
  createDatabaseCheck({
    name: 'db',
    type: 'postgresql',
    connectionString: process.env.DATABASE_URL,
    critical: true,
  }),
  createCacheCheck({
    name: 'cache',
    type: 'redis',
    host: process.env.REDIS_HOST,
    critical: false,
  }),
]);

// Liveness - is service alive?
const isLive = aggregator.isLive();

// Readiness - can service handle requests?
const isReady = aggregator.isReady();
```

## Event System

Subscribe to health check events:

```typescript
const aggregator = new HealthAggregator([...checks]);

aggregator.onEvent((event) => {
  switch (event.type) {
    case 'check-started':
      console.log(`Check ${event.checkName} started`);
      break;
    case 'check-completed':
      console.log(`Check ${event.checkName} completed:`, event.result?.status);
      break;
    case 'status-changed':
      console.log(`Check ${event.checkName} changed:`, 
        event.previousStatus, '->', event.currentStatus);
      // Emit alert, update metrics, etc.
      break;
  }
});
```

## Integration with Circuit Breaker

```typescript
import { CircuitBreaker } from '@isl-lang/circuit-breaker';
import { createExternalApiCheck } from '@isl-lang/health-check';

const circuitBreaker = new CircuitBreaker({
  name: 'external-api',
  failureThreshold: 50,
  successThreshold: 2,
  timeout: 5000,
  resetTimeout: 60000,
});

// Wrap health check with circuit breaker
const healthCheck = createExternalApiCheck({
  name: 'external-api',
  url: 'https://api.example.com',
  healthEndpoint: '/health',
  timeout: 5000,
  critical: true,
  check: async () => {
    try {
      return await circuitBreaker.execute(async () => {
        const response = await fetch('https://api.example.com/health');
        return {
          status: response.ok ? 'healthy' : 'unhealthy',
          latency: Date.now() - start,
        };
      });
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        return {
          status: 'unhealthy',
          message: 'Circuit breaker is open',
        };
      }
      throw error;
    }
  },
});
```

## ISL Dependency Analysis

Automatically generate health checks from ISL domain definitions:

```typescript
import { generateHealthChecks, analyzeDomain } from '@isl-lang/health-check';

// Analyze ISL domain for dependencies
const domain = {
  // ... ISL domain definition
};

// Generate health checks from dependencies
const { checks, aggregator, dependencies } = generateHealthChecks(domain, {
  version: '1.0.0',
  serviceName: 'my-service',
  defaultTimeout: 5000,
});

// Use generated checks
const result = await aggregator.checkAll();
```

## Best Practices

1. **Separate Liveness and Readiness**:
   - Liveness: Basic process health
   - Readiness: All dependencies available

2. **Mark Critical Dependencies**:
   - Critical: Service cannot function without it
   - Non-critical: Service can degrade gracefully

3. **Set Appropriate Timeouts**:
   - Match your service SLA
   - Consider network latency

4. **Monitor Health Events**:
   - Track status changes
   - Alert on critical failures
   - Log health check results

5. **Cache Results**:
   - Reduce load on dependencies
   - Use appropriate TTL

6. **Combine with Circuit Breakers**:
   - Protect health checks themselves
   - Prevent cascading failures

## API Reference

### Check Creators

- `createDatabaseCheck(config)` - Database health check
- `createCacheCheck(config)` - Cache health check
- `createQueueCheck(config)` - Queue health check
- `createExternalApiCheck(config)` - External API health check
- `createCustomCheck(config)` - Custom health check
- `createCompositeCheck(config)` - Composite health check

### Aggregator

- `HealthAggregator` - Main aggregator class
- `createHealthAggregator(checks, config?)` - Factory function
- `quickHealthCheck(checks)` - Quick health status
- `areCriticalServicesHealthy(checks)` - Check critical services

### Generators

- `KubernetesProbeGenerator` - Kubernetes probe generator
- `ExpressHealthGenerator` - Express middleware generator
- `healthRouter(config)` - Express router factory
- `healthMiddleware(config)` - Express middleware factory

## License

MIT
