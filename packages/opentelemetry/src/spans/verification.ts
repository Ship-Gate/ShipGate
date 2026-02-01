import {
  trace,
  Span,
  SpanKind,
  SpanStatusCode,
  Attributes,
  context,
  Context,
} from '@opentelemetry/api';
import {
  ISLSemanticAttributes,
  VerificationVerdict,
  VerificationType,
  CheckType,
} from '../semantic-attributes';

/**
 * Configuration for verification span
 */
export interface VerificationSpanConfig {
  domain: string;
  behavior: string;
  verificationId?: string;
  verificationType?: VerificationType;
  strict?: boolean;
  attributes?: Attributes;
}

/**
 * Check result for verification
 */
export interface CheckResult {
  type: CheckType;
  name: string;
  expression: string;
  passed: boolean;
  message?: string;
  duration?: number;
}

/**
 * Coverage metrics
 */
export interface CoverageMetrics {
  preconditions: { total: number; covered: number };
  postconditions: { total: number; covered: number };
  invariants: { total: number; covered: number };
}

/**
 * Verification result
 */
export interface VerificationResult {
  verdict: VerificationVerdict;
  score?: number;
  checks: CheckResult[];
  coverage?: CoverageMetrics;
  duration: number;
}

/**
 * Creates a verification span for tracing ISL verification execution
 */
export class VerificationSpan {
  private span: Span;
  private startTime: number;
  private config: VerificationSpanConfig;
  private checks: CheckResult[] = [];
  private coverage?: CoverageMetrics;

  constructor(config: VerificationSpanConfig, parentContext?: Context) {
    this.config = config;
    this.startTime = Date.now();

    const tracer = trace.getTracer('isl-verification', '1.0.0');

    this.span = tracer.startSpan(
      `isl.verification.${config.domain}.${config.behavior}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [ISLSemanticAttributes.ISL_DOMAIN_NAME]: config.domain,
          [ISLSemanticAttributes.ISL_BEHAVIOR_NAME]: config.behavior,
          ...(config.verificationId && {
            [ISLSemanticAttributes.ISL_VERIFICATION_ID]: config.verificationId,
          }),
          ...(config.verificationType && {
            [ISLSemanticAttributes.ISL_VERIFICATION_TYPE]: config.verificationType,
          }),
          ...(config.strict !== undefined && {
            [ISLSemanticAttributes.ISL_VERIFICATION_STRICT]: config.strict,
          }),
          ...config.attributes,
        },
      },
      parentContext
    );
  }

  /**
   * Get the underlying span
   */
  getSpan(): Span {
    return this.span;
  }

  /**
   * Record a check result
   */
  recordCheck(result: CheckResult): void {
    this.checks.push(result);

    this.span.addEvent(`check.${result.type}`, {
      [ISLSemanticAttributes.ISL_CHECK_TYPE]: result.type,
      [ISLSemanticAttributes.ISL_CHECK_NAME]: result.name,
      [ISLSemanticAttributes.ISL_CHECK_EXPRESSION]: result.expression,
      [ISLSemanticAttributes.ISL_CHECK_PASSED]: result.passed,
      ...(result.message && {
        [ISLSemanticAttributes.ISL_CHECK_MESSAGE]: result.message,
      }),
      ...(result.duration !== undefined && {
        'isl.duration_ms': result.duration,
      }),
    });
  }

  /**
   * Run a check and record the result
   */
  runCheck(
    type: CheckType,
    name: string,
    expression: string,
    fn: () => boolean
  ): boolean {
    const checkStart = Date.now();
    let passed = false;
    let message: string | undefined;

    try {
      passed = fn();
    } catch (error) {
      passed = false;
      message = (error as Error).message;
    }

    const duration = Date.now() - checkStart;

    this.recordCheck({
      type,
      name,
      expression,
      passed,
      message,
      duration,
    });

    return passed;
  }

  /**
   * Run an async check and record the result
   */
  async runCheckAsync(
    type: CheckType,
    name: string,
    expression: string,
    fn: () => Promise<boolean>
  ): Promise<boolean> {
    const checkStart = Date.now();
    let passed = false;
    let message: string | undefined;

    try {
      passed = await fn();
    } catch (error) {
      passed = false;
      message = (error as Error).message;
    }

    const duration = Date.now() - checkStart;

    this.recordCheck({
      type,
      name,
      expression,
      passed,
      message,
      duration,
    });

    return passed;
  }

  /**
   * Set coverage metrics
   */
  setCoverage(coverage: CoverageMetrics): void {
    this.coverage = coverage;

    this.span.setAttribute(
      ISLSemanticAttributes.ISL_COVERAGE_PRECONDITIONS,
      `${coverage.preconditions.covered}/${coverage.preconditions.total}`
    );
    this.span.setAttribute(
      ISLSemanticAttributes.ISL_COVERAGE_POSTCONDITIONS,
      `${coverage.postconditions.covered}/${coverage.postconditions.total}`
    );
    this.span.setAttribute(
      ISLSemanticAttributes.ISL_COVERAGE_INVARIANTS,
      `${coverage.invariants.covered}/${coverage.invariants.total}`
    );

    const totalCovered =
      coverage.preconditions.covered +
      coverage.postconditions.covered +
      coverage.invariants.covered;
    const totalCount =
      coverage.preconditions.total +
      coverage.postconditions.total +
      coverage.invariants.total;

    if (totalCount > 0) {
      this.span.setAttribute(
        ISLSemanticAttributes.ISL_COVERAGE_TOTAL,
        Math.round((totalCovered / totalCount) * 100)
      );
    }
  }

  /**
   * Calculate the verification verdict
   */
  private calculateVerdict(): VerificationVerdict {
    if (this.checks.length === 0) {
      return 'skip';
    }

    const failed = this.checks.filter((c) => !c.passed);

    if (failed.length === 0) {
      return 'pass';
    }

    return 'fail';
  }

  /**
   * Calculate the trust score (0-100)
   */
  private calculateScore(): number {
    if (this.checks.length === 0) {
      return 0;
    }

    const passed = this.checks.filter((c) => c.passed).length;
    return Math.round((passed / this.checks.length) * 100);
  }

  /**
   * Complete the verification with a specific verdict
   */
  complete(verdict?: VerificationVerdict, score?: number): VerificationResult {
    const duration = Date.now() - this.startTime;
    const finalVerdict = verdict ?? this.calculateVerdict();
    const finalScore = score ?? this.calculateScore();

    // Set verification results
    this.span.setAttribute(ISLSemanticAttributes.ISL_VERIFICATION_VERDICT, finalVerdict);
    this.span.setAttribute(ISLSemanticAttributes.ISL_VERIFICATION_SCORE, finalScore);
    this.span.setAttribute(
      ISLSemanticAttributes.ISL_VERIFICATION_CHECK_COUNT,
      this.checks.length
    );
    this.span.setAttribute(
      ISLSemanticAttributes.ISL_VERIFICATION_PASSED_COUNT,
      this.checks.filter((c) => c.passed).length
    );
    this.span.setAttribute(
      ISLSemanticAttributes.ISL_VERIFICATION_FAILED_COUNT,
      this.checks.filter((c) => !c.passed).length
    );

    this.span.setAttribute('isl.duration_ms', duration);

    this.span.setStatus({
      code: finalVerdict === 'pass' ? SpanStatusCode.OK : SpanStatusCode.ERROR,
      message: finalVerdict !== 'pass' ? `Verification ${finalVerdict}` : undefined,
    });

    this.span.end();

    return {
      verdict: finalVerdict,
      score: finalScore,
      checks: this.checks,
      coverage: this.coverage,
      duration,
    };
  }

  /**
   * Mark verification as error
   */
  error(err: Error): VerificationResult {
    const duration = Date.now() - this.startTime;

    this.span.setAttribute(ISLSemanticAttributes.ISL_VERIFICATION_VERDICT, 'error');
    this.span.setAttribute('isl.duration_ms', duration);
    this.span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err.message,
    });
    this.span.recordException(err);
    this.span.end();

    return {
      verdict: 'error',
      score: 0,
      checks: this.checks,
      coverage: this.coverage,
      duration,
    };
  }
}

/**
 * Execute a function within a verification span context
 */
export async function withVerificationSpan<T>(
  config: VerificationSpanConfig,
  fn: (span: VerificationSpan) => Promise<T>
): Promise<T> {
  const span = new VerificationSpan(config);

  try {
    const result = await context.with(
      trace.setSpan(context.active(), span.getSpan()),
      () => fn(span)
    );
    span.complete();
    return result;
  } catch (error) {
    span.error(error as Error);
    throw error;
  }
}

/**
 * Decorator for tracing verification methods
 */
export function TraceVerification(domain: string, behavior?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const behaviorName = behavior ?? propertyKey;

    descriptor.value = async function (...args: unknown[]) {
      const span = new VerificationSpan({
        domain,
        behavior: behaviorName,
      });

      try {
        const result = await context.with(
          trace.setSpan(context.active(), span.getSpan()),
          () => originalMethod.apply(this, args)
        );
        span.complete();
        return result;
      } catch (error) {
        span.error(error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Create a verification span builder
 */
export function createVerificationSpan(
  domain: string,
  behavior: string
): VerificationSpanBuilder {
  return new VerificationSpanBuilder(domain, behavior);
}

/**
 * Builder pattern for verification spans
 */
export class VerificationSpanBuilder {
  private config: VerificationSpanConfig;

  constructor(domain: string, behavior: string) {
    this.config = { domain, behavior };
  }

  verificationId(id: string): this {
    this.config.verificationId = id;
    return this;
  }

  verificationType(type: VerificationType): this {
    this.config.verificationType = type;
    return this;
  }

  strict(enabled: boolean = true): this {
    this.config.strict = enabled;
    return this;
  }

  attribute(key: string, value: string | number | boolean): this {
    this.config.attributes = {
      ...this.config.attributes,
      [key]: value,
    };
    return this;
  }

  build(parentContext?: Context): VerificationSpan {
    return new VerificationSpan(this.config, parentContext);
  }

  async execute<T>(fn: (span: VerificationSpan) => Promise<T>): Promise<T> {
    return withVerificationSpan(this.config, fn);
  }
}
