// ============================================================================
// ISL Sentry Tracker - Main Tracking Class
// ============================================================================

import * as Sentry from '@sentry/node';

import type {
  VerifyResult,
  BehaviorTrackingOptions,
  ISLContext,
  CheckType,
  ISLSentryOptions,
} from './types';
import {
  PreconditionError,
  PostconditionError,
  InvariantError,
  TemporalError,
  VerificationError,
} from './errors';
import {
  sanitizeInput,
  sanitizeOutput,
  sanitizeState,
  createSanitizationOptions,
  generateExecutionId,
} from './utils';
import {
  startBehaviorSpan,
  startVerificationSpan,
  startCheckSpan,
  recordVerificationToSpan,
} from './performance/spans';
import {
  addBehaviorBreadcrumb,
  addVerificationBreadcrumb,
  addPreconditionBreadcrumb,
  addPostconditionBreadcrumb,
  addInvariantBreadcrumb,
  addTemporalBreadcrumb,
} from './breadcrumbs/isl';
import {
  pushContext,
  popContext,
  createISLContext,
  withContextAsync,
} from './context/isl';

/**
 * ISL Sentry Tracker
 *
 * Main class for tracking ISL operations with Sentry.
 * Provides methods for tracking behaviors, verifications, and check failures.
 */
export class ISLSentry {
  private static options: Partial<ISLSentryOptions> = {};

  /**
   * Configure the tracker with options
   */
  static configure(options: Partial<ISLSentryOptions>): void {
    ISLSentry.options = options;
  }

  /**
   * Wrap behavior execution with Sentry tracking
   */
  static async trackBehavior<T>(
    domain: string,
    behavior: string,
    fn: () => Promise<T>,
    options?: Partial<BehaviorTrackingOptions>
  ): Promise<T> {
    return startBehaviorSpan(
      {
        domain,
        behavior,
        ...options,
      },
      fn
    );
  }

  /**
   * Track verification result
   */
  static trackVerification(result: VerifyResult): void {
    // Record to span
    recordVerificationToSpan(result);

    // Add breadcrumbs
    addVerificationBreadcrumb(result);

    // Set context
    Sentry.setContext('isl.verification', {
      domain: result.domain,
      behavior: result.behavior,
      verdict: result.verdict,
      score: result.score,
      coverage: result.coverage,
    });

    // Track failed checks
    for (const failed of result.failed) {
      Sentry.addBreadcrumb({
        category: 'isl.check.failed',
        message: failed.name,
        level: 'warning',
        data: {
          type: failed.category,
          error: failed.error,
          expression: failed.expression,
        },
      });
    }

    // If unsafe, capture as error
    if (result.verdict === 'unsafe') {
      const error = new VerificationError(
        result.domain,
        result.behavior,
        result.verdict,
        result.score,
        result.failed.map((f) => f.name)
      );

      Sentry.captureException(error, {
        level: 'error',
        tags: {
          'isl.domain': result.domain,
          'isl.behavior': result.behavior,
          'isl.verdict': result.verdict,
        },
        contexts: {
          verification: {
            score: result.score,
            failed_checks: result.failed.map((f) => f.name),
          },
        },
      });
    }
  }

  /**
   * Track precondition failure
   */
  static trackPreconditionFailure(
    domain: string,
    behavior: string,
    precondition: string,
    input?: unknown
  ): void {
    const sanitizationOpts = createSanitizationOptions(ISLSentry.options);
    const sanitizedInput = input
      ? sanitizeInput(
          input,
          sanitizationOpts.redactFields,
          sanitizationOpts.maxDepth,
          sanitizationOpts.maxStringLength
        )
      : undefined;

    // Add breadcrumb
    addPreconditionBreadcrumb(domain, behavior, precondition, false);

    // Capture exception
    Sentry.captureException(
      new PreconditionError(precondition, domain, behavior, input),
      {
        tags: {
          'isl.domain': domain,
          'isl.behavior': behavior,
          'isl.check_type': 'precondition',
        },
        contexts: {
          isl: {
            domain,
            behavior,
            checkType: 'precondition' as CheckType,
            expression: precondition,
            timestamp: Date.now(),
          } satisfies ISLContext,
          input: sanitizedInput as Record<string, unknown> | undefined,
        },
        fingerprint: [domain, behavior, 'precondition', precondition],
      }
    );
  }

  /**
   * Track postcondition failure
   */
  static trackPostconditionFailure(
    domain: string,
    behavior: string,
    postcondition: string,
    input?: unknown,
    output?: unknown
  ): void {
    const sanitizationOpts = createSanitizationOptions(ISLSentry.options);

    const sanitizedInput = input
      ? sanitizeInput(
          input,
          sanitizationOpts.redactFields,
          sanitizationOpts.maxDepth,
          sanitizationOpts.maxStringLength
        )
      : undefined;

    const sanitizedOutput = output
      ? sanitizeOutput(
          output,
          sanitizationOpts.redactFields,
          sanitizationOpts.maxDepth,
          sanitizationOpts.maxStringLength
        )
      : undefined;

    // Add breadcrumb
    addPostconditionBreadcrumb(domain, behavior, postcondition, false);

    // Capture exception
    Sentry.captureException(
      new PostconditionError(postcondition, domain, behavior, input, output),
      {
        level: 'error',
        tags: {
          'isl.domain': domain,
          'isl.behavior': behavior,
          'isl.check_type': 'postcondition',
        },
        contexts: {
          isl: {
            domain,
            behavior,
            checkType: 'postcondition' as CheckType,
            expression: postcondition,
            timestamp: Date.now(),
          } satisfies ISLContext,
          input: sanitizedInput as Record<string, unknown> | undefined,
          output: sanitizedOutput as Record<string, unknown> | undefined,
        },
        fingerprint: [domain, behavior, 'postcondition', postcondition],
      }
    );
  }

  /**
   * Track invariant violation
   */
  static trackInvariantViolation(
    domain: string,
    invariant: string,
    state?: unknown
  ): void {
    const sanitizationOpts = createSanitizationOptions(ISLSentry.options);
    const sanitizedState = state
      ? sanitizeState(
          state,
          sanitizationOpts.redactFields,
          sanitizationOpts.maxDepth,
          sanitizationOpts.maxStringLength
        )
      : undefined;

    // Add breadcrumb
    addInvariantBreadcrumb(domain, invariant, false);

    // Capture exception
    Sentry.captureException(
      new InvariantError(invariant, domain, state),
      {
        level: 'fatal',
        tags: {
          'isl.domain': domain,
          'isl.check_type': 'invariant',
        },
        contexts: {
          isl: {
            domain,
            checkType: 'invariant' as CheckType,
            expression: invariant,
            timestamp: Date.now(),
          } satisfies ISLContext,
          state: sanitizedState as Record<string, unknown> | undefined,
        },
        fingerprint: [domain, 'invariant', invariant],
      }
    );
  }

  /**
   * Track temporal property violation
   */
  static trackTemporalViolation(
    domain: string,
    behavior: string | undefined,
    property: string,
    expression: string,
    timeline?: unknown[]
  ): void {
    // Add breadcrumb
    addTemporalBreadcrumb(domain, behavior, property, expression, false);

    // Capture exception
    Sentry.captureException(
      new TemporalError(expression, property, domain, behavior, timeline),
      {
        level: 'error',
        tags: {
          'isl.domain': domain,
          'isl.check_type': 'temporal',
          'isl.temporal_property': property,
          ...(behavior && { 'isl.behavior': behavior }),
        },
        contexts: {
          isl: {
            domain,
            behavior,
            checkType: 'temporal' as CheckType,
            expression,
            timestamp: Date.now(),
            metadata: { property },
          } satisfies ISLContext,
        },
        fingerprint: [domain, behavior || '', 'temporal', property],
      }
    );
  }

  /**
   * Track a successful check
   */
  static trackCheckSuccess(
    domain: string,
    behavior: string,
    checkType: CheckType,
    expression: string,
    duration?: number
  ): void {
    const breadcrumbFn = {
      precondition: addPreconditionBreadcrumb,
      postcondition: addPostconditionBreadcrumb,
      invariant: (d: string, e: string, p: boolean) =>
        addInvariantBreadcrumb(d, e, p),
      temporal: (d: string, _b: string, e: string, p: boolean) =>
        addTemporalBreadcrumb(d, undefined, 'property', e, p),
    };

    if (checkType === 'invariant') {
      addInvariantBreadcrumb(domain, expression, true);
    } else if (checkType === 'temporal') {
      addTemporalBreadcrumb(domain, behavior, 'property', expression, true);
    } else {
      const fn = breadcrumbFn[checkType] as (
        d: string,
        b: string,
        e: string,
        p: boolean
      ) => void;
      fn(domain, behavior, expression, true);
    }
  }

  /**
   * Wrap a verification function with tracking
   */
  static wrapVerification<T>(
    domain: string,
    behavior: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return startVerificationSpan(domain, behavior, fn);
  }

  /**
   * Wrap a check function with tracking
   */
  static wrapCheck<T>(
    domain: string,
    behavior: string,
    checkType: CheckType,
    expression: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return startCheckSpan(domain, behavior, checkType, expression, fn);
  }

  /**
   * Create a tracked behavior executor
   */
  static createBehaviorExecutor<TInput, TOutput>(
    domain: string,
    behavior: string,
    executor: (input: TInput) => Promise<TOutput>
  ): (input: TInput) => Promise<TOutput> {
    return async (input: TInput): Promise<TOutput> => {
      return ISLSentry.trackBehavior(domain, behavior, () => executor(input));
    };
  }

  /**
   * Run within ISL context
   */
  static async withContext<T>(
    domain: string,
    behavior: string | undefined,
    fn: () => Promise<T>
  ): Promise<T> {
    const context = createISLContext(domain, behavior);
    return withContextAsync(context, fn);
  }

  /**
   * Set user context for ISL tracking
   */
  static setUserContext(
    userId: string,
    email?: string,
    metadata?: Record<string, unknown>
  ): void {
    Sentry.setUser({
      id: userId,
      email,
      ...metadata,
    });
  }

  /**
   * Add custom tag
   */
  static addTag(key: string, value: string): void {
    Sentry.setTag(key, value);
  }

  /**
   * Add custom context
   */
  static addContext(name: string, context: Record<string, unknown>): void {
    Sentry.setContext(name, context);
  }

  /**
   * Capture a custom message
   */
  static captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info'
  ): void {
    Sentry.captureMessage(message, level);
  }

  /**
   * Capture a custom exception
   */
  static captureException(
    error: Error,
    context?: Record<string, unknown>
  ): void {
    Sentry.captureException(error, {
      contexts: context ? { custom: context } : undefined,
    });
  }

  /**
   * Flush pending events
   */
  static async flush(timeout?: number): Promise<boolean> {
    return Sentry.flush(timeout);
  }
}
