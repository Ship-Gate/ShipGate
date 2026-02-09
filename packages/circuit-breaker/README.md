# @isl-lang/circuit-breaker

> Resilience patterns and circuit breaker for ISL behaviors

A production-ready circuit breaker implementation with async safety, memory leak prevention, and comprehensive state management.

## Features

- **Three States**: CLOSED, OPEN, HALF_OPEN with automatic transitions
- **Configurable Thresholds**: Failure rate, slow call rate, volume threshold
- **Async Safe**: Thread-safe execution with lock mechanism preventing race conditions
- **Memory Safe**: Automatic cleanup of old call history, timeout cleanup
- **Half-Open Logic**: Automatic recovery testing with configurable success threshold
- **Statistics**: Comprehensive stats tracking for monitoring
- **Callbacks**: State change, success, and failure callbacks

## Installation

```bash
pnpm add @isl-lang/circuit-breaker
```

## Usage

### Basic Usage

```typescript
import { CircuitBreaker } from '@isl-lang/circuit-breaker';

const circuitBreaker = new CircuitBreaker({
  name: 'api-service',
  failureThreshold: 50, // 50% failure rate triggers OPEN
  successThreshold: 2,   // 2 consecutive successes close from HALF_OPEN
  timeout: 5000,         // 5 second timeout per call
  resetTimeout: 60000,   // Wait 60s before attempting HALF_OPEN
});

// Execute a function with circuit breaker protection
try {
  const result = await circuitBreaker.execute(async () => {
    return await fetch('https://api.example.com/data');
  });
  console.log('Success:', result);
} catch (error) {
  if (error instanceof CircuitOpenError) {
    console.error('Circuit is open - service unavailable');
  } else {
    console.error('Request failed:', error);
  }
}
```

### Configuration Options

```typescript
interface CircuitBreakerConfig {
  name: string;                    // Circuit name for identification
  failureThreshold: number;        // Failure rate percentage (0-100)
  successThreshold: number;        // Consecutive successes needed to close from HALF_OPEN
  timeout: number;                 // Operation timeout in milliseconds
  resetTimeout: number;            // Time to wait before attempting HALF_OPEN
  volumeThreshold?: number;         // Minimum calls before evaluating thresholds (default: 10)
  slowCallThreshold?: number;      // Slow call rate threshold (0-1, default: 0.5)
  slowCallDuration?: number;       // Duration threshold for slow calls in ms (default: 5000)
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  onFailure?: (error: Error) => void;
  onSuccess?: () => void;
}
```

### State Management

The circuit breaker has three states:

1. **CLOSED**: Normal operation, all requests pass through
2. **OPEN**: Circuit is open, requests are rejected immediately
3. **HALF_OPEN**: Testing recovery, limited requests allowed

```typescript
// Check current state
const state = circuitBreaker.getState(); // 'CLOSED' | 'OPEN' | 'HALF_OPEN'

// Manual control
circuitBreaker.forceOpen();      // Force to OPEN
circuitBreaker.forceClosed();    // Force to CLOSED
circuitBreaker.reset();          // Reset to CLOSED and clear stats
```

### Statistics

```typescript
const stats = circuitBreaker.getStats();
console.log({
  name: stats.name,
  state: stats.state,
  totalCalls: stats.totalCalls,
  failures: stats.failures,
  successes: stats.successes,
  failureRate: stats.failureRate,
  slowCallRate: stats.slowCallRate,
  lastFailureTime: stats.lastFailureTime,
  lastSuccessTime: stats.lastSuccessTime,
});
```

### Callbacks

```typescript
const circuitBreaker = new CircuitBreaker({
  name: 'api-service',
  failureThreshold: 50,
  successThreshold: 2,
  timeout: 5000,
  resetTimeout: 60000,
  onStateChange: (from, to) => {
    console.log(`Circuit ${from} -> ${to}`);
    // Emit metrics, log, etc.
  },
  onFailure: (error) => {
    console.error('Circuit breaker recorded failure:', error);
    // Track failures
  },
  onSuccess: () => {
    console.log('Circuit breaker recorded success');
    // Track successes
  },
});
```

### Error Handling

```typescript
import { CircuitBreaker, CircuitOpenError, TimeoutError } from '@isl-lang/circuit-breaker';

try {
  await circuitBreaker.execute(() => apiCall());
} catch (error) {
  if (error instanceof CircuitOpenError) {
    // Circuit is open - service unavailable
    // Return cached data or fallback
  } else if (error instanceof TimeoutError) {
    // Operation timed out
    // Retry or return timeout response
  } else {
    // Original error from the function
    // Handle normally
  }
}
```

## How It Works

### State Transitions

1. **CLOSED → OPEN**: When failure rate exceeds `failureThreshold` after `volumeThreshold` calls
2. **OPEN → HALF_OPEN**: After `resetTimeout` milliseconds, next request transitions to HALF_OPEN
3. **HALF_OPEN → CLOSED**: After `successThreshold` consecutive successes
4. **HALF_OPEN → OPEN**: On any failure

### Thresholds

- **Volume Threshold**: Minimum number of calls before evaluating failure/slow call rates
- **Failure Threshold**: Percentage of failures that triggers OPEN state
- **Slow Call Threshold**: Percentage of slow calls that triggers OPEN state
- **Success Threshold**: Consecutive successes needed to close from HALF_OPEN

### Async Safety

The circuit breaker uses a lock mechanism to ensure thread-safe execution:

- Only one execution can check state and transition at a time
- Concurrent calls are serialized through the lock
- State transitions are atomic

### Memory Management

- Old call history is automatically cleaned up based on `resetTimeout`
- Timeout handlers are properly cleaned up on success/failure
- No memory leaks from pending timeouts or event listeners

## Best Practices

1. **Choose Appropriate Thresholds**: 
   - Lower `failureThreshold` for critical services
   - Higher `volumeThreshold` for high-traffic services

2. **Set Reasonable Timeouts**:
   - Match your service SLA
   - Consider retry strategies

3. **Monitor Statistics**:
   - Track state changes
   - Monitor failure rates
   - Alert on OPEN state

4. **Implement Fallbacks**:
   - Return cached data when circuit is OPEN
   - Use alternative services
   - Graceful degradation

5. **Combine with Retry**:
   - Use circuit breaker to prevent retry storms
   - Retry only when circuit is CLOSED

## Integration with Health Checks

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
    return await circuitBreaker.execute(async () => {
      const response = await fetch('https://api.example.com/health');
      return response.ok;
    });
  },
});
```

## API Reference

### CircuitBreaker

#### Constructor

```typescript
new CircuitBreaker(config: CircuitBreakerConfig)
```

#### Methods

- `execute<T>(fn: () => Promise<T>): Promise<T>` - Execute function with circuit breaker protection
- `getState(): CircuitState` - Get current circuit state
- `getStats(): CircuitStats` - Get circuit statistics
- `reset(): void` - Reset circuit to CLOSED and clear stats
- `forceOpen(): void` - Force circuit to OPEN state
- `forceClosed(): void` - Force circuit to CLOSED state

### Errors

- `CircuitOpenError` - Thrown when circuit is OPEN and request is rejected
- `TimeoutError` - Thrown when operation exceeds timeout

## License

MIT
