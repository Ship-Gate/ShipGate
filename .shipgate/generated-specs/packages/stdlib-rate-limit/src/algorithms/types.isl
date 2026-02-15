# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: AlgorithmState, TokenBucketState, SlidingWindowState, FixedWindowState, LeakyBucketState, TokenBucketConfig, SlidingWindowConfig, FixedWindowConfig, LeakyBucketConfig, AlgorithmInput, AlgorithmOutput, RateLimitAlgorithm, AlgorithmFactory, AlgorithmRegistry, AlgorithmMetrics, AlgorithmDebugInfo, MathUtils, AlgorithmOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type AlgorithmState = String
  type TokenBucketState = String
  type SlidingWindowState = String
  type FixedWindowState = String
  type LeakyBucketState = String
  type TokenBucketConfig = String
  type SlidingWindowConfig = String
  type FixedWindowConfig = String
  type LeakyBucketConfig = String
  type AlgorithmInput = String
  type AlgorithmOutput = String
  type RateLimitAlgorithm = String
  type AlgorithmFactory = String
  type AlgorithmRegistry = String
  type AlgorithmMetrics = String
  type AlgorithmDebugInfo = String
  type MathUtils = String
  type AlgorithmOptions = String

  invariants exports_present {
    - true
  }
}
