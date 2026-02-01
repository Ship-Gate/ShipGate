// ============================================================================
// Prometheus Exporter - Public API
// ============================================================================

// Main exporter
export { createExporter, PrometheusExporter } from './exporter';

// Types
export type {
  Exporter,
  ExporterOptions,
  VerifyMetricResult,
  ChaosMetricResult,
  TrustScoreMetric,
  LatencyMetric,
  CoverageInfo,
  CoverageCategory,
  Verdict,
  ChaosTestResult,
  MetricLabels,
} from './types';

export { DEFAULT_OPTIONS } from './types';

// Server
export {
  MetricsServer,
  createMetricsServer,
  metricsMiddleware,
  koaMetricsMiddleware,
  fastifyMetricsPlugin,
  type ServerOptions,
} from './server';

// Collector
export {
  MetricsCollector,
  BatchCollector,
  createCollector,
  createBatchCollector,
  type VerifierResult,
  type ChaosVerifierResult,
  type CollectorConfig,
  type CollectorCallback,
  type ChaosCollectorCallback,
} from './collector';

// Metrics (for advanced usage)
export {
  VerificationMetrics,
  CoverageMetrics,
  TemporalMetrics,
  TrustMetrics,
  ChaosMetrics,
} from './metrics';

// Re-export prom-client types for convenience
export { Registry, Counter, Gauge, Histogram, Summary } from 'prom-client';
