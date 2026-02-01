// ============================================================================
// Prometheus Exporter - Main exporter implementation
// ============================================================================

import { Registry, collectDefaultMetrics } from 'prom-client';
import type {
  Exporter,
  ExporterOptions,
  VerifyMetricResult,
  ChaosMetricResult,
  TrustScoreMetric,
  DEFAULT_OPTIONS,
} from './types';
import {
  VerificationMetrics,
  CoverageMetrics,
  TemporalMetrics,
  TrustMetrics,
  ChaosMetrics,
} from './metrics';
import { MetricsServer } from './server';

/**
 * Default options
 */
const DEFAULTS: Required<ExporterOptions> = {
  port: 9090,
  path: '/metrics',
  prefix: 'isl_',
  defaultLabels: {},
  collectDefaultMetrics: true,
  durationBuckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  latencyBuckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
};

/**
 * Prometheus metrics exporter for ISL verification
 */
export class PrometheusExporter implements Exporter {
  private registry: Registry;
  private server: MetricsServer;
  private options: Required<ExporterOptions>;
  
  // Metric collections
  private verificationMetrics: VerificationMetrics;
  private coverageMetrics: CoverageMetrics;
  private temporalMetrics: TemporalMetrics;
  private trustMetrics: TrustMetrics;
  private chaosMetrics: ChaosMetrics;

  constructor(options: ExporterOptions = {}) {
    this.options = { ...DEFAULTS, ...options };
    
    // Create registry
    this.registry = new Registry();
    
    // Set default labels
    if (Object.keys(this.options.defaultLabels).length > 0) {
      this.registry.setDefaultLabels(this.options.defaultLabels);
    }
    
    // Collect default Node.js metrics if enabled
    if (this.options.collectDefaultMetrics) {
      collectDefaultMetrics({ register: this.registry });
    }
    
    // Initialize metric collections
    this.verificationMetrics = new VerificationMetrics(
      this.registry,
      this.options.prefix,
      this.options.durationBuckets
    );
    
    this.coverageMetrics = new CoverageMetrics(
      this.registry,
      this.options.prefix
    );
    
    this.temporalMetrics = new TemporalMetrics(
      this.registry,
      this.options.prefix,
      this.options.latencyBuckets
    );
    
    this.trustMetrics = new TrustMetrics(
      this.registry,
      this.options.prefix
    );
    
    this.chaosMetrics = new ChaosMetrics(
      this.registry,
      this.options.prefix
    );
    
    // Create HTTP server
    this.server = new MetricsServer(this.registry, {
      port: this.options.port,
      path: this.options.path,
    });
  }

  /**
   * Record a verification result
   */
  recordVerification(result: VerifyMetricResult): void {
    const { domain, behavior, verdict, score, duration, coverage } = result;
    
    // Record verification metrics
    this.verificationMetrics.record(result);
    
    // Record coverage metrics
    this.coverageMetrics.record(domain, behavior, coverage);
    
    // Record trust score for behavior
    this.trustMetrics.record({ domain, behavior, score });
    this.trustMetrics.recordBehaviorVerdict(domain, behavior, verdict);
    
    // Update domain trust score
    const domainScore = this.trustMetrics.calculateDomainScore(domain);
    this.trustMetrics.record({ domain, score: domainScore });
  }

  /**
   * Record a chaos test result
   */
  recordChaos(result: ChaosMetricResult): void {
    this.chaosMetrics.record(result);
  }

  /**
   * Record implementation latency
   */
  recordLatency(domain: string, behavior: string, latency: number): void {
    this.temporalMetrics.record(domain, behavior, latency);
  }

  /**
   * Record trust score
   */
  recordTrustScore(metric: TrustScoreMetric): void {
    this.trustMetrics.record(metric);
  }

  /**
   * Start the HTTP server
   */
  async listen(): Promise<void> {
    await this.server.start();
  }

  /**
   * Stop the HTTP server
   */
  async close(): Promise<void> {
    await this.server.stop();
  }

  /**
   * Get current metrics as Prometheus text format
   */
  async metrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get content type for metrics
   */
  contentType(): string {
    return this.registry.contentType;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.verificationMetrics.reset();
    this.coverageMetrics.reset();
    this.temporalMetrics.reset();
    this.trustMetrics.reset();
    this.chaosMetrics.reset();
  }

  /**
   * Get the Prometheus registry
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Get verification metrics
   */
  getVerificationMetrics(): VerificationMetrics {
    return this.verificationMetrics;
  }

  /**
   * Get coverage metrics
   */
  getCoverageMetrics(): CoverageMetrics {
    return this.coverageMetrics;
  }

  /**
   * Get temporal metrics
   */
  getTemporalMetrics(): TemporalMetrics {
    return this.temporalMetrics;
  }

  /**
   * Get trust metrics
   */
  getTrustMetrics(): TrustMetrics {
    return this.trustMetrics;
  }

  /**
   * Get chaos metrics
   */
  getChaosMetrics(): ChaosMetrics {
    return this.chaosMetrics;
  }

  /**
   * Check SLA compliance
   */
  checkSlaCompliance(
    domain: string,
    behavior: string,
    threshold: number
  ): number {
    return this.temporalMetrics.checkSla(domain, behavior, threshold);
  }

  /**
   * Get chaos test statistics
   */
  getChaosStats(
    domain: string,
    scenario: string
  ): { pass: number; fail: number; rate: number } {
    return this.chaosMetrics.getStats(domain, scenario);
  }
}

/**
 * Create a Prometheus exporter
 */
export function createExporter(options?: ExporterOptions): Exporter {
  return new PrometheusExporter(options);
}
