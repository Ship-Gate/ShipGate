# Chaos Checkout Demo

Demonstrates chaos engineering capabilities for ISL verification, focusing on idempotency and resilience testing for a checkout system.

## Overview

This demo showcases:

- **Chaos DSL Syntax**: ISL specs with `chaos` blocks defining failure scenarios
- **Idempotency Testing**: Verify exactly-once semantics under concurrent requests
- **Rate Limit Storms**: Test graceful degradation under load
- **Failure Injection**: Simulate database failures, network issues, and latency spikes
- **Proof Bundle Integration**: Capture chaos test results for audit

## Files

- `spec.isl` - ISL specification with chaos scenarios
- `implementation.ts` - Idempotent checkout implementation
- `run-chaos.ts` - Demo runner script

## Running the Demo

```bash
# From the repository root
npx tsx demos/chaos-checkout-demo/run-chaos.ts
```

## Chaos Scenarios

### 1. Concurrent Duplicate Requests

Tests that 10 concurrent requests with the same idempotency key result in exactly one checkout session.

```isl
chaos {
  scenario "concurrent duplicate requests" {
    inject: concurrent_requests(count: 10)
    with: idempotency_key("chaos-concurrent-test")
    expect: exactly_one_created
    expect: all_return_same_session
  }
}
```

**Expected Behavior:**
- Only one session is created in the database
- All 10 requests receive the same session ID
- One request creates new, nine get cached response

### 2. Idempotency Conflict Detection

Tests that using the same idempotency key with different parameters is rejected.

```isl
chaos {
  scenario "idempotency conflict" {
    with: idempotency_key("conflict-test")
    expect: IDEMPOTENCY_CONFLICT when parameters differ
  }
}
```

**Expected Behavior:**
- First request succeeds
- Second request with different parameters gets `IDEMPOTENCY_CONFLICT` error

### 3. Rate Limit Storm

Tests system behavior under excessive request rates.

```isl
chaos {
  scenario "rate limit storm" {
    inject: rate_limit_storm(requests: 100, window: 1s, limit: 10)
    expect: graceful_degradation
    expect: no_data_corruption
  }
}
```

**Expected Behavior:**
- Requests beyond the limit are rejected
- Accepted requests complete successfully
- No data corruption or inconsistency

### 4. Latency Spike Handling

Tests that the system handles variable latency gracefully.

```isl
chaos {
  scenario "latency spike" {
    inject: latency(p99: 500ms, distribution: "normal")
    expect: response_within(timeout: 5s)
    expect: no_timeout_errors
  }
}
```

**Expected Behavior:**
- All requests complete within timeout
- Latency is tracked for observability

## Implementation Details

### Idempotency Strategy

The implementation uses a three-part idempotency strategy:

1. **Key Lookup**: Check if idempotency key already exists
2. **Hash Comparison**: Verify request parameters match original
3. **Cached Response**: Return stored response for duplicates

```typescript
if (input.idempotency_key) {
  const existingSessionId = idempotencyIndex.get(input.idempotency_key);
  
  if (existingSessionId) {
    // Check parameters match
    if (existingHash !== requestHash) {
      throw new CheckoutError('IDEMPOTENCY_CONFLICT', '...');
    }
    
    // Return cached response
    return { session: existingSession, is_cached: true };
  }
}
```

### Chaos Injectors Used

- `ConcurrentInjector`: Runs multiple requests in parallel
- `RateLimitInjector`: Enforces request rate limits
- `LatencyInjector`: Adds artificial latency with configurable distribution
- `IdempotencyTracker`: Tracks request uniqueness

## Proof Bundle Output

When running chaos tests as part of verification, results are stored in the proof bundle:

```
proof-bundle/
├── manifest.json
├── results/
│   ├── chaos.json        # Chaos test results
│   └── ...
```

The `chaos.json` contains:

```json
{
  "status": "pass",
  "totalScenarios": 4,
  "passedScenarios": 4,
  "failedScenarios": 0,
  "config": {
    "globalRetries": 3,
    "globalTimeoutMs": 30000,
    "injectionTypes": ["concurrent_requests", "rate_limit_storm", "latency"]
  },
  "scenarios": [...]
}
```

## Extending the Demo

### Adding New Scenarios

1. Add scenario to `spec.isl`:

```isl
chaos {
  scenario "your scenario name" {
    inject: injection_type(param: value)
    expect: expected_outcome
  }
}
```

2. Implement scenario runner in `run-chaos.ts`

### Custom Injectors

Create custom injectors by implementing the injector interface:

```typescript
class CustomInjector {
  attachTimeline(timeline: Timeline): void { ... }
  activate(): void { ... }
  deactivate(): void { ... }
  getState(): InjectorState { ... }
}
```

## Related Documentation

- [Chaos Engineering DSL](../../docs/chaos-engineering.md)
- [Idempotency Patterns](../../docs/idempotency.md)
- [Proof Bundles](../../docs/proof-bundles.md)
