/**
 * ISL Tracing
 * 
 * Distributed tracing integration for ISL verification.
 */

import type { Violation, ExecutionContext } from '../types.js';

export interface TracerOptions {
  /** Tracing provider */
  provider: 'opentelemetry' | 'jaeger' | 'custom';
  /** Service name */
  serviceName?: string;
  /** Custom tracer implementation */
  customTracer?: Tracer;
  /** Enable debug logging */
  debug?: boolean;
}

export interface Tracer {
  startSpan(name: string, context?: SpanContext): Span;
}

export interface Span {
  setStatus(status: 'ok' | 'error'): void;
  setAttribute(key: string, value: string | number | boolean): void;
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void;
  end(): void;
}

export interface SpanContext {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
}

/**
 * ISL Tracer for distributed tracing
 * 
 * @example
 * ```typescript
 * const tracer = new ISLTracer({
 *   provider: 'opentelemetry',
 *   serviceName: 'user-service',
 * });
 * 
 * const span = tracer.startVerificationSpan('CreateUser', context);
 * // ... verification ...
 * span.end();
 * ```
 */
export class ISLTracer {
  private tracer: Tracer;
  private options: TracerOptions;

  constructor(options: TracerOptions) {
    this.options = options;
    this.tracer = options.customTracer ?? createNoopTracer();
  }

  /**
   * Start a verification span
   */
  startVerificationSpan(
    behavior: string,
    ctx: ExecutionContext
  ): VerificationSpan {
    const span = this.tracer.startSpan(`isl.verify.${behavior}`, {
      traceId: ctx.traceId,
      spanId: ctx.spanId,
    });

    span.setAttribute('isl.behavior', behavior);
    span.setAttribute('isl.request_id', ctx.requestId ?? 'unknown');
    
    if (ctx.userId) {
      span.setAttribute('isl.user_id', ctx.userId);
    }

    return new VerificationSpan(span, behavior, this.options.debug ?? false);
  }

  /**
   * Record a violation in a span
   */
  recordViolation(span: VerificationSpan, violation: Violation): void {
    span.addViolation(violation);
  }
}

/**
 * Verification span wrapper
 */
export class VerificationSpan {
  private span: Span;
  private behavior: string;
  private debug: boolean;
  private preconditionCount = 0;
  private postconditionCount = 0;
  private violations: Violation[] = [];

  constructor(span: Span, behavior: string, debug: boolean) {
    this.span = span;
    this.behavior = behavior;
    this.debug = debug;
  }

  /**
   * Record precondition check
   */
  recordPrecondition(passed: boolean, condition?: string): void {
    this.preconditionCount++;
    this.span.addEvent('isl.precondition', {
      passed,
      condition: condition ?? `precondition[${this.preconditionCount}]`,
    });
  }

  /**
   * Record postcondition check
   */
  recordPostcondition(passed: boolean, condition?: string): void {
    this.postconditionCount++;
    this.span.addEvent('isl.postcondition', {
      passed,
      condition: condition ?? `postcondition[${this.postconditionCount}]`,
    });
  }

  /**
   * Add a violation
   */
  addViolation(violation: Violation): void {
    this.violations.push(violation);
    this.span.addEvent('isl.violation', {
      type: violation.type,
      condition: violation.condition,
      message: violation.message,
    });
  }

  /**
   * End the span
   */
  end(success: boolean = this.violations.length === 0): void {
    this.span.setAttribute('isl.preconditions_checked', this.preconditionCount);
    this.span.setAttribute('isl.postconditions_checked', this.postconditionCount);
    this.span.setAttribute('isl.violations_count', this.violations.length);
    this.span.setStatus(success ? 'ok' : 'error');
    this.span.end();

    if (this.debug) {
      console.log(`[ISL Tracer] Span ended: ${this.behavior}`, {
        preconditions: this.preconditionCount,
        postconditions: this.postconditionCount,
        violations: this.violations.length,
      });
    }
  }
}

/**
 * Create a no-op tracer for when tracing is disabled
 */
function createNoopTracer(): Tracer {
  const noopSpan: Span = {
    setStatus: () => {},
    setAttribute: () => {},
    addEvent: () => {},
    end: () => {},
  };

  return {
    startSpan: () => noopSpan,
  };
}

/**
 * Create an OpenTelemetry tracer wrapper
 * (actual implementation would import @opentelemetry/api)
 */
export function createOpenTelemetryTracer(serviceName: string): Tracer {
  // This is a placeholder - real implementation would use @opentelemetry/api
  return createNoopTracer();
}
