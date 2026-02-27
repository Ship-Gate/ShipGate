// ============================================================================
// ISL Sentry Integration
// ============================================================================

import * as Sentry from '@sentry/node';
import type { Integration, Event, EventHint } from '@sentry/types';

import type { ISLContext, CheckType } from '../types';
import {
  isISLError,
  isPreconditionError,
  isPostconditionError,
  isInvariantError,
  isTemporalError,
  isVerificationError,
} from '../errors';

/**
 * ISL Integration for Sentry
 *
 * This integration adds ISL-specific event processing:
 * - Automatic ISL error classification
 * - Context enrichment
 * - Custom fingerprinting
 * - Breadcrumb filtering
 */
export class ISLIntegration implements Integration {
  static id = 'ISL';
  name = ISLIntegration.id;

  /**
   * Setup the integration
   */
  setupOnce(): void {
    Sentry.addEventProcessor((event: Event, hint?: EventHint) => {
      return this.processEvent(event, hint);
    });
  }

  /**
   * Process an event and add ISL-specific enrichment
   */
  processEvent(event: Event, hint?: EventHint): Event | null {
    const error = hint?.originalException;

    // Skip non-ISL events unless they already have ISL context
    if (!isISLError(error) && !event.contexts?.isl) {
      return event;
    }

    // Process ISL errors
    if (isISLError(error)) {
      return this.processISLError(event, error);
    }

    // Process events with ISL context
    if (event.contexts?.isl) {
      return this.enrichWithISLContext(event);
    }

    return event;
  }

  /**
   * Process ISL-specific errors
   */
  private processISLError(event: Event, error: unknown): Event {
    // Ensure ISL tag
    event.tags = {
      ...event.tags,
      'isl.enabled': 'true',
    };

    if (isPreconditionError(error)) {
      return this.processPreconditionError(event, error);
    }

    if (isPostconditionError(error)) {
      return this.processPostconditionError(event, error);
    }

    if (isInvariantError(error)) {
      return this.processInvariantError(event, error);
    }

    if (isTemporalError(error)) {
      return this.processTemporalError(event, error);
    }

    if (isVerificationError(error)) {
      return this.processVerificationError(event, error);
    }

    return event;
  }

  /**
   * Process precondition errors
   */
  private processPreconditionError(
    event: Event,
    error: import('../errors').PreconditionError
  ): Event {
    event.tags = {
      ...event.tags,
      'isl.domain': error.domain,
      'isl.behavior': error.behavior || '',
      'isl.check_type': 'precondition',
      'isl.error_code': error.code,
    };

    event.contexts = {
      ...event.contexts,
      isl: {
        domain: error.domain,
        behavior: error.behavior,
        checkType: 'precondition' as CheckType,
        expression: error.expression,
        timestamp: error.timestamp,
      } satisfies ISLContext,
    };

    event.fingerprint = [
      '{{ default }}',
      error.domain,
      error.behavior || '',
      'precondition',
      error.expression,
    ];

    // Set severity to warning for precondition failures
    event.level = 'warning';

    return event;
  }

  /**
   * Process postcondition errors
   */
  private processPostconditionError(
    event: Event,
    error: import('../errors').PostconditionError
  ): Event {
    event.tags = {
      ...event.tags,
      'isl.domain': error.domain,
      'isl.behavior': error.behavior || '',
      'isl.check_type': 'postcondition',
      'isl.error_code': error.code,
    };

    event.contexts = {
      ...event.contexts,
      isl: {
        domain: error.domain,
        behavior: error.behavior,
        checkType: 'postcondition' as CheckType,
        expression: error.expression,
        timestamp: error.timestamp,
      } satisfies ISLContext,
    };

    event.fingerprint = [
      '{{ default }}',
      error.domain,
      error.behavior || '',
      'postcondition',
      error.expression,
    ];

    // Set severity to error for postcondition failures
    event.level = 'error';

    return event;
  }

  /**
   * Process invariant errors
   */
  private processInvariantError(
    event: Event,
    error: import('../errors').InvariantError
  ): Event {
    event.tags = {
      ...event.tags,
      'isl.domain': error.domain,
      'isl.check_type': 'invariant',
      'isl.error_code': error.code,
    };

    event.contexts = {
      ...event.contexts,
      isl: {
        domain: error.domain,
        checkType: 'invariant' as CheckType,
        expression: error.expression,
        timestamp: error.timestamp,
      } satisfies ISLContext,
    };

    event.fingerprint = [
      '{{ default }}',
      error.domain,
      'invariant',
      error.expression,
    ];

    // Set severity to fatal for invariant violations
    event.level = 'fatal';

    return event;
  }

  /**
   * Process temporal errors
   */
  private processTemporalError(
    event: Event,
    error: import('../errors').TemporalError
  ): Event {
    event.tags = {
      ...event.tags,
      'isl.domain': error.domain,
      'isl.behavior': error.behavior || '',
      'isl.check_type': 'temporal',
      'isl.temporal_property': error.property,
      'isl.error_code': error.code,
    };

    event.contexts = {
      ...event.contexts,
      isl: {
        domain: error.domain,
        behavior: error.behavior,
        checkType: 'temporal' as CheckType,
        expression: error.expression,
        timestamp: error.timestamp,
        metadata: {
          property: error.property,
        },
      } satisfies ISLContext,
    };

    event.fingerprint = [
      '{{ default }}',
      error.domain,
      error.behavior || '',
      'temporal',
      error.property,
      error.expression,
    ];

    // Set severity to error for temporal violations
    event.level = 'error';

    return event;
  }

  /**
   * Process verification errors
   */
  private processVerificationError(
    event: Event,
    error: import('../errors').VerificationError
  ): Event {
    event.tags = {
      ...event.tags,
      'isl.domain': error.domain,
      'isl.behavior': error.behavior || '',
      'isl.verdict': error.verdict,
      'isl.error_code': error.code,
    };

    event.contexts = {
      ...event.contexts,
      isl: {
        domain: error.domain,
        behavior: error.behavior,
        timestamp: error.timestamp,
        metadata: {
          verdict: error.verdict,
          score: error.score,
          failedChecks: error.failedChecks,
        },
      } satisfies ISLContext,
      verification: {
        verdict: error.verdict,
        score: error.score,
        failed_checks: error.failedChecks,
      },
    };

    event.fingerprint = [
      '{{ default }}',
      error.domain,
      error.behavior || '',
      'verification',
      error.verdict,
    ];

    // Set severity based on verdict
    event.level = error.verdict === 'unsafe' ? 'error' : 'warning';

    return event;
  }

  /**
   * Enrich event with existing ISL context
   */
  private enrichWithISLContext(event: Event): Event {
    const context = event.contexts?.isl as ISLContext | undefined;

    if (!context) {
      return event;
    }

    // Ensure tags match context
    event.tags = {
      ...event.tags,
      'isl.enabled': 'true',
      'isl.domain': context.domain,
    };

    if (context.behavior) {
      event.tags['isl.behavior'] = context.behavior;
    }

    if (context.checkType) {
      event.tags['isl.check_type'] = context.checkType;
    }

    return event;
  }
}

/**
 * Create ISL integration instance
 */
export function createISLIntegration(): ISLIntegration {
  return new ISLIntegration();
}
