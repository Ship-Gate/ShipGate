# Circuit Breaker Examples

This directory contains example integrations demonstrating circuit breaker usage.

## Resilience Integration

`resilience-integration.ts` demonstrates:

- Circuit breaker protection for external services (payment, database, cache)
- Health checks that monitor circuit breaker states
- Graceful degradation when circuits are open
- Express.js integration with health check endpoints

### Key Features

1. **Service Clients with Circuit Breakers**:
   - PaymentServiceClient - Protects payment API calls
   - DatabaseClient - Protects database queries
   - CacheClient - Protects cache operations (non-critical)

2. **Health Checks**:
   - Database health check reports circuit breaker state
   - Payment service health check reports circuit breaker state
   - Cache health check reports circuit breaker state (degraded when open)

3. **Graceful Degradation**:
   - Cache failures don't block operations
   - Circuit breaker states are exposed in health checks
   - Services can continue operating with degraded functionality

### Running the Example

```typescript
import express from 'express';
import { createResilientApp } from './resilience-integration';

const app = express();
const { router, orderService } = createResilientApp();

// Health check endpoints
app.use('/health', router);
// GET /health/live - Liveness probe
// GET /health/ready - Readiness probe
// GET /health - Full health check

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
```

### Monitoring Circuit Breaker States

```typescript
const { clients } = createResilientApp();

// Get circuit breaker statistics
const paymentStats = clients.payment.getStats();
console.log('Payment Service:', {
  state: paymentStats.state,
  failureRate: paymentStats.failureRate,
  totalCalls: paymentStats.totalCalls,
});

const dbStats = clients.database.getStats();
console.log('Database:', {
  state: dbStats.state,
  failureRate: dbStats.failureRate,
});

const cacheStats = clients.cache.getStats();
console.log('Cache:', {
  state: cacheStats.state,
  failureRate: cacheStats.failureRate,
});
```

### Health Check Integration

The health checks automatically report circuit breaker states:

```json
{
  "status": "degraded",
  "checks": {
    "database": {
      "status": "healthy",
      "details": { "circuitState": "CLOSED" }
    },
    "payment-service": {
      "status": "unhealthy",
      "message": "Payment service circuit breaker is open",
      "details": { "circuitState": "OPEN" }
    },
    "cache": {
      "status": "degraded",
      "message": "Cache circuit breaker is open",
      "details": { "circuitState": "OPEN" }
    }
  }
}
```
