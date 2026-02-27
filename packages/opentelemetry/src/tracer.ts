import {
  trace,
  context,
  SpanStatusCode,
  SpanKind,
  Span,
  Tracer,
  Attributes,
  Context,
} from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { ISLSemanticAttributes } from './semantic-attributes.js';

/**
 * Configuration for ISL Tracer
 */
export interface ISLTracerConfig {
  serviceName: string;
  serviceVersion?: string;
  domainName?: string;
  domainVersion?: string;
  attributes?: Attributes;
}

/**
 * Verification result structure
 */
export interface VerificationResult {
  verdict: 'pass' | 'fail' | 'error' | 'skip';
  score?: number;
  verificationId?: string;
  checks?: CheckResult[];
  coverage?: CoverageResult;
}

/**
 * Check result structure
 */
export interface CheckResult {
  type: 'precondition' | 'postcondition' | 'invariant';
  name: string;
  passed: boolean;
  expression?: string;
  message?: string;
  duration?: number;
}

/**
 * Coverage result structure
 */
export interface CoverageResult {
  preconditions: { total: number; covered: number };
  postconditions: { total: number; covered: number };
  invariants: { total: number; covered: number };
}

/**
 * ISL-aware OpenTelemetry tracer
 * Provides specialized tracing for ISL verification workflows
 */
export class ISLTracer {
  private tracer: Tracer;
  private provider: NodeTracerProvider;
  private readonly _config: ISLTracerConfig;

  constructor(config: ISLTracerConfig) {
    this._config = config;

    // Create resource with ISL attributes
    const resource = new Resource({
      [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion ?? '1.0.0',
      [ISLSemanticAttributes.ISL_DOMAIN_NAME]: config.domainName ?? 'unknown',
      [ISLSemanticAttributes.ISL_DOMAIN_VERSION]: config.domainVersion ?? '1.0.0',
      ...config.attributes,
    });

    // Initialize provider
    this.provider = new NodeTracerProvider({ resource });

    // Use async hooks for context propagation
    const contextManager = new AsyncLocalStorageContextManager();
    contextManager.enable();
    context.setGlobalContextManager(contextManager);

    // Get tracer
    this.tracer = trace.getTracer('isl-verification', '1.0.0');
  }

  /**
   * Get the underlying tracer provider for adding exporters
   */
  getProvider(): NodeTracerProvider {
    return this.provider;
  }

  /**
   * Get the underlying tracer
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * Register the provider globally
   */
  register(): void {
    this.provider.register();
  }

  /**
   * Shutdown the tracer provider
   */
  async shutdown(): Promise<void> {
    await this.provider.shutdown();
  }

  /**
   * Trace a behavior execution
   */
  async traceBehavior<T>(
    domain: string,
    behavior: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Attributes
  ): Promise<T> {
    return this.tracer.startActiveSpan(
      `isl.behavior.${domain}.${behavior}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [ISLSemanticAttributes.ISL_DOMAIN_NAME]: domain,
          [ISLSemanticAttributes.ISL_BEHAVIOR_NAME]: behavior,
          ...attributes,
        },
      },
      async (span) => {
        const startTime = Date.now();
        try {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          const err = error as Error;
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err.message,
          });
          span.recordException(err);
          throw error;
        } finally {
          span.setAttribute('isl.duration_ms', Date.now() - startTime);
          span.end();
        }
      }
    );
  }

  /**
   * Trace verification execution with detailed result handling
   */
  async traceVerification<T extends VerificationResult>(
    domain: string,
    behavior: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Attributes
  ): Promise<T> {
    return this.tracer.startActiveSpan(
      `isl.verification.${domain}.${behavior}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [ISLSemanticAttributes.ISL_DOMAIN_NAME]: domain,
          [ISLSemanticAttributes.ISL_BEHAVIOR_NAME]: behavior,
          ...attributes,
        },
      },
      async (span) => {
        const startTime = Date.now();
        try {
          const result = await fn(span);

          // Record verification outcome
          span.setAttribute(ISLSemanticAttributes.ISL_VERIFICATION_VERDICT, result.verdict);

          if (result.score !== undefined) {
            span.setAttribute(ISLSemanticAttributes.ISL_VERIFICATION_SCORE, result.score);
          }

          if (result.verificationId) {
            span.setAttribute(ISLSemanticAttributes.ISL_VERIFICATION_ID, result.verificationId);
          }

          // Record coverage if available
          if (result.coverage) {
            span.setAttribute(
              ISLSemanticAttributes.ISL_COVERAGE_PRECONDITIONS,
              `${result.coverage.preconditions.covered}/${result.coverage.preconditions.total}`
            );
            span.setAttribute(
              ISLSemanticAttributes.ISL_COVERAGE_POSTCONDITIONS,
              `${result.coverage.postconditions.covered}/${result.coverage.postconditions.total}`
            );
            span.setAttribute(
              ISLSemanticAttributes.ISL_COVERAGE_INVARIANTS,
              `${result.coverage.invariants.covered}/${result.coverage.invariants.total}`
            );
          }

          span.setStatus({
            code: result.verdict === 'pass' ? SpanStatusCode.OK : SpanStatusCode.ERROR,
          });

          return result;
        } catch (error) {
          const err = error as Error;
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          span.recordException(err);
          throw error;
        } finally {
          span.setAttribute('isl.duration_ms', Date.now() - startTime);
          span.end();
        }
      }
    );
  }

  /**
   * Trace a precondition/postcondition/invariant check
   */
  traceCheck(
    type: 'precondition' | 'postcondition' | 'invariant',
    name: string,
    expression: string,
    fn: () => boolean
  ): boolean {
    const span = this.tracer.startSpan(`isl.check.${type}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        [ISLSemanticAttributes.ISL_CHECK_TYPE]: type,
        [ISLSemanticAttributes.ISL_CHECK_NAME]: name,
        [ISLSemanticAttributes.ISL_CHECK_EXPRESSION]: expression,
      },
    });

    const startTime = Date.now();
    try {
      const passed = fn();
      span.setAttribute(ISLSemanticAttributes.ISL_CHECK_PASSED, passed);
      span.setStatus({
        code: passed ? SpanStatusCode.OK : SpanStatusCode.ERROR,
        message: passed ? undefined : `Check failed: ${name}`,
      });
      return passed;
    } catch (error) {
      const err = error as Error;
      span.setAttribute(ISLSemanticAttributes.ISL_CHECK_PASSED, false);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.recordException(err);
      throw error;
    } finally {
      span.setAttribute('isl.duration_ms', Date.now() - startTime);
      span.end();
    }
  }

  /**
   * Trace async check
   */
  async traceCheckAsync(
    type: 'precondition' | 'postcondition' | 'invariant',
    name: string,
    expression: string,
    fn: () => Promise<boolean>
  ): Promise<boolean> {
    return this.tracer.startActiveSpan(
      `isl.check.${type}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [ISLSemanticAttributes.ISL_CHECK_TYPE]: type,
          [ISLSemanticAttributes.ISL_CHECK_NAME]: name,
          [ISLSemanticAttributes.ISL_CHECK_EXPRESSION]: expression,
        },
      },
      async (span) => {
        const startTime = Date.now();
        try {
          const passed = await fn();
          span.setAttribute(ISLSemanticAttributes.ISL_CHECK_PASSED, passed);
          span.setStatus({
            code: passed ? SpanStatusCode.OK : SpanStatusCode.ERROR,
          });
          return passed;
        } catch (error) {
          const err = error as Error;
          span.setAttribute(ISLSemanticAttributes.ISL_CHECK_PASSED, false);
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          span.recordException(err);
          throw error;
        } finally {
          span.setAttribute('isl.duration_ms', Date.now() - startTime);
          span.end();
        }
      }
    );
  }

  /**
   * Trace chaos injection
   */
  async traceChaos<T>(
    injectionType: string,
    target: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Attributes
  ): Promise<T> {
    return this.tracer.startActiveSpan(
      `isl.chaos.${injectionType}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [ISLSemanticAttributes.ISL_CHAOS_INJECTION_TYPE]: injectionType,
          [ISLSemanticAttributes.ISL_CHAOS_TARGET]: target,
          ...attributes,
        },
      },
      async (span) => {
        const startTime = Date.now();
        try {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          const err = error as Error;
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          span.recordException(err);
          throw error;
        } finally {
          span.setAttribute('isl.duration_ms', Date.now() - startTime);
          span.end();
        }
      }
    );
  }

  /**
   * Create a child span for nested operations
   */
  startSpan(
    name: string,
    attributes?: Attributes,
    ctx?: Context
  ): Span {
    return this.tracer.startSpan(
      name,
      { attributes, kind: SpanKind.INTERNAL },
      ctx
    );
  }

  /**
   * Run a function within a span context
   */
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Attributes
  ): Promise<T> {
    return this.tracer.startActiveSpan(
      name,
      { attributes, kind: SpanKind.INTERNAL },
      async (span) => {
        try {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          const err = error as Error;
          span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
          span.recordException(err);
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Add event to current span
   */
  addEvent(name: string, attributes?: Attributes): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
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
   * Get the tracer configuration
   */
  getConfig(): ISLTracerConfig {
    return this._config;
  }
}

/**
 * Create an ISL tracer with default configuration
 */
export function createISLTracer(config: ISLTracerConfig): ISLTracer {
  return new ISLTracer(config);
}
