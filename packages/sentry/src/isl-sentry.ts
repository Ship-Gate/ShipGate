import * as Sentry from '@sentry/node';
import type { VerifyResult, ISLCaptureOptions, SanitizeOptions } from './types';
import { trackBehavior, trackVerification } from './performance/spans';
import { trackVerificationResult } from './integrations/verification';
import { trackPreconditionFailure, PreconditionError } from './integrations/precondition';
import { trackPostconditionFailure, PostconditionError } from './integrations/postcondition';
import { trackInvariantViolation, InvariantError } from './integrations/invariant';
import { sanitizeInput, sanitizeOutput, sanitizeState } from './context/isl';
import {
  addBehaviorBreadcrumb,
  addVerificationBreadcrumb,
  addVerificationCheckBreadcrumbs,
} from './breadcrumbs/isl';

/**
 * ISLSentry - Main class for ISL Sentry integration
 * Provides a unified API for tracking ISL behaviors, verifications, and failures
 */
export class ISLSentry {
  /**
   * Wrap behavior execution with Sentry tracking
   */
  static trackBehavior<T>(
    domain: string,
    behavior: string,
    fn: () => Promise<T>,
    options?: {
      addBreadcrumbs?: boolean;
      captureErrors?: boolean;
    }
  ): Promise<T> {
    return trackBehavior(domain, behavior, fn, options);
  }

  /**
   * Track verification result
   */
  static trackVerification(
    result: VerifyResult,
    options?: {
      addBreadcrumbs?: boolean;
      addCheckBreadcrumbs?: boolean;
    }
  ): void {
    const { addBreadcrumbs = true, addCheckBreadcrumbs = true } = options ?? {};

    // Add breadcrumbs
    if (addBreadcrumbs) {
      addVerificationBreadcrumb(result);
    }

    if (addCheckBreadcrumbs) {
      addVerificationCheckBreadcrumbs(result);
    }

    // Track with span
    trackVerification(result);

    // Track result (captures error if unsafe)
    trackVerificationResult(result);
  }

  /**
   * Track precondition failure
   */
  static trackPreconditionFailure(
    domain: string,
    behavior: string,
    precondition: string,
    input: unknown,
    options?: ISLCaptureOptions & SanitizeOptions
  ): string {
    return trackPreconditionFailure(domain, behavior, precondition, input, options);
  }

  /**
   * Track postcondition failure
   */
  static trackPostconditionFailure(
    domain: string,
    behavior: string,
    postcondition: string,
    input: unknown,
    output: unknown,
    options?: ISLCaptureOptions & SanitizeOptions
  ): string {
    return trackPostconditionFailure(
      domain,
      behavior,
      postcondition,
      input,
      output,
      options
    );
  }

  /**
   * Track invariant violation
   */
  static trackInvariantViolation(
    domain: string,
    invariant: string,
    state: unknown,
    options?: ISLCaptureOptions & SanitizeOptions
  ): string {
    return trackInvariantViolation(domain, invariant, state, options);
  }

  /**
   * Add a behavior breadcrumb
   */
  static addBehaviorBreadcrumb(
    domain: string,
    behavior: string,
    message?: string,
    data?: Record<string, unknown>
  ): void {
    addBehaviorBreadcrumb(domain, behavior, message, data);
  }

  /**
   * Set ISL tags for the current scope
   */
  static setISLTags(tags: {
    domain?: string;
    behavior?: string;
    checkType?: string;
  }): void {
    if (tags.domain) {
      Sentry.setTag('isl.domain', tags.domain);
    }
    if (tags.behavior) {
      Sentry.setTag('isl.behavior', tags.behavior);
    }
    if (tags.checkType) {
      Sentry.setTag('isl.check_type', tags.checkType);
    }
  }

  /**
   * Set ISL context for the current scope
   */
  static setISLContext(context: {
    domain: string;
    behavior?: string;
    checkType?: string;
    expression?: string;
  }): void {
    Sentry.setContext('isl', {
      ...context,
      timestamp: Date.now(),
    });
  }

  /**
   * Capture an ISL-specific message
   */
  static captureMessage(
    message: string,
    options: {
      domain: string;
      behavior?: string;
      level?: 'info' | 'warning' | 'error' | 'fatal';
      extra?: Record<string, unknown>;
    }
  ): string {
    return Sentry.captureMessage(message, {
      level: options.level ?? 'info',
      tags: {
        'isl.domain': options.domain,
        ...(options.behavior && { 'isl.behavior': options.behavior }),
      },
      extra: options.extra,
    });
  }

  /**
   * Capture an ISL-specific exception
   */
  static captureException(
    error: Error,
    options: {
      domain: string;
      behavior?: string;
      checkType?: string;
      extra?: Record<string, unknown>;
    }
  ): string {
    return Sentry.captureException(error, {
      tags: {
        'isl.domain': options.domain,
        ...(options.behavior && { 'isl.behavior': options.behavior }),
        ...(options.checkType && { 'isl.check_type': options.checkType }),
      },
      extra: options.extra,
    });
  }

  /**
   * Run a function with ISL scope
   */
  static async withISLScope<T>(
    context: {
      domain: string;
      behavior?: string;
    },
    fn: () => Promise<T>
  ): Promise<T> {
    return Sentry.withScope(async (scope) => {
      scope.setTag('isl.domain', context.domain);
      if (context.behavior) {
        scope.setTag('isl.behavior', context.behavior);
      }
      scope.setContext('isl', {
        ...context,
        timestamp: Date.now(),
      });

      return fn();
    });
  }

  /**
   * Sanitize input data
   */
  static sanitizeInput(
    input: unknown,
    options?: SanitizeOptions
  ): unknown {
    return sanitizeInput(input, options);
  }

  /**
   * Sanitize output data
   */
  static sanitizeOutput(
    output: unknown,
    options?: SanitizeOptions
  ): unknown {
    return sanitizeOutput(output, options);
  }

  /**
   * Sanitize state data
   */
  static sanitizeState(
    state: unknown,
    options?: SanitizeOptions
  ): unknown {
    return sanitizeState(state, options);
  }
}

// Re-export error classes for convenience
export { PreconditionError, PostconditionError, InvariantError };
