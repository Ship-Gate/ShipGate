/**
 * @intentos/verifier-temporal
 * 
 * Temporal property verification for ISL specifications.
 * Verifies eventually, within (latency), and always (invariant) properties.
 */

// Main verifier
export {
  verify,
  verifyRequest,
  checkEventually,
  checkWithin,
  checkAlways,
  formatVerifyResult,
  type VerifyRequest,
  type VerifyOptions,
  type VerifyResult,
  type TemporalPropertyResult,
  type VerifySummary,
  type VerifyError,
  type ImplementationExecutor,
} from './verifier.js';

// Property checkers
export {
  eventually,
  eventuallyWithin,
  eventuallyAll,
  eventuallyAny,
  createEventuallyChecker,
  type EventuallyOptions,
  type EventuallyResult,
} from './properties/eventually.js';

export {
  within,
  withinDuration,
  withinMultiple,
  assertWithin,
  createWithinChecker,
  formatWithinResult,
  type WithinOptions,
  type WithinResult,
} from './properties/within.js';

export {
  always,
  alwaysFor,
  alwaysN,
  alwaysAll,
  assertAlways,
  createAlwaysChecker,
  formatAlwaysResult,
  type AlwaysOptions,
  type AlwaysResult,
  type AlwaysCheckResult,
} from './properties/always.js';

// Timing utilities
export {
  now,
  measureAsync,
  measureSync,
  collectSamples,
  collectSamplesParallel,
  toMilliseconds,
  formatDuration,
  sleep,
  type TimingResult,
  type TimingSample,
} from './timing.js';

// Percentile calculations
export {
  calculatePercentile,
  calculatePercentiles,
  calculateLatencyStats,
  meetsLatencyThreshold,
  formatLatencyStats,
  type PercentileResult,
  type LatencyStats,
} from './percentiles.js';

// Histogram
export {
  createHistogram,
  createLatencyHistogram,
  formatHistogramAscii,
  getCumulativeDistribution,
  mergeHistograms,
  DEFAULT_LATENCY_BOUNDARIES,
  type Histogram,
  type HistogramBucket,
  type HistogramOptions,
} from './histogram.js';
