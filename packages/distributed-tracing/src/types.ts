/**
 * Distributed Tracing Types
 */

export interface TracingConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  exporter: ExporterConfig;
  sampling?: SamplingConfig;
  propagation?: PropagationConfig;
  enrichment?: EnrichmentConfig;
  enableBehaviorTracing?: boolean;
  enableValidationTracing?: boolean;
}

export interface ExporterConfig {
  type: 'otlp' | 'jaeger' | 'zipkin' | 'console' | 'custom';
  endpoint?: string;
  headers?: Record<string, string>;
  compression?: 'none' | 'gzip';
  timeout?: number;
  customExporter?: unknown;
}

export interface SamplingConfig {
  strategy: 'always' | 'never' | 'ratio' | 'rate-limiting' | 'parent-based';
  ratio?: number;
  maxTracesPerSecond?: number;
  rules?: SamplingRule[];
}

export interface SamplingRule {
  name: string;
  match: {
    behavior?: string;
    domain?: string;
    attributes?: Record<string, unknown>;
  };
  sample: boolean | number;
}

export interface PropagationConfig {
  formats: ('w3c' | 'b3' | 'jaeger' | 'baggage')[];
  customHeaders?: string[];
}

export interface EnrichmentConfig {
  addBehaviorContext?: boolean;
  addValidationResults?: boolean;
  addISLMetadata?: boolean;
  customEnrichers?: SpanEnricher[];
}

export type SpanEnricher = (span: BehaviorSpan) => Record<string, unknown>;

export interface BehaviorSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  status: SpanStatus;
  attributes: Record<string, AttributeValue>;
  events: SpanEvent[];
  links: SpanLink[];
  context: BehaviorContext;
}

export type SpanKind = 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';

export interface SpanStatus {
  code: 'UNSET' | 'OK' | 'ERROR';
  message?: string;
}

export type AttributeValue = string | number | boolean | string[] | number[] | boolean[];

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, AttributeValue>;
}

export interface SpanLink {
  traceId: string;
  spanId: string;
  attributes?: Record<string, AttributeValue>;
}

export interface BehaviorContext {
  domain: string;
  behavior: string;
  version?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  preconditions?: ConditionResult[];
  postconditions?: ConditionResult[];
  errors?: ErrorInfo[];
}

export interface ConditionResult {
  name: string;
  expression: string;
  passed: boolean;
  actualValue?: unknown;
  expectedValue?: unknown;
  duration?: number;
}

export interface ErrorInfo {
  code: string;
  message: string;
  stack?: string;
  islError?: boolean;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  traceState?: string;
}

export interface TracedBehavior<TInput, TOutput> {
  name: string;
  domain: string;
  execute: (input: TInput, context: TraceContext) => Promise<TOutput>;
  preconditions?: ((input: TInput) => ConditionResult)[];
  postconditions?: ((input: TInput, output: TOutput) => ConditionResult)[];
}

export interface TracingMetrics {
  totalSpans: number;
  errorSpans: number;
  averageDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  spansByBehavior: Record<string, number>;
  errorsByBehavior: Record<string, number>;
}
