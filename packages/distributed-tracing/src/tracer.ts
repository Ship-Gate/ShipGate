/**
 * ISL Behavior Tracer
 */
import {
  trace,
  context,
  SpanStatusCode,
  SpanKind as OtelSpanKind,
  Span,
  Tracer as OtelTracer,
  Context,
  propagation,
} from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  SimpleSpanProcessor,
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { Resource } from '@opentelemetry/resources';

import type {
  TracingConfig,
  ConditionResult,
  TraceContext,
  SpanKind,
  TracedBehavior,
  TracingMetrics,
} from './types';

// ISL-specific semantic conventions
const ISL_ATTRIBUTES = {
  DOMAIN: 'isl.domain',
  BEHAVIOR: 'isl.behavior',
  BEHAVIOR_VERSION: 'isl.behavior.version',
  INPUT_HASH: 'isl.input.hash',
  OUTPUT_HASH: 'isl.output.hash',
  PRECONDITION_COUNT: 'isl.preconditions.count',
  PRECONDITION_PASSED: 'isl.preconditions.passed',
  POSTCONDITION_COUNT: 'isl.postconditions.count',
  POSTCONDITION_PASSED: 'isl.postconditions.passed',
  ERROR_CODE: 'isl.error.code',
  ERROR_ISL: 'isl.error.is_isl_error',
  VALIDATION_DURATION: 'isl.validation.duration_ms',
};

export class ISLTracer {
  private config: TracingConfig;
  private provider: NodeTracerProvider;
  private tracer: OtelTracer;
  private metrics: TracingMetrics;
  private durations: number[] = [];

  constructor(config: TracingConfig) {
    this.config = config;
    this.provider = this.createProvider();
    this.tracer = trace.getTracer(config.serviceName, config.serviceVersion);
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize the tracer
   */
  async initialize(): Promise<void> {
    this.provider.register();
  }

  /**
   * Trace an ISL behavior execution
   */
  async traceBehavior<TInput, TOutput>(
    behavior: TracedBehavior<TInput, TOutput>,
    input: TInput,
    parentContext?: Context
  ): Promise<TOutput> {
    const spanName = `${behavior.domain}.${behavior.name}`;
    const ctx = parentContext ?? context.active();

    return this.tracer.startActiveSpan(
      spanName,
      {
        kind: OtelSpanKind.INTERNAL,
        attributes: {
          [ISL_ATTRIBUTES.DOMAIN]: behavior.domain,
          [ISL_ATTRIBUTES.BEHAVIOR]: behavior.name,
          [ISL_ATTRIBUTES.INPUT_HASH]: this.hashObject(input),
        },
      },
      ctx,
      async (span) => {
        const startTime = Date.now();
        const preconditionResults: ConditionResult[] = [];
        const postconditionResults: ConditionResult[] = [];

        try {
          // Evaluate preconditions
          if (behavior.preconditions && this.config.enableValidationTracing) {
            const preStart = Date.now();
            for (const precondition of behavior.preconditions) {
              const result = precondition(input);
              preconditionResults.push(result);
              
              if (!result.passed) {
                span.addEvent('precondition_failed', {
                  name: result.name,
                  expression: result.expression,
                });
              }
            }
            span.setAttribute(ISL_ATTRIBUTES.PRECONDITION_COUNT, preconditionResults.length);
            span.setAttribute(
              ISL_ATTRIBUTES.PRECONDITION_PASSED,
              preconditionResults.filter(r => r.passed).length
            );
            span.setAttribute(
              ISL_ATTRIBUTES.VALIDATION_DURATION,
              Date.now() - preStart
            );
          }

          // Check if all preconditions passed
          const failedPrecondition = preconditionResults.find(r => !r.passed);
          if (failedPrecondition) {
            throw new PreconditionError(failedPrecondition);
          }

          // Get trace context for propagation
          const traceContext: TraceContext = {
            traceId: span.spanContext().traceId,
            spanId: span.spanContext().spanId,
            traceFlags: span.spanContext().traceFlags,
          };

          // Execute behavior
          const output = await behavior.execute(input, traceContext);

          // Evaluate postconditions
          if (behavior.postconditions && this.config.enableValidationTracing) {
            for (const postcondition of behavior.postconditions) {
              const result = postcondition(input, output);
              postconditionResults.push(result);

              if (!result.passed) {
                span.addEvent('postcondition_failed', {
                  name: result.name,
                  expression: result.expression,
                });
              }
            }
            span.setAttribute(ISL_ATTRIBUTES.POSTCONDITION_COUNT, postconditionResults.length);
            span.setAttribute(
              ISL_ATTRIBUTES.POSTCONDITION_PASSED,
              postconditionResults.filter(r => r.passed).length
            );
          }

          // Check postconditions
          const failedPostcondition = postconditionResults.find(r => !r.passed);
          if (failedPostcondition) {
            throw new PostconditionError(failedPostcondition);
          }

          // Set success status
          span.setAttribute(ISL_ATTRIBUTES.OUTPUT_HASH, this.hashObject(output));
          span.setStatus({ code: SpanStatusCode.OK });

          // Update metrics
          this.recordSuccess(behavior.name, Date.now() - startTime);

          return output;
        } catch (error) {
          this.handleError(span, error as Error, behavior.name);
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Create a child span for sub-operations
   */
  createChildSpan(
    name: string,
    kind: SpanKind = 'INTERNAL',
    attributes?: Record<string, unknown>
  ): { span: Span; context: Context } {
    const otelKind = this.mapSpanKind(kind);
    const span = this.tracer.startSpan(name, {
      kind: otelKind,
      attributes: attributes as Record<string, string | number | boolean>,
    });
    const ctx = trace.setSpan(context.active(), span);
    return { span, context: ctx };
  }

  /**
   * Extract trace context from incoming request
   */
  extractContext(carrier: Record<string, string>): Context {
    return propagation.extract(context.active(), carrier);
  }

  /**
   * Inject trace context into outgoing request
   */
  injectContext(carrier: Record<string, string>): void {
    propagation.inject(context.active(), carrier);
  }

  /**
   * Get current trace context
   */
  getCurrentContext(): TraceContext | null {
    const span = trace.getActiveSpan();
    if (!span) return null;

    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
    };
  }

  /**
   * Add event to current span
   */
  addEvent(name: string, attributes?: Record<string, unknown>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes as Record<string, string | number | boolean>);
    }
  }

  /**
   * Set attribute on current span
   */
  setAttribute(key: string, value: string | number | boolean): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute(key, value);
    }
  }

  /**
   * Get tracing metrics
   */
  getMetrics(): TracingMetrics {
    return { ...this.metrics };
  }

  /**
   * Shutdown tracer
   */
  async shutdown(): Promise<void> {
    await this.provider.shutdown();
  }

  // Private methods

  private createProvider(): NodeTracerProvider {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion ?? '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment ?? 'development',
    });

    const provider = new NodeTracerProvider({ resource });

    // Add exporter
    const exporter = this.createExporter();
    if (this.config.exporter.type === 'console') {
      provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    } else {
      provider.addSpanProcessor(new BatchSpanProcessor(exporter));
    }

    return provider;
  }

  private createExporter(): ConsoleSpanExporter | OTLPTraceExporter | JaegerExporter {
    switch (this.config.exporter.type) {
      case 'console':
        return new ConsoleSpanExporter();

      case 'otlp':
        return new OTLPTraceExporter({
          url: this.config.exporter.endpoint,
          headers: this.config.exporter.headers,
        });

      case 'jaeger':
        return new JaegerExporter({
          endpoint: this.config.exporter.endpoint,
        });

      default:
        return new ConsoleSpanExporter();
    }
  }

  private mapSpanKind(kind: SpanKind): OtelSpanKind {
    const mapping: Record<SpanKind, OtelSpanKind> = {
      INTERNAL: OtelSpanKind.INTERNAL,
      SERVER: OtelSpanKind.SERVER,
      CLIENT: OtelSpanKind.CLIENT,
      PRODUCER: OtelSpanKind.PRODUCER,
      CONSUMER: OtelSpanKind.CONSUMER,
    };
    return mapping[kind];
  }

  private handleError(span: Span, error: Error, behaviorName: string): void {
    const isISLError = error instanceof PreconditionError || error instanceof PostconditionError;

    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });

    span.setAttribute(ISL_ATTRIBUTES.ERROR_ISL, isISLError);
    if (isISLError) {
      span.setAttribute(ISL_ATTRIBUTES.ERROR_CODE, error.name);
    }

    span.recordException(error);
    this.recordError(behaviorName);
  }

  private hashObject(obj: unknown): string {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private initializeMetrics(): TracingMetrics {
    return {
      totalSpans: 0,
      errorSpans: 0,
      averageDuration: 0,
      p50Duration: 0,
      p95Duration: 0,
      p99Duration: 0,
      spansByBehavior: {},
      errorsByBehavior: {},
    };
  }

  private recordSuccess(behaviorName: string, duration: number): void {
    this.metrics.totalSpans++;
    this.metrics.spansByBehavior[behaviorName] = 
      (this.metrics.spansByBehavior[behaviorName] ?? 0) + 1;

    this.durations.push(duration);
    this.updateDurationMetrics();
  }

  private recordError(behaviorName: string): void {
    this.metrics.errorSpans++;
    this.metrics.errorsByBehavior[behaviorName] =
      (this.metrics.errorsByBehavior[behaviorName] ?? 0) + 1;
  }

  private updateDurationMetrics(): void {
    if (this.durations.length === 0) return;

    const sorted = [...this.durations].sort((a, b) => a - b);
    this.metrics.averageDuration = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    this.metrics.p50Duration = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    this.metrics.p95Duration = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    this.metrics.p99Duration = sorted[Math.floor(sorted.length * 0.99)] ?? 0;

    // Keep only last 10000 durations
    if (this.durations.length > 10000) {
      this.durations = this.durations.slice(-10000);
    }
  }
}

// ISL-specific errors
class PreconditionError extends Error {
  constructor(public condition: ConditionResult) {
    super(`Precondition failed: ${condition.name} - ${condition.expression}`);
    this.name = 'PreconditionError';
  }
}

class PostconditionError extends Error {
  constructor(public condition: ConditionResult) {
    super(`Postcondition failed: ${condition.name} - ${condition.expression}`);
    this.name = 'PostconditionError';
  }
}
