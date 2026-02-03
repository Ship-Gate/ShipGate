# Performance Optimization Guide

This document describes the performance optimization features for the ISL Pipeline.

## Overview

The performance module provides:
1. **Benchmarking**: Measure parse/check time, gate time, and heal iterations time across 3 repo sizes
2. **Hotspot Profiling**: Identify performance bottlenecks
3. **Caching**: Cache parse results and gate violations
4. **Incremental Processing**: Only process changed files (changed-only default)
5. **Regression Tests**: Ensure performance stays within budgets

## Benchmarks

Run benchmarks for 3 repo sizes (small, medium, large):

```bash
pnpm benchmark
# or
isl-performance benchmark --iterations 10 --warmup 2
```

This measures:
- **parse/check time**: Time to parse ISL and run type checking
- **gate time**: Time to run semantic rules
- **heal iterations time**: Time for healing loop iterations
- **memory usage**: Heap memory used

### Repo Sizes

- **Small**: 5 files, ~50 lines/file, 3 violations
- **Medium**: 20 files, ~150 lines/file, 10 violations
- **Large**: 50 files, ~300 lines/file, 25 violations

## Hotspot Profiling

Generate a hotspot profiling report:

```bash
isl-performance profile --output hotspots.txt
```

This identifies the top 20 hotspots by total time, showing:
- Function/operation name
- Total time and percentage
- Call count and average time
- Call stack

## Caching

The pipeline automatically caches:
- **Parse results**: ISL AST and parse errors (1 hour TTL)
- **Gate violations**: Semantic rule violations (30 minutes TTL)

Cache statistics are available via the cache API:

```typescript
import { getParseCache, getGateCache } from '@isl-lang/pipeline/performance';

const parseCache = getParseCache();
const stats = parseCache.getStats();
console.log(`Hit rate: ${stats.hitRate * 100}%`);
```

## Incremental Processing

By default, the pipeline uses incremental processing (changed-only mode):

```typescript
import { parseIncremental, gateIncremental } from '@isl-lang/pipeline/performance';

// Only parse changed files
const result = await parseIncremental(files, { changedOnly: true });

// Only check gate for changed files
const violations = await gateIncremental(codeMap, { changedOnly: true });
```

The incremental processor:
- Tracks file hashes and modification times
- Only processes files that changed
- Uses cache for unchanged files
- Saves state to `.isl-incremental-state.json`

## Regression Tests

Run regression tests to ensure performance stays within budgets:

```bash
isl-performance regression
```

Default budgets:

| Repo Size | Parse/Check | Gate | Heal Iterations | Total | Memory |
|-----------|-------------|------|-----------------|-------|--------|
| Small     | 100ms       | 50ms | 200ms          | 350ms | 50MB   |
| Medium    | 500ms       | 300ms| 1000ms         | 1800ms| 200MB  |
| Large     | 2000ms      | 1500ms| 5000ms        | 8500ms| 500MB  |

Custom budgets can be provided via JSON:

```json
[
  {
    "repoSize": "small",
    "parseCheckTime": 100,
    "gateTime": 50,
    "healIterationsTime": 200,
    "totalTime": 350,
    "memoryUsed": 50
  }
]
```

```bash
isl-performance regression --budgets budgets.json
```

## Comprehensive Report

Generate a comprehensive performance report:

```bash
isl-performance report --output report.txt
```

This includes:
- Benchmark results for all repo sizes
- Hotspot profiling report
- Cache statistics
- Regression test results

## Integration

### Using Caching in Your Code

```typescript
import { getParseCache } from '@isl-lang/pipeline/performance';
import { parseISL } from '@isl-lang/isl-core';

const cache = getParseCache();
const cached = cache.get(source, filePath);

if (cached) {
  return cached;
}

const result = parseISL(source, filePath);
cache.set(source, filePath, result);
return result;
```

### Using Incremental Processing

```typescript
import { gateIncremental } from '@isl-lang/pipeline/performance';

// Automatically uses changed-only mode
const result = await gateIncremental(codeMap);

console.log(`Processed: ${result.processedFiles.length}`);
console.log(`Skipped: ${result.skippedFiles.length}`);
```

### Profiling Your Code

```typescript
import { profile, PerformanceProfiler } from '@isl-lang/pipeline/performance';

// Profile a function
const myFunction = profile('myFunction', (arg: string) => {
  // ... your code
});

// Or use the profiler directly
const profiler = new PerformanceProfiler();
profiler.start();
profiler.startSection('parse');
// ... parse code
profiler.endSection('parse');
const report = profiler.generateReport();
```

## Performance Budgets

Performance budgets are enforced in CI/CD:

1. Run benchmarks
2. Compare against budgets
3. Fail if any budget is exceeded
4. Report violations

Example CI integration:

```yaml
- name: Performance Regression Tests
  run: |
    pnpm perf:regression
```

## Optimizations Implemented

1. **Parse Caching**: Cache ISL parse results with SHA-256 hashing
2. **Gate Caching**: Cache semantic rule violations
3. **Incremental Parsing**: Only parse changed files
4. **Changed-Only Default**: Gate checks only changed files by default
5. **LRU Eviction**: Cache evicts least recently used entries
6. **Memory Tracking**: Monitor heap memory usage

## Future Optimizations

Potential future optimizations:
- Parallel rule checking
- AST diffing for incremental type checking
- Worker threads for large repos
- Streaming parsing for very large files
- Indexed violation lookup
