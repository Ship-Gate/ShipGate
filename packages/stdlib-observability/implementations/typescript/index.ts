// ============================================================================
// Observability Standard Library - Main Entry Point
// @isl-lang/stdlib-observability
// ============================================================================

// Re-export all types
export * from './types';

// Re-export logging module
export {
  Logger,
  ConsoleLogExporter,
  InMemoryLogExporter,
  setLogContext,
  clearLogContext,
  getLogContext,
  logLevelToString,
  parseLogLevel,
  getDefaultLogger,
  setDefaultLogger,
} from './logging';

// Re-export metrics module
export {
  MetricsRegistry,
  ConsoleMetricExporter,
  InMemoryMetricExporter,
  getDefaultRegistry,
  setDefaultRegistry,
} from './metrics';

// Re-export tracing module
export {
  Tracer,
  ConsoleSpanExporter,
  InMemorySpanExporter,
  injectContext,
  extractContext,
  getDefaultTracer,
  setDefaultTracer,
  B3_PARENT_SPAN_ID_HEADER,
} from './tracing';
export type { TracerConfig } from './tracing';

// Re-export alerting module
export {
  AlertManager,
  ConsoleNotificationChannel,
  SimpleQueryEvaluator,
  evaluateThreshold,
  getDefaultAlertManager,
  setDefaultAlertManager,
} from './alerts';
export type { NotificationChannel, QueryEvaluator } from './alerts';

// Re-export health module
export {
  HealthCheckRegistry,
  ProbeRegistry,
  createHttpHealthCheck,
  createTcpHealthCheck,
  createCustomHealthCheck,
  getDefaultHealthRegistry,
  setDefaultHealthRegistry,
} from './health';
export type { HealthCheckFunction } from './health';

// Import default exports
import LoggingModule from './logging';
import MetricsModule from './metrics';
import TracingModule from './tracing';
import AlertsModule from './alerts';
import HealthModule from './health';

// Export namespace modules
export const Logging = LoggingModule;
export const Metrics = MetricsModule;
export const Tracing = TracingModule;
export const Alerts = AlertsModule;
export const Health = HealthModule;

// Convenience namespace export
export const Observability = {
  Logging: LoggingModule,
  Metrics: MetricsModule,
  Tracing: TracingModule,
  Alerts: AlertsModule,
  Health: HealthModule,
};

export default Observability;
