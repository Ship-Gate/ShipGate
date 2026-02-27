# Chaos Injection Implementation

## Overview

This document describes the chaos injection system implementation for IntentOS. The system provides measurable fault injection (timeouts, network failures, latency, concurrency pressure) with verification that injections actually occurred.

## Components Implemented

### 1. Enhanced Injectors

#### HTTP Network Injector (`injectors/network.ts`)
- **Proxy wrapper** that intercepts `fetch()` calls
- **Latency injection**: Adds configurable latency with jitter
- **Failure injection**: Connection refused, timeouts, DNS failures, resets
- **Measurable**: Tracks `interceptedRequests`, `failedRequests`, `totalLatencyInjected`
- **State tracking**: Records all injection events for verification

#### Clock Skew Injector (`injectors/clock-skew.ts`)
- **Time provider dependency injection**: Supports `TimeProvider` interface for testability
- **Modes**: Fixed offset, drift, jump, oscillate
- **Measurable**: Tracks `dateNowCallCount`, `currentOffsetMs`, `peakOffsetMs`
- **Dependency injection**: `SystemTimeProvider` default, custom providers for testing

#### Concurrency Injector (`injectors/concurrent.ts`)
- **Parallel request runner**: Executes operations concurrently
- **Jitter support**: Adds randomness to stagger delays
- **Concurrency limits**: Enforces `maxConcurrency` with `enforceLimit` option
- **Measurable**: Tracks `totalRequests`, `successfulRequests`, `racesDetected`
- **Race condition detection**: Built-in detection of inconsistent results

### 2. Harness API (`harness.ts`)

Provides a clean API for verifier integration:

```typescript
const harness = createHarness({ timeoutMs: 30000 });

// Start a scenario
const runner = harness.startScenario(scenario, domain);

// Run target implementation
const outcome = await runner.runTarget(implementation);

// Or run N trials
const result = await harness.runTrials(scenario, domain, implementation, 10);
```

**Features**:
- `startScenario()` → returns `ScenarioRunner`
- `runTarget()` → executes with injections, captures outcomes
- `runTrials()` → runs N trials, aggregates metrics
- **Metrics capture**: Latency, errors, concurrency, network stats
- **Aggregated metrics**: Success rate, average duration, total injections

### 3. CLI Integration (`cli.ts`)

New command: `isl chaos run`

```bash
# Run single trial
isl chaos run spec.isl --impl impl.ts

# Run 10 trials
isl chaos run spec.isl --impl impl.ts --trials 10

# Select specific scenarios
isl chaos run spec.isl --impl impl.ts --scenario timeout --scenario network_failure

# Show metrics
isl chaos run spec.isl --impl impl.ts --trials 5 --metrics
```

**Options**:
- `--scenario <name>`: Select specific scenarios (repeatable)
- `--trials <num>`: Number of trials to run (default: 1)
- `--metrics`: Show detailed metrics output
- `--timeout <ms>`: Test timeout
- `--seed <seed>`: Reproducible seed
- `--continue-on-failure`: Continue after failures

### 4. Tests (`tests/injectors.test.ts`)

Comprehensive tests that **verify injections actually occurred**:

- **HTTP latency injection**: Verifies `totalLatencyInjected > 0` and measurable delay
- **Network failure injection**: Verifies `failedRequests > 0` and error thrown
- **Clock skew injection**: Verifies `currentOffsetMs` matches expected offset
- **Concurrency injection**: Verifies concurrent execution (timing spread < threshold)
- **Jitter verification**: Verifies stagger delays vary with jitter
- **Concurrency limits**: Verifies `maxConcurrent <= limit`

## Usage Examples

### Basic Usage

```typescript
import { createHarness } from '@isl-lang/verifier-chaos';

const harness = createHarness({ timeoutMs: 30000 });
const scenario = parseChaosScenario(domain, 'timeout_scenario');
const runner = harness.startScenario(scenario, domain);

const outcome = await runner.runTarget(implementation);

console.log(`Passed: ${outcome.passed}`);
console.log(`Latency injected: ${outcome.metrics.totalLatencyInjected}ms`);
console.log(`Errors injected: ${outcome.metrics.errorsInjected}`);
```

### Running Trials

```typescript
const result = await harness.runTrials(scenario, domain, implementation, 10);

console.log(`Success rate: ${result.aggregatedMetrics.successRate * 100}%`);
console.log(`Total latency: ${result.aggregatedMetrics.totalLatencyInjected}ms`);
console.log(`Average per trial: ${result.aggregatedMetrics.averageLatencyPerTrial}ms`);
```

### CLI Usage

```bash
# Run chaos tests with metrics
isl chaos run auth.isl --impl auth.ts --trials 5 --metrics

# Output:
#   Verdict: RISKY
#   Score:   75/100
#   ✓ 4 scenarios passed
#   ✗ 1 scenarios failed
#   
#   Metrics:
#     Total Trials: 5
#     Success Rate: 80.0%
#     Average Duration: 1250ms
```

## Verification

The system ensures injections are **measurable and verifiable**:

1. **State tracking**: All injectors track injection counts, latencies, errors
2. **Timeline events**: All injections recorded in timeline for audit
3. **Metrics capture**: Harness extracts metrics from injector states
4. **Tests verify**: Tests check that `state.totalLatencyInjected > 0`, `state.failedRequests > 0`, etc.

## Acceptance Test

A sample app under chaos shows:
- ✅ **Increased error rate**: `networkFailuresInjected > 0`
- ✅ **Increased latency**: `totalLatencyInjected > baseline`
- ✅ **Quantitative reporting**: `isl chaos run` reports metrics

Example output:
```
Chaos Verification Results:
  ✓ 8 scenarios passed
  ✗ 2 scenarios failed
  
  Metrics:
    Total Trials: 10
    Success Rate: 80.0%
    Total Latency Injected: 15,234ms
    Average Latency Per Trial: 1,523ms
    Network Failures Injected: 12
    Concurrent Requests: 50
```

## Files Modified/Created

### Created
- `packages/verifier-chaos/src/harness.ts` - Harness API
- `packages/verifier-chaos/tests/injectors.test.ts` - Injection verification tests
- `packages/verifier-chaos/CHAOS_IMPLEMENTATION.md` - This document

### Modified
- `packages/verifier-chaos/src/injectors/network.ts` - Enhanced with latency injection, metrics
- `packages/verifier-chaos/src/injectors/clock-skew.ts` - Added time provider DI pattern
- `packages/verifier-chaos/src/injectors/concurrent.ts` - Added jitter, concurrency limits
- `packages/verifier-chaos/src/index.ts` - Exported harness API
- `packages/cli/src/cli.ts` - Added `isl chaos run` command
- `packages/cli/src/commands/chaos.ts` - Enhanced with trials, scenario selection, metrics

## Next Steps

1. **Integration testing**: Test with real applications
2. **Documentation**: Add usage examples to main docs
3. **Performance**: Optimize for large-scale trials
4. **Metrics export**: Add JSON/CSV export for metrics
5. **Visualization**: Add charts/graphs for metrics visualization
