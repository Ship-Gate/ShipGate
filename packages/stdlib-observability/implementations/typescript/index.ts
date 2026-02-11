// ============================================================================
// Observability Standard Library - Main Entry Point
// @isl-lang/stdlib-observability
// ============================================================================

// Re-export all types
export * from './types';

// Re-export logging module
export {
  Logger,
  LogLevel,
  ConsoleLogExporter,
  InMemoryLogExporter,
  setLogContext,
  getLogContext,
  withLogContext,
  withoutLogContext,
  getDefaultLogger,
  setDefaultLogger,
} from './logging';
export type { LoggerConfig, LogExporter, LogContext } from './logging';

// Re-export metrics module
export {
  MetricsRegistry,
  ConsoleMetricExporter,
  InMemoryMetricExporter,
  getDefaultRegistry,
  setDefaultRegistry,
} from './metrics';
export type { MetricType, MetricUnit } from './types';

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

// Re-export tracing enums from types
export {
  SpanKind,
  SpanStatus,
  PropagationFormat,
} from './types';

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

// Re-export correlation module
export {
  getCorrelationContext,
  setCorrelationContext,
  withCorrelationContext,
  withoutCorrelationContext,
  generateCorrelationId,
  generateRequestId,
  startNewTrace,
  extractCorrelationFromHeaders,
  injectCorrelationIntoHeaders,
  isValidTraceId,
  isValidSpanId,
  isValidUUID,
  createCorrelationMiddleware,
} from './correlation';
export type { 
  CorrelationContext, 
  CorrelationHeaders, 
  CorrelationMiddleware 
} from './correlation';

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

// Re-export health enums from types
export {
  HealthStatus,
  HealthCheckType,
} from './types';

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
