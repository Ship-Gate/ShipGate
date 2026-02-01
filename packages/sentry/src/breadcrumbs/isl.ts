// ============================================================================
// ISL Breadcrumbs
// ============================================================================

import * as Sentry from '@sentry/node';
import type { SeverityLevel, Breadcrumb } from '@sentry/types';

import type { ISLBreadcrumbData, CheckType, VerifyResult, Verdict } from '../types';

/**
 * Breadcrumb categories for ISL
 */
export const ISL_BREADCRUMB_CATEGORIES = {
  BEHAVIOR: 'isl.behavior',
  CHECK: 'isl.check',
  CHECK_PASSED: 'isl.check.passed',
  CHECK_FAILED: 'isl.check.failed',
  VERIFICATION: 'isl.verification',
  PRECONDITION: 'isl.precondition',
  POSTCONDITION: 'isl.postcondition',
  INVARIANT: 'isl.invariant',
  TEMPORAL: 'isl.temporal',
  DOMAIN: 'isl.domain',
} as const;

export type ISLBreadcrumbCategory = typeof ISL_BREADCRUMB_CATEGORIES[keyof typeof ISL_BREADCRUMB_CATEGORIES];

/**
 * Add a generic ISL breadcrumb
 */
export function addISLBreadcrumb(
  category: ISLBreadcrumbCategory,
  message: string,
  level: SeverityLevel,
  data?: ISLBreadcrumbData
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Add a behavior execution breadcrumb
 */
export function addBehaviorBreadcrumb(
  domain: string,
  behavior: string,
  phase: 'start' | 'end' | 'error',
  data?: Record<string, unknown>
): void {
  const messages: Record<string, string> = {
    start: `Starting ${domain}.${behavior}`,
    end: `Completed ${domain}.${behavior}`,
    error: `Error in ${domain}.${behavior}`,
  };

  const levels: Record<string, SeverityLevel> = {
    start: 'info',
    end: 'info',
    error: 'error',
  };

  addISLBreadcrumb(
    ISL_BREADCRUMB_CATEGORIES.BEHAVIOR,
    messages[phase],
    levels[phase],
    {
      domain,
      behavior,
      ...data,
    }
  );
}

/**
 * Add a check breadcrumb
 */
export function addCheckBreadcrumb(
  domain: string,
  behavior: string,
  checkType: CheckType,
  expression: string,
  passed: boolean,
  data?: Record<string, unknown>
): void {
  const category = passed
    ? ISL_BREADCRUMB_CATEGORIES.CHECK_PASSED
    : ISL_BREADCRUMB_CATEGORIES.CHECK_FAILED;

  const level: SeverityLevel = passed ? 'info' : 'warning';

  addISLBreadcrumb(category, `${checkType}: ${expression}`, level, {
    domain,
    behavior,
    checkType,
    expression,
    result: passed ? 'pass' : 'fail',
    ...data,
  });
}

/**
 * Add a precondition breadcrumb
 */
export function addPreconditionBreadcrumb(
  domain: string,
  behavior: string,
  expression: string,
  passed: boolean,
  error?: string
): void {
  const level: SeverityLevel = passed ? 'info' : 'warning';
  const message = passed
    ? `Precondition passed: ${expression}`
    : `Precondition failed: ${expression}`;

  addISLBreadcrumb(ISL_BREADCRUMB_CATEGORIES.PRECONDITION, message, level, {
    domain,
    behavior,
    checkType: 'precondition',
    expression,
    result: passed ? 'pass' : 'fail',
    ...(error && { error }),
  });
}

/**
 * Add a postcondition breadcrumb
 */
export function addPostconditionBreadcrumb(
  domain: string,
  behavior: string,
  expression: string,
  passed: boolean,
  error?: string
): void {
  const level: SeverityLevel = passed ? 'info' : 'error';
  const message = passed
    ? `Postcondition passed: ${expression}`
    : `Postcondition failed: ${expression}`;

  addISLBreadcrumb(ISL_BREADCRUMB_CATEGORIES.POSTCONDITION, message, level, {
    domain,
    behavior,
    checkType: 'postcondition',
    expression,
    result: passed ? 'pass' : 'fail',
    ...(error && { error }),
  });
}

/**
 * Add an invariant breadcrumb
 */
export function addInvariantBreadcrumb(
  domain: string,
  expression: string,
  passed: boolean,
  error?: string
): void {
  const level: SeverityLevel = passed ? 'info' : 'fatal';
  const message = passed
    ? `Invariant holds: ${expression}`
    : `Invariant violated: ${expression}`;

  addISLBreadcrumb(ISL_BREADCRUMB_CATEGORIES.INVARIANT, message, level, {
    domain,
    checkType: 'invariant',
    expression,
    result: passed ? 'pass' : 'fail',
    ...(error && { error }),
  });
}

/**
 * Add a temporal property breadcrumb
 */
export function addTemporalBreadcrumb(
  domain: string,
  behavior: string | undefined,
  property: string,
  expression: string,
  passed: boolean,
  error?: string
): void {
  const level: SeverityLevel = passed ? 'info' : 'error';
  const message = passed
    ? `Temporal property holds: ${property}`
    : `Temporal property violated: ${property}`;

  addISLBreadcrumb(ISL_BREADCRUMB_CATEGORIES.TEMPORAL, message, level, {
    domain,
    behavior,
    checkType: 'temporal',
    expression,
    result: passed ? 'pass' : 'fail',
    property,
    ...(error && { error }),
  });
}

/**
 * Add a verification result breadcrumb
 */
export function addVerificationBreadcrumb(result: VerifyResult): void {
  const verdictLevels: Record<Verdict, SeverityLevel> = {
    verified: 'info',
    risky: 'warning',
    unsafe: 'error',
  };

  // Add summary breadcrumb
  addISLBreadcrumb(
    ISL_BREADCRUMB_CATEGORIES.VERIFICATION,
    `Verification ${result.verdict}: ${result.domain}.${result.behavior} (score: ${result.score})`,
    verdictLevels[result.verdict],
    {
      domain: result.domain,
      behavior: result.behavior,
      verdict: result.verdict,
      score: result.score,
      coverage: result.coverage.total,
      failedCount: result.failed.length,
      passedCount: result.passed.length,
    }
  );

  // Add breadcrumbs for failed checks
  for (const failed of result.failed) {
    addCheckBreadcrumb(
      result.domain,
      result.behavior,
      failed.category,
      failed.expression,
      false,
      {
        name: failed.name,
        error: failed.error,
      }
    );
  }
}

/**
 * Add a domain entry breadcrumb
 */
export function addDomainBreadcrumb(
  domain: string,
  action: 'enter' | 'exit',
  data?: Record<string, unknown>
): void {
  const message = action === 'enter'
    ? `Entering domain: ${domain}`
    : `Exiting domain: ${domain}`;

  addISLBreadcrumb(ISL_BREADCRUMB_CATEGORIES.DOMAIN, message, 'info', {
    domain,
    action,
    ...data,
  });
}

/**
 * Create a breadcrumb trail for a verification
 */
export function createVerificationTrail(result: VerifyResult): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [];
  const now = Date.now() / 1000;

  // Start breadcrumb
  breadcrumbs.push({
    category: ISL_BREADCRUMB_CATEGORIES.VERIFICATION,
    message: `Starting verification: ${result.domain}.${result.behavior}`,
    level: 'info',
    timestamp: now - (result.duration ? result.duration / 1000 : 0),
    data: {
      domain: result.domain,
      behavior: result.behavior,
      phase: 'start',
    },
  });

  // Check breadcrumbs
  let checkTime = now - (result.duration ? result.duration / 1000 : 0) + 0.001;

  for (const passed of result.passed) {
    breadcrumbs.push({
      category: ISL_BREADCRUMB_CATEGORIES.CHECK_PASSED,
      message: `✓ ${passed.name}`,
      level: 'info',
      timestamp: checkTime,
      data: {
        domain: result.domain,
        behavior: result.behavior,
        checkType: passed.category,
        expression: passed.expression,
        result: 'pass',
      },
    });
    checkTime += 0.001;
  }

  for (const failed of result.failed) {
    breadcrumbs.push({
      category: ISL_BREADCRUMB_CATEGORIES.CHECK_FAILED,
      message: `✗ ${failed.name}: ${failed.error}`,
      level: 'warning',
      timestamp: checkTime,
      data: {
        domain: result.domain,
        behavior: result.behavior,
        checkType: failed.category,
        expression: failed.expression,
        result: 'fail',
        error: failed.error,
      },
    });
    checkTime += 0.001;
  }

  // End breadcrumb
  const verdictLevels: Record<Verdict, SeverityLevel> = {
    verified: 'info',
    risky: 'warning',
    unsafe: 'error',
  };

  breadcrumbs.push({
    category: ISL_BREADCRUMB_CATEGORIES.VERIFICATION,
    message: `Verification complete: ${result.verdict} (score: ${result.score})`,
    level: verdictLevels[result.verdict],
    timestamp: now,
    data: {
      domain: result.domain,
      behavior: result.behavior,
      phase: 'end',
      verdict: result.verdict,
      score: result.score,
    },
  });

  return breadcrumbs;
}

/**
 * Add multiple breadcrumbs
 */
export function addBreadcrumbs(breadcrumbs: Breadcrumb[]): void {
  for (const breadcrumb of breadcrumbs) {
    Sentry.addBreadcrumb(breadcrumb);
  }
}

/**
 * Clear ISL breadcrumbs (requires scope access)
 */
export function clearISLBreadcrumbs(): void {
  Sentry.withScope((scope) => {
    // Clear breadcrumbs by setting a fresh scope
    scope.clearBreadcrumbs();
  });
}
