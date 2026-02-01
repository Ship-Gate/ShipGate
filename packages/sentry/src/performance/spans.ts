// ============================================================================
// ISL Performance Spans
// ============================================================================

import * as Sentry from '@sentry/node';
import type { Span, SpanStatusType } from '@sentry/types';

import type {
  BehaviorTrackingOptions,
  ISLSpanData,
  CheckType,
  VerifyResult,
} from '../types';
import { generateExecutionId, formatDuration } from '../utils';

/**
 * Operation types for ISL spans
 */
export const ISL_OPERATIONS = {
  BEHAVIOR: 'isl.behavior',
  VERIFICATION: 'isl.verification',
  PRECONDITION: 'isl.check.precondition',
  POSTCONDITION: 'isl.check.postcondition',
  INVARIANT: 'isl.check.invariant',
  TEMPORAL: 'isl.check.temporal',
  DOMAIN: 'isl.domain',
} as const;

export type ISLOperation = typeof ISL_OPERATIONS[keyof typeof ISL_OPERATIONS];

/**
 * Span status codes
 */
const SPAN_STATUS = {
  OK: { code: 1 as const },
  ERROR: { code: 2 as const },
  CANCELLED: { code: 3 as const },
} as const;

/**
 * Start a behavior execution span
 */
export function startBehaviorSpan<T>(
  options: BehaviorTrackingOptions,
  fn: () => Promise<T>
): Promise<T> {
  const executionId = options.executionId ?? generateExecutionId();

  return Sentry.startSpan(
    {
      name: `${options.domain}.${options.behavior}`,
      op: ISL_OPERATIONS.BEHAVIOR,
      attributes: {
        'isl.domain': options.domain,
        'isl.behavior': options.behavior,
        'isl.execution_id': executionId,
        ...options.attributes,
      },
    },
    async (span) => {
      // Set context
      Sentry.setContext('isl', {
        domain: options.domain,
        behavior: options.behavior,
        executionId,
        timestamp: Date.now(),
      });

      // Add start breadcrumb
      Sentry.addBreadcrumb({
        category: 'isl.behavior',
        message: `Executing ${options.domain}.${options.behavior}`,
        level: 'info',
        data: {
          domain: options.domain,
          behavior: options.behavior,
          executionId,
        },
      });

      try {
        const result = await fn();
        span.setStatus(SPAN_STATUS.OK);

        // Add completion breadcrumb
        Sentry.addBreadcrumb({
          category: 'isl.behavior',
          message: `Completed ${options.domain}.${options.behavior}`,
          level: 'info',
          data: {
            domain: options.domain,
            behavior: options.behavior,
            executionId,
            success: true,
          },
        });

        return result;
      } catch (error) {
        span.setStatus({
          code: 2,
          message: error instanceof Error ? error.message : 'Unknown error',
        });

        // Add error breadcrumb
        Sentry.addBreadcrumb({
          category: 'isl.behavior',
          message: `Failed ${options.domain}.${options.behavior}`,
          level: 'error',
          data: {
            domain: options.domain,
            behavior: options.behavior,
            executionId,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        throw error;
      }
    }
  );
}

/**
 * Start a verification span
 */
export function startVerificationSpan<T>(
  domain: string,
  behavior: string,
  fn: () => Promise<T>
): Promise<T> {
  const executionId = generateExecutionId();

  return Sentry.startSpan(
    {
      name: `verify:${domain}.${behavior}`,
      op: ISL_OPERATIONS.VERIFICATION,
      attributes: {
        'isl.domain': domain,
        'isl.behavior': behavior,
        'isl.execution_id': executionId,
      },
    },
    async (span) => {
      Sentry.setContext('isl.verification', {
        domain,
        behavior,
        executionId,
        startTime: Date.now(),
      });

      try {
        const result = await fn();
        span.setStatus(SPAN_STATUS.OK);
        return result;
      } catch (error) {
        span.setStatus({
          code: 2,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    }
  );
}

/**
 * Start a check span
 */
export function startCheckSpan<T>(
  domain: string,
  behavior: string,
  checkType: CheckType,
  expression: string,
  fn: () => Promise<T>
): Promise<T> {
  const opMap: Record<CheckType, ISLOperation> = {
    precondition: ISL_OPERATIONS.PRECONDITION,
    postcondition: ISL_OPERATIONS.POSTCONDITION,
    invariant: ISL_OPERATIONS.INVARIANT,
    temporal: ISL_OPERATIONS.TEMPORAL,
  };

  return Sentry.startSpan(
    {
      name: `${checkType}:${expression.substring(0, 50)}`,
      op: opMap[checkType],
      attributes: {
        'isl.domain': domain,
        'isl.behavior': behavior,
        'isl.check_type': checkType,
        'isl.expression': expression,
      },
    },
    async (span) => {
      try {
        const result = await fn();
        span.setStatus(SPAN_STATUS.OK);
        span.setAttribute('isl.check_result', 'pass');
        return result;
      } catch (error) {
        span.setStatus({
          code: 2,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        span.setAttribute('isl.check_result', 'fail');
        throw error;
      }
    }
  );
}

/**
 * Record verification result to span
 */
export function recordVerificationToSpan(result: VerifyResult): void {
  Sentry.startSpan(
    {
      name: `verify:${result.domain}.${result.behavior}`,
      op: ISL_OPERATIONS.VERIFICATION,
      attributes: {
        'isl.domain': result.domain,
        'isl.behavior': result.behavior,
        'isl.verdict': result.verdict,
        'isl.score': result.score,
        'isl.coverage': result.coverage.total,
        'isl.failed_count': result.failed.length,
        'isl.passed_count': result.passed.length,
      },
    },
    (span) => {
      // Set status based on verdict
      if (result.verdict === 'unsafe') {
        span.setStatus({ code: 2, message: 'Verification failed' });
      } else if (result.verdict === 'risky') {
        span.setStatus({ code: 1 }); // OK but with warnings
        span.setAttribute('isl.has_warnings', true);
      } else {
        span.setStatus(SPAN_STATUS.OK);
      }

      // Add failed checks as span events
      for (const failed of result.failed) {
        span.addEvent('check_failed', {
          'isl.check_name': failed.name,
          'isl.check_category': failed.category,
          'isl.check_expression': failed.expression,
          'isl.check_error': failed.error,
        });
      }

      // Set verification context
      Sentry.setContext('isl.verification', {
        domain: result.domain,
        behavior: result.behavior,
        verdict: result.verdict,
        score: result.score,
        coverage: result.coverage,
        failed_checks: result.failed.map((f) => f.name),
      });
    }
  );
}

/**
 * Create a custom ISL span
 */
export function createISLSpan(data: ISLSpanData): void {
  Sentry.startSpan(
    {
      name: data.name,
      op: data.op,
      attributes: data.attributes,
      startTime: data.startTime,
    },
    (span) => {
      span.setStatus(SPAN_STATUS.OK);
    }
  );
}

/**
 * Wrap a function with behavior tracking
 */
export function withBehaviorTracking<TArgs extends unknown[], TReturn>(
  domain: string,
  behavior: string,
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    return startBehaviorSpan(
      { domain, behavior },
      () => fn(...args)
    );
  };
}

/**
 * Wrap a function with verification tracking
 */
export function withVerificationTracking<TArgs extends unknown[], TReturn>(
  domain: string,
  behavior: string,
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    return startVerificationSpan(
      domain,
      behavior,
      () => fn(...args)
    );
  };
}

/**
 * Create a span for timing measurements
 */
export function measureTiming(
  name: string,
  domain: string,
  behavior?: string
): {
  end: (success?: boolean, error?: string) => void;
} {
  const startTime = Date.now();

  return {
    end: (success = true, error?: string) => {
      const duration = Date.now() - startTime;

      Sentry.startSpan(
        {
          name,
          op: ISL_OPERATIONS.BEHAVIOR,
          startTime: startTime / 1000,
          attributes: {
            'isl.domain': domain,
            ...(behavior && { 'isl.behavior': behavior }),
            'isl.duration_ms': duration,
            'isl.duration_human': formatDuration(duration),
          },
        },
        (span) => {
          if (success) {
            span.setStatus(SPAN_STATUS.OK);
          } else {
            span.setStatus({
              code: 2,
              message: error ?? 'Unknown error',
            });
          }
        }
      );
    },
  };
}

/**
 * Add timing measurement to current transaction
 */
export function addTimingMeasurement(
  name: string,
  value: number,
  unit: 'millisecond' | 'second' | 'nanosecond' = 'millisecond'
): void {
  Sentry.setMeasurement(name, value, unit);
}

/**
 * Create a transaction for a domain operation
 */
export function startDomainTransaction<T>(
  domain: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      name: `${domain}:${operation}`,
      op: ISL_OPERATIONS.DOMAIN,
      attributes: {
        'isl.domain': domain,
        'isl.operation': operation,
      },
    },
    async (span) => {
      try {
        const result = await fn();
        span.setStatus(SPAN_STATUS.OK);
        return result;
      } catch (error) {
        span.setStatus({
          code: 2,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    }
  );
}
