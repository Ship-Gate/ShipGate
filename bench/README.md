# Performance Benchmarks

This directory contains performance benchmarking tools for IntentOS.

## Quick Start

```bash
# Run all benchmarks
pnpm bench:perf

# Run specific benchmarks
pnpm bench:perf:parse   # Parse benchmarks only
pnpm bench:perf:check   # Check benchmarks only
pnpm bench:perf:gate    # Gate benchmarks only

# Enable CPU profiling
pnpm bench:perf:profile

# Run CI regression check
pnpm bench:ci
```

## Files

- **`performance-runner.ts`** - Unified benchmark runner with budget definitions
- **`profiler.ts`** - Node.js CPU profiling hooks
- **`ci-regression-check.ts`** - CI regression detection script
- **`phase3-benchmarks.ts`** - Phase 3 specific benchmarks

## Performance Budgets

| Operation | Budget | Unit |
|-----------|--------|------|
| Parse 1k LOC spec | < 500ms | p99 |
| Check 50 files | < 5s | p99 |
| Gate typical repo | < 30s | p99 |

## CI Integration

Performance benchmarks run automatically in CI:

- Runs on every pull request
- Compares against baseline from main branch
- Fails if regression exceeds 15% tolerance
- Updates baseline on main branch pushes

See [Performance Benchmarks Documentation](../docs/PERFORMANCE_BENCHMARKS.md) for details.
