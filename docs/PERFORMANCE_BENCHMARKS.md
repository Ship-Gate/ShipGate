# Performance Benchmarks

This document describes the performance benchmarking infrastructure and budgets for IntentOS.

## Overview

The performance benchmarking system measures and enforces performance budgets for critical operations:

1. **Parse 1k LOC spec** - Must complete in < 500ms
2. **Check 50 files** - Must complete in < 5s
3. **Gate typical repo** - Must complete in < 30s

## Quick Start

### Run All Benchmarks

```bash
pnpm bench:perf
```

### Run Specific Benchmarks

```bash
# Parse benchmarks only
pnpm bench:perf:parse

# Check benchmarks only
pnpm bench:perf:check

# Gate benchmarks only
pnpm bench:perf:gate
```

### Enable CPU Profiling

```bash
pnpm bench:perf:profile
```

Profiles are saved to `.profiles/` directory and can be analyzed in Chrome DevTools or other profiling tools.

## Performance Budgets

### Parse Budget

- **Target**: Parse 1k LOC spec in < 500ms (p99)
- **Measurement**: Parses a 1000-line ISL specification file
- **Tool**: `@isl-lang/parser`

### Check Budget

- **Target**: Check 50 files in < 5s (p99)
- **Measurement**: Parses and type-checks 50 ISL files
- **Tool**: `@isl-lang/isl-core` parseISL + type checking

### Gate Budget

- **Target**: Gate typical repo (50 files, ~300 LOC/file) in < 30s
- **Measurement**: Runs full gate pipeline on a typical repository
- **Tool**: `isl gate` CLI command or programmatic API

## CI Integration

Performance benchmarks run automatically in CI on every pull request. The CI job:

1. Runs all benchmarks
2. Compares results against baseline (from main branch)
3. Fails if regression exceeds 15% tolerance
4. Updates baseline on main branch pushes

### CI Job

The `performance-regression` job runs in `.github/workflows/ci.yml`:

- Runs after `build-check` completes
- Uses cached baseline from previous runs
- Uploads benchmark results as artifacts
- Updates baseline on main branch

### Baseline Management

- Baseline is stored in `.test-temp/performance-baseline.json`
- Baseline is cached in CI using GitHub Actions cache
- Baseline is automatically updated on main branch pushes
- Manual baseline update: `pnpm bench:ci --update-baseline`

## Regression Detection

The CI regression check compares current results against baseline:

- **Tolerance**: 15% (configurable via `--tolerance`)
- **Comparison**: Uses p99 values for comparison
- **Failure**: CI fails if any benchmark exceeds tolerance

### Example Output

```
Regression Analysis
======================================================================

Benchmark                  Baseline      Current      Change      Status
-----------------------------------------------------------------------
parse-1k-loc                 450ms        480ms      +6.7%      ✓ OK
check-50-files               4200ms       5100ms     +21.4%     ❌ EXCEEDED
gate-typical-repo            25s          28s       +12.0%      ✓ OK

❌ Performance regression detected!
Some benchmarks exceeded the 15.0% tolerance threshold.
```

## CPU Profiling

The profiler module provides on-demand CPU profiling:

```typescript
import { startProfiling, stopProfiling } from './bench/profiler';

// Start profiling
startProfiling('my-operation');

// ... run code to profile ...

// Stop profiling and save
const profilePath = await stopProfiling('my-operation');
// Profile saved to .profiles/my-operation.cpuprofile
```

### Profile Function Helper

```typescript
import { profileFunction } from './bench/profiler';

const { result, profilePath } = await profileFunction('my-function', async () => {
  // Code to profile
  return await expensiveOperation();
});
```

### Analyzing Profiles

1. Open Chrome DevTools
2. Go to Performance tab
3. Click "Load profile"
4. Select the `.cpuprofile` file from `.profiles/` directory

## Benchmark Runner API

### Programmatic Usage

```typescript
import { runBenchmarks, BUDGETS } from './bench/performance-runner';

const report = await runBenchmarks({
  parseOnly: false,
  checkOnly: false,
  gateOnly: false,
  profile: false,
});

console.log(`Passed: ${report.summary.passed}/${report.summary.total}`);
```

### Budget Configuration

Budgets are defined in `bench/performance-runner.ts`:

```typescript
export const BUDGETS: PerformanceBudgets = {
  parse: {
    parse1kLOC: 500, // ms
  },
  check: {
    check50Files: 5000, // ms
  },
  gate: {
    gateTypicalRepo: 30, // seconds
  },
};
```

## Troubleshooting

### Benchmarks Fail Locally

1. Ensure packages are built: `pnpm build`
2. Check that test fixtures exist: `test-fixtures/valid/`
3. Verify examples exist: `examples/auth.isl`

### CI Baseline Not Found

- First run on a branch will create a baseline
- Baseline is created from main branch automatically
- Manual baseline creation: `pnpm bench:ci --update-baseline`

### Profiling Not Available

- Profiling requires Node.js inspector API
- May not work in all environments (e.g., some CI runners)
- Check availability: `isProfilingAvailable()` from profiler module

## Performance Optimization Tips

1. **Use incremental processing** - Only process changed files
2. **Enable caching** - Parse and gate results are cached
3. **Profile hotspots** - Use CPU profiling to identify bottlenecks
4. **Monitor regressions** - Check CI performance reports regularly

## Related Documentation

- [Performance Optimization Guide](../packages/isl-pipeline/docs/PERFORMANCE.md)
- [Phase 3 Benchmark Results](./PHASE3_BENCHMARK_RESULTS.md)
