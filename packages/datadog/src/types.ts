// ============================================================================
// Datadog ISL Integration Types
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
 * Check types for individual verification checks
 */
export type CheckType = 'precondition' | 'postcondition' | 'invariant' | 'temporal';

/**
 * Temporal operators from ISL specs
 */
export type TemporalOperator = 'within' | 'eventually' | 'always' | 'until' | 'never';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Datadog client configuration
 */
export interface DatadogConfig {
  /** Datadog API key (or use DD_API_KEY env var) */
  apiKey?: string;
  
  /** Datadog APP key for API calls (or use DD_APP_KEY env var) */
  appKey?: string;
  
  /** Datadog agent host (default: localhost) */
  agentHost?: string;
  
  /** StatsD port (default: 8125) */
  statsdPort?: number;
  
  /** Service name for tracing */
  serviceName?: string;
  
  /** Environment (default: development) */
  env?: string;
  
  /** Version tag */
  version?: string;
  
  /** Metric prefix (default: 'isl.') */
  metricPrefix?: string;
  
  /** Default tags to apply to all metrics */
  globalTags?: Record<string, string>;
  
  /** Enable log injection (default: true) */
  logInjection?: boolean;
  
  /** Enable runtime metrics (default: true) */
  runtimeMetrics?: boolean;
  
  /** Sample rate for traces (0-1, default: 1) */
  sampleRate?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<DatadogConfig> = {
  apiKey: '',
  appKey: '',
  agentHost: 'localhost',
  statsdPort: 8125,
  serviceName: 'isl-verification',
  env: 'development',
  version: '1.0.0',
  metricPrefix: 'isl.',
  globalTags: {},
  logInjection: true,
  runtimeMetrics: true,
  sampleRate: 1,
};

// ============================================================================
// Metric Types
// ============================================================================

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
export interface VerifyResult {
  /** Domain name */
  domain: string;
  
  /** Behavior name */
  behavior: string;
  
  /** Verification verdict */
  verdict: Verdict;
  
  /** Verification score (0-100) */
  score: number;
  
  /** Duration in milliseconds */
  duration: number;
  
  /** Coverage ratios (0-1) */
  coverage: CoverageInfo;
  
  /** Number of checks performed */
  checkCount?: number;
  
  /** Optional error message if failed */
  error?: string;
  
  /** Optional additional labels */
  labels?: Record<string, string>;
}

/**
 * Individual check result
 */
export interface CheckResult {
  /** Check type */
  type: CheckType;
  
  /** Domain name */
  domain: string;
  
  /** Behavior name */
  behavior: string;
  
  /** Whether check passed */
  passed: boolean;
  
  /** Check duration in milliseconds */
  duration: number;
  
  /** Check expression/name */
  expression?: string;
  
  /** Error message if failed */
  error?: string;
  
  /** Optional additional labels */
  labels?: Record<string, string>;
}

/**
 * SLO metric data
 */
export interface SLOMetric {
  /** SLO name */
  name: string;
  
  /** Domain name */
  domain: string;
  
  /** Target percentage (0-100) */
  target: number;
  
  /** Current percentage (0-100) */
  current: number;
  
  /** Time window in seconds */
  windowSeconds: number;
  
  /** Good events count */
  goodEvents: number;
  
  /** Total events count */
  totalEvents: number;
}

// ============================================================================
// Monitor Types
// ============================================================================

/**
 * Monitor threshold configuration
 */
export interface MonitorThresholds {
  critical?: number;
  warning?: number;
  ok?: number;
}

/**
 * Monitor options
 */
export interface MonitorOptions {
  thresholds: MonitorThresholds;
  notify_no_data?: boolean;
  no_data_timeframe?: number;
  require_full_window?: boolean;
  evaluation_delay?: number;
  new_group_delay?: number;
  renotify_interval?: number;
  escalation_message?: string;
  include_tags?: boolean;
  notify_audit?: boolean;
}

/**
 * Datadog monitor definition
 */
export interface DatadogMonitor {
  name: string;
  type: 'metric alert' | 'query alert' | 'service check' | 'event alert' | 'log alert';
  query: string;
  message: string;
  tags: string[];
  options: MonitorOptions;
  priority?: number;
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Widget request for queries
 */
export interface WidgetRequest {
  q?: string;
  queries?: Array<{
    data_source?: string;
    name?: string;
    query: string;
  }>;
  formulas?: Array<{
    formula: string;
    alias?: string;
  }>;
  response_format?: string;
  display_type?: 'line' | 'bars' | 'area';
  aggregator?: 'avg' | 'sum' | 'min' | 'max' | 'last';
  style?: {
    palette?: string;
    line_type?: 'solid' | 'dashed' | 'dotted';
    line_width?: 'thin' | 'normal' | 'thick';
  };
}

/**
 * Widget definition
 */
export interface WidgetDefinition {
  title?: string;
  title_size?: string;
  title_align?: 'left' | 'center' | 'right';
  type: string;
  requests?: WidgetRequest[];
  precision?: number;
  autoscale?: boolean;
  custom_unit?: string;
  text_align?: 'left' | 'center' | 'right';
  time?: {
    live_span?: string;
  };
  style?: Record<string, unknown>;
  yaxis?: {
    scale?: string;
    min?: string;
    max?: string;
    include_zero?: boolean;
  };
}

/**
 * Dashboard widget
 */
export interface DashboardWidget {
  id?: number;
  definition: WidgetDefinition;
  layout?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Template variable
 */
export interface TemplateVariable {
  name: string;
  default: string;
  prefix: string;
  available_values?: string[];
}

/**
 * Datadog dashboard definition
 */
export interface DatadogDashboard {
  title: string;
  description?: string;
  widgets: DashboardWidget[];
  layout_type: 'ordered' | 'free';
  is_read_only?: boolean;
  notify_list?: string[];
  template_variables?: TemplateVariable[];
  reflow_type?: 'auto' | 'fixed';
}

// ============================================================================
// Synthetic Test Types
// ============================================================================

/**
 * HTTP request configuration
 */
export interface SyntheticRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  basicAuth?: {
    username: string;
    password: string;
  };
}

/**
 * Assertion for synthetic tests
 */
export interface SyntheticAssertion {
  type: 'statusCode' | 'responseTime' | 'header' | 'body' | 'certificate';
  operator: 'is' | 'isNot' | 'contains' | 'doesNotContain' | 'matches' | 'doesNotMatch' | 'lessThan' | 'moreThan' | 'isInLessThan';
  target: string | number;
  property?: string;
}

/**
 * Synthetic test options
 */
export interface SyntheticOptions {
  tick_every: number;
  min_location_failed?: number;
  min_failure_duration?: number;
  retry?: {
    count: number;
    interval: number;
  };
  follow_redirects?: boolean;
  allow_insecure?: boolean;
  monitor_options?: {
    renotify_interval?: number;
  };
}

/**
 * Datadog synthetic test definition
 */
export interface DatadogSynthetic {
  name: string;
  type: 'api' | 'browser';
  subtype?: 'http' | 'ssl' | 'tcp' | 'dns' | 'multi' | 'grpc' | 'websocket';
  config: {
    request: SyntheticRequest;
    assertions: SyntheticAssertion[];
    variables?: Array<{
      name: string;
      type: string;
      value?: string;
    }>;
  };
  options: SyntheticOptions;
  locations: string[];
  tags: string[];
  message?: string;
  status?: 'live' | 'paused';
}

// ============================================================================
// Log Types
// ============================================================================

/**
 * Log severity levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

/**
 * Structured log entry
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp?: Date;
  domain?: string;
  behavior?: string;
  traceId?: string;
  spanId?: string;
  attributes?: Record<string, unknown>;
}

// ============================================================================
// Domain Types (from ISL)
// ============================================================================

/**
 * Temporal specification from ISL
 */
export interface TemporalSpec {
  operator: TemporalOperator;
  duration?: string;
  percentile?: number;
  expression?: string;
}

/**
 * Behavior definition from ISL domain
 */
export interface Behavior {
  name: string;
  description?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  preconditions?: string[];
  postconditions?: string[];
  invariants?: string[];
  temporal?: TemporalSpec[];
}

/**
 * Domain definition from ISL
 */
export interface Domain {
  name: string;
  description?: string;
  version?: string;
  behaviors: Behavior[];
  entities?: Array<{
    name: string;
    properties?: Record<string, unknown>;
  }>;
  invariants?: string[];
}

// ============================================================================
// Trace Types
// ============================================================================

/**
 * Span context for distributed tracing
 */
export interface SpanContext {
  traceId: string;
  spanId: string;
  parentId?: string;
  sampled?: boolean;
}

/**
 * Span options
 */
export interface SpanOptions {
  domain: string;
  behavior: string;
  operationType?: 'verification' | 'execution' | 'check';
  parentContext?: SpanContext;
  tags?: Record<string, string | number | boolean>;
}

/**
 * Span interface
 */
export interface Span {
  traceId: string;
  spanId: string;
  setTag(key: string, value: string | number | boolean): void;
  setError(error: Error): void;
  finish(): void;
}
