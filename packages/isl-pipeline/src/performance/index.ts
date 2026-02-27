/**
 * Performance Module
 * 
 * Exports for performance benchmarking, profiling, caching, and regression testing.
 * 
 * @module @isl-lang/pipeline/performance
 */

// Benchmarking
export * from './benchmark.js';
export type {
  BenchmarkResult,
  RepoSize,
  BenchmarkConfig,
  PerformanceMetrics,
} from './benchmark.js';

// Profiling
export * from './profiler.js';
export type {
  ProfileEntry,
  ProfileReport,
  Hotspot,
} from './profiler.js';

// Caching
export * from './cache.js';
export type {
  CacheEntry,
  CacheStats,
} from './cache.js';

// Incremental processing
export * from './incremental.js';
export type {
  FileHash,
  IncrementalState,
  IncrementalResult,
} from './incremental.js';

// Regression testing
export * from './regression.js';
export type {
  PerformanceBudget,
  RegressionTestResult,
  BudgetViolation,
} from './regression.js';
