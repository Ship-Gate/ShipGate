# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: POST, runBenchmarkSuite, BenchmarkResult, RepoSize, BenchmarkConfig, PerformanceMetrics, PerformanceBenchmark
# dependencies: fs/promises, path, @isl-lang/isl-core, next/server

domain Benchmark {
  version: "1.0.0"

  type BenchmarkResult = String
  type RepoSize = String
  type BenchmarkConfig = String
  type PerformanceMetrics = String
  type PerformanceBenchmark = String

  invariants exports_present {
    - true
  }
}
