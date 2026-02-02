// ============================================================================
// Observability Standard Library - Type Definitions
// @isl-lang/stdlib-observability
// ============================================================================

// ============================================================================
// Common Types
// ============================================================================

export type UUID = string;
export type TraceId = string;
export type SpanId = string;
export type MetricName = string;
export type LabelName = string;
export type LabelValue = string;
export type Timestamp = Date;
export type Duration = number; // milliseconds

// ============================================================================
// Result Type
// ============================================================================

export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

export function success<T>(value: T): Result<T, never> {
  return { success: true, value };
}

export function failure<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// ============================================================================
// Logging Types
// ============================================================================

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

export interface LogSource {
  file?: string;
  line?: number;
  function?: string;
}

export interface LogError {
  type: string;
  message: string;
  stackTrace?: string;
}

export interface LogEntry {
  id: UUID;
  timestamp: Timestamp;
  level: LogLevel;
  message: string;
  template?: string;
  service: string;
  environment: string;
  host?: string;
  traceId?: TraceId;
  spanId?: SpanId;
  correlationId?: UUID;
  requestId?: UUID;
  attributes?: Record<string, unknown>;
  error?: LogError;
  source?: LogSource;
}

export interface LogInput {
  level: LogLevel;
  message: string;
  attributes?: Record<string, unknown>;
  error?: Error;
}

export interface LogOutput {
  id: UUID;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  service: string;
  environment: string;
  host?: string;
  defaultAttributes?: Record<string, unknown>;
}

export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  minLevel: LogLevel.INFO,
  service: 'unknown',
  environment: 'development',
};

// ============================================================================
// Metrics Types
// ============================================================================

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

export enum MetricUnit {
  // Time
  SECONDS = 'seconds',
  MILLISECONDS = 'milliseconds',
  MICROSECONDS = 'microseconds',
  // Size
  BYTES = 'bytes',
  KILOBYTES = 'kilobytes',
  MEGABYTES = 'megabytes',
  // Count
  COUNT = 'count',
  PERCENT = 'percent',
  RATIO = 'ratio',
  // Rate
  PER_SECOND = 'per_second',
  PER_MINUTE = 'per_minute',
}

export interface MetricDefinition {
  name: MetricName;
  type: MetricType;
  description: string;
  unit?: MetricUnit;
  labels?: LabelName[];
  buckets?: number[];
  objectives?: Map<number, number>;
  maxAge?: Duration;
}

export interface MetricSample {
  name: MetricName;
  timestamp: Timestamp;
  value: number;
  labels?: Record<LabelName, LabelValue>;
}

export interface CounterInput {
  name: MetricName;
  value?: number;
  labels?: Record<LabelName, LabelValue>;
}

export interface GaugeInput {
  name: MetricName;
  value: number;
  labels?: Record<LabelName, LabelValue>;
}

export interface HistogramInput {
  name: MetricName;
  value: number;
  labels?: Record<LabelName, LabelValue>;
}

export interface TimingInput {
  name: MetricName;
  startTime: Timestamp;
  endTime?: Timestamp;
  labels?: Record<LabelName, LabelValue>;
}

export interface TimingOutput {
  durationMs: number;
}

// ============================================================================
// Tracing Types
// ============================================================================

export enum SpanKind {
  INTERNAL = 'internal',
  SERVER = 'server',
  CLIENT = 'client',
  PRODUCER = 'producer',
  CONSUMER = 'consumer',
}

export enum SpanStatus {
  UNSET = 'unset',
  OK = 'ok',
  ERROR = 'error',
}

export interface SpanEvent {
  name: string;
  timestamp: Timestamp;
  attributes?: Record<string, unknown>;
}

export interface SpanLink {
  traceId: TraceId;
  spanId: SpanId;
  attributes?: Record<string, unknown>;
}

export interface SpanResource {
  serviceName: string;
  serviceVersion?: string;
  host?: string;
  containerId?: string;
}

export interface Span {
  spanId: SpanId;
  traceId: TraceId;
  parentSpanId?: SpanId;
  name: string;
  kind: SpanKind;
  service: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  durationMs?: number;
  status: SpanStatus;
  statusMessage?: string;
  attributes?: Record<string, unknown>;
  events?: SpanEvent[];
  links?: SpanLink[];
  resource?: SpanResource;
}

export interface Trace {
  traceId: TraceId;
  name: string;
  service: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  durationMs?: number;
  status: SpanStatus;
  spans: Span[];
}

export interface SpanContext {
  traceId: TraceId;
  spanId: SpanId;
  traceFlags: number;
  traceState?: string;
  remote: boolean;
}

export interface StartSpanInput {
  name: string;
  kind?: SpanKind;
  parentContext?: SpanContext;
  attributes?: Record<string, unknown>;
  links?: SpanLink[];
}

export interface StartSpanOutput {
  span: Span;
  context: SpanContext;
}

export interface EndSpanInput {
  spanId: SpanId;
  status?: SpanStatus;
  statusMessage?: string;
}

export interface AddSpanEventInput {
  spanId: SpanId;
  name: string;
  attributes?: Record<string, unknown>;
}

export interface SetSpanAttributeInput {
  spanId: SpanId;
  key: string;
  value: unknown;
}

export enum PropagationFormat {
  W3C_TRACE_CONTEXT = 'w3c_trace_context',
  W3C_BAGGAGE = 'w3c_baggage',
  B3_SINGLE = 'b3_single',
  B3_MULTI = 'b3_multi',
  JAEGER = 'jaeger',
  XRAY = 'xray',
}

export interface InjectContextInput {
  context: SpanContext;
  carrier: Record<string, string>;
  format?: PropagationFormat;
}

export interface ExtractContextInput {
  carrier: Record<string, string>;
  format?: PropagationFormat;
}

// ============================================================================
// Alerting Types
// ============================================================================

export enum ComparisonOperator {
  GREATER_THAN = 'greater_than',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN = 'less_than',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  EQUAL = 'equal',
  NOT_EQUAL = 'not_equal',
}

export interface AlertThreshold {
  operator: ComparisonOperator;
  value: number;
}

export enum AlertState {
  INACTIVE = 'inactive',
  PENDING = 'pending',
  FIRING = 'firing',
  RESOLVED = 'resolved',
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

export interface AlertNotification {
  channel: string;
  sentAt: Timestamp;
  acknowledgedAt?: Timestamp;
  acknowledgedBy?: string;
}

export interface AlertRule {
  id: UUID;
  name: string;
  description?: string;
  query: string;
  threshold: AlertThreshold;
  forDuration?: Duration;
  evaluationInterval: Duration;
  state: AlertState;
  activeSince?: Timestamp;
  severity: AlertSeverity;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  notificationChannels: string[];
  silencedUntil?: Timestamp;
}

export interface Alert {
  id: UUID;
  ruleId: UUID;
  state: AlertState;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  labels: Record<string, string>;
  annotations?: Record<string, string>;
  value: number;
  notifications: AlertNotification[];
}

export interface CreateAlertRuleInput {
  name: string;
  query: string;
  threshold: AlertThreshold;
  severity: AlertSeverity;
  notificationChannels: string[];
  forDuration?: Duration;
  description?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AcknowledgeAlertInput {
  alertId: UUID;
  acknowledgedBy: string;
  comment?: string;
}

export interface SilenceAlertInput {
  ruleId: UUID;
  until: Timestamp;
  reason: string;
  createdBy: string;
}

// ============================================================================
// Health Check Types
// ============================================================================

export enum HealthCheckType {
  HTTP = 'http',
  TCP = 'tcp',
  GRPC = 'grpc',
  COMMAND = 'command',
  CUSTOM = 'custom',
}

export enum HealthStatus {
  UNKNOWN = 'unknown',
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

export interface HealthCheck {
  name: string;
  description?: string;
  type: HealthCheckType;
  endpoint?: string;
  timeout: Duration;
  interval: Duration;
  status: HealthStatus;
  lastCheckAt?: Timestamp;
  lastSuccessAt?: Timestamp;
  lastFailureAt?: Timestamp;
  unhealthyThreshold: number;
  healthyThreshold: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

export interface HealthCheckResult {
  status: HealthStatus;
  message?: string;
  durationMs: number;
}

export interface CheckHealthInput {
  checks?: string[];
}

export interface CheckHealthOutput {
  status: HealthStatus;
  checks: Record<string, HealthCheckResult>;
}

// ============================================================================
// SLO Types
// ============================================================================

export enum SLIType {
  AVAILABILITY = 'availability',
  LATENCY = 'latency',
  ERROR_RATE = 'error_rate',
  THROUGHPUT = 'throughput',
  CUSTOM = 'custom',
}

export interface SLI {
  type: SLIType;
  query: string;
  goodQuery?: string;
  totalQuery?: string;
}

export interface BurnRateAlert {
  window: Duration;
  threshold: number;
  severity: AlertSeverity;
}

export interface SLO {
  id: UUID;
  name: string;
  description?: string;
  sli: SLI;
  target: number;
  window: Duration;
  currentValue?: number;
  errorBudgetRemaining?: number;
  burnRateAlerts?: BurnRateAlert[];
}

export interface CalculateSLOInput {
  sloId: UUID;
  window?: Duration;
}

export interface CalculateSLOOutput {
  value: number;
  target: number;
  errorBudgetTotal: number;
  errorBudgetRemaining: number;
  errorBudgetConsumedPercent: number;
  burnRate: number;
}

// ============================================================================
// Exporter Interface
// ============================================================================

export interface LogExporter {
  export(entries: LogEntry[]): Promise<void>;
  shutdown(): Promise<void>;
}

export interface MetricExporter {
  export(samples: MetricSample[]): Promise<void>;
  shutdown(): Promise<void>;
}

export interface SpanExporter {
  export(spans: Span[]): Promise<void>;
  shutdown(): Promise<void>;
}
