// ============================================================================
// Postcondition Failure Integration
// ============================================================================

import * as Sentry from '@sentry/node';
import type { Integration, Event, EventHint } from '@sentry/types';

import type { ISLContext } from '../types';
import { PostconditionError, isPostconditionError } from '../errors';
import { sanitizeInput, sanitizeOutput, createSanitizationOptions } from '../utils';
import type { ISLSentryOptions } from '../types';

/**
 * Postcondition failure statistics
 */
interface PostconditionStats {
  total: number;
  byDomain: Record<string, number>;
  byBehavior: Record<string, number>;
  byExpression: Record<string, number>;
}

/**
 * Postcondition Integration for Sentry
 *
 * This integration tracks postcondition failures and provides
 * detailed analytics on output validation issues.
 */
export class PostconditionIntegration implements Integration {
  static id = 'ISLPostcondition';
  name = PostconditionIntegration.id;

  private stats: PostconditionStats = {
    total: 0,
    byDomain: {},
    byBehavior: {},
    byExpression: {},
  };

  private options: Partial<ISLSentryOptions>;

  constructor(options: Partial<ISLSentryOptions> = {}) {
    this.options = options;
  }

  /**
   * Setup the integration
   */
  setupOnce(): void {
    Sentry.addEventProcessor((event: Event, hint?: EventHint) => {
      return this.processEvent(event, hint);
    });
  }

  /**
   * Process postcondition-related events
   */
  processEvent(event: Event, hint?: EventHint): Event | null {
    const error = hint?.originalException;

    if (!isPostconditionError(error)) {
      return event;
    }

    // Track statistics
    this.trackPostconditionFailure(error);

    // Enhance event
    event.level = 'error';
    event.tags = {
      ...event.tags,
      'isl.failure_type': 'postcondition',
      'isl.domain': error.domain,
      'isl.behavior': error.behavior || '',
    };

    // Add statistics to extra
    event.extra = {
      ...event.extra,
      postcondition_stats: {
        total_failures: this.stats.total,
        domain_failures: this.stats.byDomain[error.domain] || 0,
        behavior_failures: error.behavior
          ? this.stats.byBehavior[`${error.domain}.${error.behavior}`] || 0
          : 0,
      },
    };

    return event;
  }

  /**
   * Track a postcondition failure
   */
  private trackPostconditionFailure(error: PostconditionError): void {
    this.stats.total++;

    // Track by domain
    this.stats.byDomain[error.domain] =
      (this.stats.byDomain[error.domain] || 0) + 1;

    // Track by behavior
    if (error.behavior) {
      const key = `${error.domain}.${error.behavior}`;
      this.stats.byBehavior[key] = (this.stats.byBehavior[key] || 0) + 1;
    }

    // Track by expression
    const exprKey = `${error.domain}:${error.expression}`;
    this.stats.byExpression[exprKey] =
      (this.stats.byExpression[exprKey] || 0) + 1;
  }

  /**
   * Record a postcondition failure
   */
  recordFailure(
    domain: string,
    behavior: string,
    postcondition: string,
    input?: unknown,
    output?: unknown
  ): void {
    const sanitizationOpts = createSanitizationOptions(this.options);

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

    // Create error for tracking
    const error = new PostconditionError(
      postcondition,
      domain,
      behavior,
      input,
      output
    );
    this.trackPostconditionFailure(error);

    // Add breadcrumb
    Sentry.addBreadcrumb({
      category: 'isl.postcondition',
      message: `Postcondition failed: ${postcondition}`,
      level: 'error',
      data: {
        domain,
        behavior,
        expression: postcondition,
        hasInput: input !== undefined,
        hasOutput: output !== undefined,
      },
    });

    // Capture exception
    Sentry.captureException(error, {
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
          checkType: 'postcondition',
          expression: postcondition,
          timestamp: Date.now(),
        } satisfies ISLContext,
        input: sanitizedInput as Record<string, unknown> | undefined,
        output: sanitizedOutput as Record<string, unknown> | undefined,
      },
      fingerprint: [domain, behavior, 'postcondition', postcondition],
    });
  }

  /**
   * Get postcondition failure statistics
   */
  getStats(): PostconditionStats {
    return {
      total: this.stats.total,
      byDomain: { ...this.stats.byDomain },
      byBehavior: { ...this.stats.byBehavior },
      byExpression: { ...this.stats.byExpression },
    };
  }

  /**
   * Get most critical postcondition failures (by frequency)
   */
  getMostCriticalFailures(limit: number = 10): Array<{
    expression: string;
    count: number;
    domain: string;
  }> {
    return Object.entries(this.stats.byExpression)
      .map(([key, count]) => {
        const [domain, ...exprParts] = key.split(':');
        return {
          expression: exprParts.join(':'),
          count,
          domain,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get failure rate by behavior
   */
  getFailureRateByBehavior(): Array<{
    domain: string;
    behavior: string;
    count: number;
  }> {
    return Object.entries(this.stats.byBehavior)
      .map(([key, count]) => {
        const [domain, behavior] = key.split('.');
        return { domain, behavior, count };
      })
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      total: 0,
      byDomain: {},
      byBehavior: {},
      byExpression: {},
    };
  }
}

/**
 * Create postcondition integration instance
 */
export function createPostconditionIntegration(
  options?: Partial<ISLSentryOptions>
): PostconditionIntegration {
  return new PostconditionIntegration(options);
}

/**
 * Global postcondition integration instance
 */
let globalPostconditionIntegration: PostconditionIntegration | null = null;

/**
 * Get or create the global postcondition integration
 */
export function getPostconditionIntegration(
  options?: Partial<ISLSentryOptions>
): PostconditionIntegration {
  if (!globalPostconditionIntegration) {
    globalPostconditionIntegration = new PostconditionIntegration(options);
  }
  return globalPostconditionIntegration;
}

/**
 * Track a postcondition failure using the global integration
 */
export function trackPostconditionFailure(
  domain: string,
  behavior: string,
  postcondition: string,
  input?: unknown,
  output?: unknown
): void {
  getPostconditionIntegration().recordFailure(
    domain,
    behavior,
    postcondition,
    input,
    output
  );
}
