import * as Sentry from '@sentry/node';
import type { ISLCaptureOptions, SanitizeOptions } from '../types';
import { sanitizeState } from '../utils';

/**
 * Custom error class for invariant violations
 */
export class InvariantError extends Error {
  readonly name = 'InvariantError';
  readonly domain: string;
  readonly expression: string;

  constructor(message: string, domain: string, expression: string) {
    super(message);
    this.domain = domain;
    this.expression = expression;
    Error.captureStackTrace(this, InvariantError);
  }
}

/**
 * Track an invariant violation in Sentry
 */
export function trackInvariantViolation(
  domain: string,
  invariant: string,
  state: unknown,
  options?: ISLCaptureOptions & SanitizeOptions
): string {
  const error = new InvariantError(
    `Invariant violated: ${invariant}`,
    domain,
    invariant
  );

  const sanitizedState = sanitizeState(
    state,
    options?.redactFields,
    options?.maxDepth,
    options?.maxStringLength
  );

  // Add breadcrumb for the violation
  Sentry.addBreadcrumb({
    category: 'isl.invariant.violated',
    message: `Invariant '${invariant}' violated in domain ${domain}`,
    level: 'error',
    data: {
      domain,
      invariant,
      stateSummary: summarizeState(sanitizedState),
    },
  });

  // Capture as fatal - invariant violations are critical
  const eventId = Sentry.captureException(error, {
    level: options?.level ?? 'fatal',
    tags: {
      'isl.domain': domain,
      'isl.check_type': 'invariant',
      ...options?.tags,
    },
    contexts: {
      isl: {
        domain,
        checkType: 'invariant',
        expression: invariant,
        timestamp: Date.now(),
      },
      isl_state: sanitizedState as Record<string, unknown>,
    },
    extra: options?.extra,
    fingerprint: options?.fingerprint ?? [domain, 'invariant', invariant],
  });

  return eventId;
}

/**
 * Track multiple invariant violations at once
 */
export function trackInvariantViolations(
  domain: string,
  violations: Array<{ invariant: string; state: unknown }>,
  options?: ISLCaptureOptions & SanitizeOptions
): string[] {
  return violations.map(({ invariant, state }) =>
    trackInvariantViolation(domain, invariant, state, options)
  );
}

/**
 * Create an invariant checker that automatically tracks violations
 */
export function createInvariantChecker<T>(
  domain: string,
  invariant: string,
  check: (state: T) => boolean,
  options?: ISLCaptureOptions & SanitizeOptions
): (state: T) => boolean {
  return (state: T) => {
    const result = check(state);
    if (!result) {
      trackInvariantViolation(domain, invariant, state, options);
    }
    return result;
  };
}

/**
 * Assert an invariant and track violation if it fails
 */
export function assertInvariant<T>(
  domain: string,
  invariant: string,
  state: T,
  check: (state: T) => boolean,
  options?: ISLCaptureOptions & SanitizeOptions
): void {
  if (!check(state)) {
    trackInvariantViolation(domain, invariant, state, options);
    throw new InvariantError(
      `Invariant violated: ${invariant}`,
      domain,
      invariant
    );
  }
}

/**
 * Summarize state for breadcrumb display
 */
function summarizeState(state: unknown): string {
  if (state === null || state === undefined) {
    return String(state);
  }

  if (typeof state === 'object') {
    if (Array.isArray(state)) {
      return `Array(${state.length})`;
    }
    const keys = Object.keys(state);
    if (keys.length === 0) {
      return '{}';
    }
    return `{${keys.slice(0, 5).join(', ')}${keys.length > 5 ? ', ...' : ''}}`;
  }

  const str = String(state);
  return str.length > 100 ? str.slice(0, 100) + '...' : str;
}

/**
 * Create a state monitor that continuously checks invariants
 */
export function createStateMonitor<T>(
  domain: string,
  invariants: Array<{
    name: string;
    check: (state: T) => boolean;
  }>,
  options?: ISLCaptureOptions & SanitizeOptions
): {
  checkState: (state: T) => boolean;
  getViolations: () => string[];
} {
  const violations: string[] = [];

  return {
    checkState: (state: T) => {
      let allPassed = true;

      for (const { name, check } of invariants) {
        if (!check(state)) {
          violations.push(name);
          trackInvariantViolation(domain, name, state, options);
          allPassed = false;
        }
      }

      return allPassed;
    },
    getViolations: () => [...violations],
  };
}

/**
 * Wrap an object with invariant checking on property changes
 */
export function withInvariantProxy<T extends object>(
  domain: string,
  target: T,
  invariants: Array<{
    name: string;
    check: (state: T) => boolean;
  }>,
  options?: ISLCaptureOptions & SanitizeOptions
): T {
  return new Proxy(target, {
    set(obj, prop, value) {
      const result = Reflect.set(obj, prop, value);

      // Check invariants after property change
      for (const { name, check } of invariants) {
        if (!check(obj as T)) {
          trackInvariantViolation(domain, name, obj, options);
        }
      }

      return result;
    },
  });
}
