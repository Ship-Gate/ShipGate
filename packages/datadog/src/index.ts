// ============================================================================
// Datadog ISL Integration - Public API
// ============================================================================

/**
 * @packageDocumentation
 * 
 * Datadog integration for ISL verification monitoring.
 * 
 * ## Features
 * 
 * - **Metrics**: Record verification results, coverage, and SLO metrics
 * - **Traces**: Distributed tracing for behavior executions
 * - **Logs**: Structured logging with trace correlation
 * - **Monitors**: Auto-generate Datadog monitors from ISL specs
 * - **Dashboards**: Auto-generate dashboards from ISL domains
 * - **Synthetics**: Auto-generate API tests from ISL behaviors
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { createDatadogClient, createInitializedClient } from '@intentos/datadog';
 * 
 * // Create and initialize client
 * const client = await createInitializedClient({
 *   serviceName: 'my-service',
 *   env: 'production',
 * });
 * 
 * // Record verification
 * client.recordVerification({
 *   domain: 'auth',
 *   behavior: 'login',
 *   verdict: 'verified',
 *   score: 98,
 *   duration: 45,
 *   coverage: { preconditions: 1, postconditions: 0.95, invariants: 1 },
 * });
 * ```
 * 
 * @module @intentos/datadog
 */

// ============================================================================
// Client
// ============================================================================

export {
  DatadogClient,
  createDatadogClient,
  createInitializedClient,
} from './client.js';

// ============================================================================
// Types
// ============================================================================

export type {
  // Configuration
  DatadogConfig,
  
  // Metrics
  Verdict,
  CoverageCategory,
  CheckType,
  CoverageInfo,
  VerifyResult,
  CheckResult,
  SLOMetric,
  
  // Monitors
  DatadogMonitor,
  MonitorThresholds,
  MonitorOptions,
  
  // Dashboards
  DatadogDashboard,
  DashboardWidget,
  WidgetDefinition,
  WidgetRequest,
  TemplateVariable,
  
  // Synthetics
  DatadogSynthetic,
  SyntheticRequest,
  SyntheticAssertion,
  SyntheticOptions,
  
  // Logs
  LogLevel,
  LogEntry,
  
  // Traces
  SpanContext,
  SpanOptions,
  Span,
  
  // Domain (ISL)
  Domain,
  Behavior,
  TemporalSpec,
  TemporalOperator,
} from './types.js';

export { DEFAULT_CONFIG } from './types.js';

// ============================================================================
// Metrics
// ============================================================================

export {
  // Verification
  VerificationMetrics,
  createVerificationMetrics,
  
  // Coverage
  CoverageMetrics,
  createCoverageMetrics,
  type CoverageDataPoint,
  type CoverageStats,
  
  // SLO
  SLOMetrics,
  createSLOMetrics,
  type SLODefinition,
  type SLOStatus,
} from './metrics/index.js';

// ============================================================================
// Traces
// ============================================================================

export {
  ISLTracer,
  createISLTracer,
  SpanBuilder,
  Traced,
  type ISLSpanAttributes,
} from './traces/index.js';

// ============================================================================
// Logs
// ============================================================================

export {
  StructuredLogger,
  createLogger,
  AuditLogger,
  createAuditLogger,
  type LogContext,
  type LoggerOptions,
} from './logs/index.js';

// ============================================================================
// Monitors
// ============================================================================

export {
  // Generator
  MonitorGenerator,
  createMonitorGenerator,
  generateDatadogMonitors,
  type MonitorGeneratorOptions,
  type MonitorGeneratorResult,
  
  // Templates
  MONITOR_TEMPLATES,
  verificationScoreMonitor,
  verificationFailureMonitor,
  verificationLatencyMonitor,
  coverageDropMonitor,
  sloBurnRateMonitor,
  sloBreachMonitor,
  errorBudgetExhaustedMonitor,
  verificationScoreAnomalyMonitor,
  verificationRateAnomalyMonitor,
  domainHealthMonitor,
  type MonitorTemplate,
  type TemplateParams,
  type MonitorTemplateName,
} from './monitors/index.js';

// ============================================================================
// Dashboards
// ============================================================================

export {
  DashboardGenerator,
  createDashboardGenerator,
  generateDatadogDashboard,
  type DashboardGeneratorOptions,
} from './dashboards/index.js';

// ============================================================================
// Synthetics
// ============================================================================

export {
  SyntheticGenerator,
  createSyntheticGenerator,
  generateSyntheticTests,
  type SyntheticGeneratorOptions,
} from './synthetics/index.js';

// ============================================================================
// Convenience Class (All-in-one)
// ============================================================================

import { DatadogClient } from './client.js';
import { VerificationMetrics } from './metrics/verification.js';
import { CoverageMetrics } from './metrics/coverage.js';
import { SLOMetrics } from './metrics/slo.js';
import { ISLTracer } from './traces/span.js';
import { StructuredLogger, AuditLogger } from './logs/structured.js';
import { MonitorGenerator } from './monitors/generator.js';
import { DashboardGenerator } from './dashboards/generator.js';
import { SyntheticGenerator } from './synthetics/generator.js';
import type { DatadogConfig, Domain } from './types.js';

/**
 * All-in-one ISL Datadog integration
 * 
 * Provides a unified interface for all Datadog integration features.
 * 
 * @example
 * ```typescript
 * const datadog = await DatadogISL.create({
 *   serviceName: 'my-service',
 *   env: 'production',
 * });
 * 
 * // Use all features
 * datadog.verification.recordVerification(result);
 * datadog.tracer.traceBehavior('auth', 'login', async () => { ... });
 * datadog.logger.info('Processing', { domain: 'auth' });
 * 
 * // Generate monitors
 * const monitors = datadog.monitors.generateForDomain(authDomain);
 * ```
 */
export class DatadogISL {
  /** Main client */
  readonly client: DatadogClient;
  
  /** Verification metrics */
  readonly verification: VerificationMetrics;
  
  /** Coverage metrics */
  readonly coverage: CoverageMetrics;
  
  /** SLO metrics */
  readonly slo: SLOMetrics;
  
  /** Distributed tracer */
  readonly tracer: ISLTracer;
  
  /** Structured logger */
  readonly logger: StructuredLogger;
  
  /** Audit logger */
  readonly audit: AuditLogger;
  
  /** Monitor generator */
  readonly monitors: MonitorGenerator;
  
  /** Dashboard generator */
  readonly dashboards: DashboardGenerator;
  
  /** Synthetic test generator */
  readonly synthetics: SyntheticGenerator;

  private constructor(client: DatadogClient) {
    this.client = client;
    this.verification = new VerificationMetrics(client);
    this.coverage = new CoverageMetrics(client);
    this.slo = new SLOMetrics(client);
    this.tracer = new ISLTracer(client);
    this.logger = new StructuredLogger(client);
    this.audit = new AuditLogger(client);
    this.monitors = new MonitorGenerator();
    this.dashboards = new DashboardGenerator();
    this.synthetics = new SyntheticGenerator();
  }

  /**
   * Create and initialize a DatadogISL instance
   */
  static async create(config?: Partial<DatadogConfig>): Promise<DatadogISL> {
    const client = new DatadogClient(config);
    await client.initialize();
    return new DatadogISL(client);
  }

  /**
   * Generate all Datadog resources for a domain
   */
  generateForDomain(domain: Domain) {
    return {
      monitors: this.monitors.generateForDomain(domain),
      dashboard: this.dashboards.generateForDomain(domain),
      synthetics: this.synthetics.generateForDomain(domain),
    };
  }

  /**
   * Export all generated resources as JSON
   */
  exportToJSON(domain: Domain): string {
    const resources = this.generateForDomain(domain);
    return JSON.stringify(resources, null, 2);
  }

  /**
   * Close the client
   */
  async close(): Promise<void> {
    await this.client.close();
  }
}
