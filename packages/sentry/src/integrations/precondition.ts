// ============================================================================
// Precondition Failure Integration
// ============================================================================

import * as Sentry from '@sentry/node';
import type { Integration, Event, EventHint } from '@sentry/types';

import type { ISLContext } from '../types';
import { PreconditionError, isPreconditionError } from '../errors';
import { sanitizeInput, createSanitizationOptions } from '../utils';
import type { ISLSentryOptions } from '../types';

/**
 * Precondition failure statistics
 */
interface PreconditionStats {
  total: number;
  byDomain: Record<string, number>;
  byBehavior: Record<string, number>;
  byExpression: Record<string, number>;
}

/**
 * Precondition Integration for Sentry
 *
 * This integration tracks precondition failures and provides
 * detailed analytics on input validation issues.
 */
export class PreconditionIntegration implements Integration {
  static id = 'ISLPrecondition';
  name = PreconditionIntegration.id;

  private stats: PreconditionStats = {
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
   * Process precondition-related events
   */
  processEvent(event: Event, hint?: EventHint): Event | null {
    const error = hint?.originalException;

    if (!isPreconditionError(error)) {
      return event;
    }

    // Track statistics
    this.trackPreconditionFailure(error);

    // Enhance event
    event.level = 'warning';
    event.tags = {
      ...event.tags,
      'isl.failure_type': 'precondition',
      'isl.domain': error.domain,
      'isl.behavior': error.behavior || '',
    };

    // Add statistics to extra
    event.extra = {
      ...event.extra,
      precondition_stats: {
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
   * Track a precondition failure
   */
  private trackPreconditionFailure(error: PreconditionError): void {
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
   * Record a precondition failure
   */
  recordFailure(
    domain: string,
    behavior: string,
    precondition: string,
    input?: unknown
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

    // Create error for tracking
    const error = new PreconditionError(precondition, domain, behavior, input);
    this.trackPreconditionFailure(error);

    // Add breadcrumb
    Sentry.addBreadcrumb({
      category: 'isl.precondition',
      message: `Precondition failed: ${precondition}`,
      level: 'warning',
      data: {
        domain,
        behavior,
        expression: precondition,
        hasInput: input !== undefined,
      },
    });

    // Capture exception
    Sentry.captureException(error, {
      tags: {
        'isl.domain': domain,
        'isl.behavior': behavior,
        'isl.check_type': 'precondition',
      },
      contexts: {
        isl: {
          domain,
          behavior,
          checkType: 'precondition',
          expression: precondition,
          timestamp: Date.now(),
        } satisfies ISLContext,
        input: sanitizedInput as Record<string, unknown> | undefined,
      },
      fingerprint: [domain, behavior, 'precondition', precondition],
    });
  }

  /**
   * Get precondition failure statistics
   */
  getStats(): PreconditionStats {
    return {
      total: this.stats.total,
      byDomain: { ...this.stats.byDomain },
      byBehavior: { ...this.stats.byBehavior },
      byExpression: { ...this.stats.byExpression },
    };
  }

  /**
   * Get most common precondition failures
   */
  getMostCommonFailures(limit: number = 10): Array<{
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
 * Create precondition integration instance
 */
export function createPreconditionIntegration(
  options?: Partial<ISLSentryOptions>
): PreconditionIntegration {
  return new PreconditionIntegration(options);
}

/**
 * Global precondition integration instance
 */
let globalPreconditionIntegration: PreconditionIntegration | null = null;

/**
 * Get or create the global precondition integration
 */
export function getPreconditionIntegration(
  options?: Partial<ISLSentryOptions>
): PreconditionIntegration {
  if (!globalPreconditionIntegration) {
    globalPreconditionIntegration = new PreconditionIntegration(options);
  }
  return globalPreconditionIntegration;
}

/**
 * Track a precondition failure using the global integration
 */
export function trackPreconditionFailure(
  domain: string,
  behavior: string,
  precondition: string,
  input?: unknown
): void {
  getPreconditionIntegration().recordFailure(domain, behavior, precondition, input);
}
