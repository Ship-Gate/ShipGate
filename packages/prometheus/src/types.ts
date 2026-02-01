// ============================================================================
// Prometheus Exporter Types
// ============================================================================

/**
 * Verification verdict types
 */
export type Verdict = 'verified' | 'risky' | 'unsafe';

/**
 * Coverage categories
 */
export type CoverageCategory = 'preconditions' | 'postconditions' | 'invariants';

/**
 * Chaos test result
 */
export type ChaosTestResult = 'pass' | 'fail';

/**
 * Options for creating an exporter
 */
export interface ExporterOptions {
  /** Port to listen on (default: 9090) */
  port?: number;
  
  /** Path for metrics endpoint (default: '/metrics') */
  path?: string;
  
  /** Prefix for all metrics (default: 'isl_') */
  prefix?: string;
  
  /** Default labels to apply to all metrics */
  defaultLabels?: Record<string, string>;
  
  /** Enable default Node.js metrics (default: true) */
  collectDefaultMetrics?: boolean;
  
  /** Histogram buckets for duration metrics */
  durationBuckets?: number[];
  
  /** Histogram buckets for latency metrics */
  latencyBuckets?: number[];
}

/**
 * Coverage information
 */
export interface CoverageInfo {
  preconditions: number;
  postconditions: number;
  invariants: number;
}

/**
 * Verification result for metrics recording
 */
export interface VerifyMetricResult {
  /** Domain name */
  domain: string;
  
  /** Behavior name */
  behavior: string;
  
  /** Verification verdict */
  verdict: Verdict;
  
  /** Verification score (0-100) */
  score: number;
  
  /** Duration in seconds */
  duration: number;
  
  /** Coverage ratios */
  coverage: CoverageInfo;
  
  /** Optional additional labels */
  labels?: Record<string, string>;
}

/**
 * Chaos test result for metrics recording
 */
export interface ChaosMetricResult {
  /** Domain name */
  domain: string;
  
  /** Chaos scenario name */
  scenario: string;
  
  /** Test result */
  result: ChaosTestResult;
  
  /** Optional behavior name */
  behavior?: string;
  
  /** Optional duration in seconds */
  duration?: number;
  
  /** Optional additional labels */
  labels?: Record<string, string>;
}

/**
 * Latency measurement
 */
export interface LatencyMetric {
  /** Domain name */
  domain: string;
  
  /** Behavior name */
  behavior: string;
  
  /** Latency in seconds */
  latency: number;
  
  /** Optional percentile label */
  percentile?: string;
}

/**
 * Trust score metric
 */
export interface TrustScoreMetric {
  /** Domain name */
  domain: string;
  
  /** Trust score (0-100) */
  score: number;
  
  /** Optional behavior name (for behavior-specific trust) */
  behavior?: string;
}

/**
 * Exporter interface
 */
export interface Exporter {
  /** Record a verification result */
  recordVerification(result: VerifyMetricResult): void;
  
  /** Record a chaos test result */
  recordChaos(result: ChaosMetricResult): void;
  
  /** Record implementation latency */
  recordLatency(domain: string, behavior: string, latency: number): void;
  
  /** Record trust score */
  recordTrustScore(metric: TrustScoreMetric): void;
  
  /** Start the HTTP server */
  listen(): Promise<void>;
  
  /** Stop the HTTP server */
  close(): Promise<void>;
  
  /** Get current metrics as Prometheus text format */
  metrics(): Promise<string>;
  
  /** Get content type for metrics */
  contentType(): string;
  
  /** Reset all metrics */
  reset(): void;
}

/**
 * Metric labels
 */
export interface MetricLabels {
  domain: string;
  behavior?: string;
  verdict?: Verdict;
  category?: CoverageCategory;
  scenario?: string;
  result?: ChaosTestResult;
  [key: string]: string | undefined;
}

/**
 * Default exporter options
 */
export const DEFAULT_OPTIONS: Required<ExporterOptions> = {
  port: 9090,
  path: '/metrics',
  prefix: 'isl_',
  defaultLabels: {},
  collectDefaultMetrics: true,
  durationBuckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  latencyBuckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
};
