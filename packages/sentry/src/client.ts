// ============================================================================
// Sentry Client Setup
// ============================================================================

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { Integration } from '@sentry/types';

import type { ISLSentryOptions, ISLContext, CheckType } from './types';
import { DEFAULT_OPTIONS } from './types';
import { ISLIntegration } from './integrations/isl';
import { createFingerprint } from './utils';
import {
  isISLError,
  isPreconditionError,
  isPostconditionError,
  isInvariantError,
  isTemporalError,
} from './errors';

let initialized = false;
let currentOptions: ISLSentryOptions | null = null;

/**
 * Initialize Sentry with ISL-specific configuration
 */
export function initSentry(options: ISLSentryOptions): void {
  if (initialized) {
    if (options.debug) {
      // eslint-disable-next-line no-console
      console.warn('[ISL Sentry] Already initialized. Skipping re-initialization.');
    }
    return;
  }

  const mergedOptions: ISLSentryOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const integrations: Integration[] = [];

  // Add ISL integration if enabled
  if (mergedOptions.enableISLIntegration !== false) {
    integrations.push(new ISLIntegration());
  }

  // Add profiling integration if enabled
  if (mergedOptions.enableProfiling) {
    integrations.push(nodeProfilingIntegration());
  }

  Sentry.init({
    dsn: options.dsn,
    environment: mergedOptions.environment ?? DEFAULT_OPTIONS.environment,
    release: mergedOptions.release,

    integrations: (defaultIntegrations: Integration[]) => [
      ...defaultIntegrations,
      ...integrations,
    ],

    tracesSampleRate: mergedOptions.enablePerformance !== false
      ? (mergedOptions.tracesSampleRate ?? DEFAULT_OPTIONS.tracesSampleRate)
      : 0,

    profilesSampleRate: mergedOptions.enableProfiling
      ? (mergedOptions.profilesSampleRate ?? DEFAULT_OPTIONS.profilesSampleRate)
      : 0,

    // Apply default tags
    initialScope: {
      tags: {
        'isl.enabled': 'true',
        'isl.service': mergedOptions.serviceName ?? DEFAULT_OPTIONS.serviceName,
        ...mergedOptions.defaultTags,
      },
    },

    // Enrich events with ISL context
    beforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint) {
      // Handle ISL errors specially
      const error = hint?.originalException;

      if (isISLError(error)) {
        event.tags = {
          ...event.tags,
          'isl.domain': error.domain,
          'isl.error_type': error.code,
        };

        if (error.behavior) {
          event.tags['isl.behavior'] = error.behavior;
        }

        // Add check type for specific error types
        if (isPreconditionError(error)) {
          event.tags['isl.check_type'] = 'precondition';
          event.contexts = {
            ...event.contexts,
            isl: {
              domain: error.domain,
              behavior: error.behavior,
              checkType: 'precondition',
              expression: error.expression,
            },
          };
        } else if (isPostconditionError(error)) {
          event.tags['isl.check_type'] = 'postcondition';
          event.contexts = {
            ...event.contexts,
            isl: {
              domain: error.domain,
              behavior: error.behavior,
              checkType: 'postcondition',
              expression: error.expression,
            },
          };
        } else if (isInvariantError(error)) {
          event.tags['isl.check_type'] = 'invariant';
          event.contexts = {
            ...event.contexts,
            isl: {
              domain: error.domain,
              checkType: 'invariant',
              expression: error.expression,
            },
          };
        } else if (isTemporalError(error)) {
          event.tags['isl.check_type'] = 'temporal';
          event.contexts = {
            ...event.contexts,
            isl: {
              domain: error.domain,
              behavior: error.behavior,
              checkType: 'temporal',
              expression: error.expression,
              property: error.property,
            },
          };
        }
      }

      // Apply custom fingerprinting for ISL events
      const islContext = event.contexts?.isl as ISLContext | undefined;
      if (islContext) {
        const fingerprint = mergedOptions.fingerprintFn
          ? mergedOptions.fingerprintFn({
              type: 'error',
              context: islContext,
              level: 'error',
              message: event.message || '',
            })
          : createFingerprint(
              islContext.domain,
              islContext.behavior,
              islContext.checkType,
              islContext.expression
            );

        event.fingerprint = ['{{ default }}', ...fingerprint];
      }

      return event;
    },

    // Error boundary
    beforeBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      return breadcrumb;
    },

    debug: mergedOptions.debug ?? DEFAULT_OPTIONS.debug,
  });

  initialized = true;
  currentOptions = options;

  if (options.debug) {
    // eslint-disable-next-line no-console
    console.log('[ISL Sentry] Initialized successfully');
  }
}

/**
 * Check if Sentry is initialized
 */
export function isInitialized(): boolean {
  return initialized;
}

/**
 * Get current options (returns null if not initialized)
 */
export function getOptions(): ISLSentryOptions | null {
  return currentOptions;
}

/**
 * Flush pending events
 */
export async function flush(timeout?: number): Promise<boolean> {
  return Sentry.flush(timeout);
}

/**
 * Close Sentry client
 */
export async function close(timeout?: number): Promise<boolean> {
  const result = await Sentry.close(timeout);
  initialized = false;
  currentOptions = null;
  return result;
}

/**
 * Set ISL context for current scope
 */
export function setISLContext(context: Partial<ISLContext>): void {
  Sentry.setContext('isl', {
    ...context,
    timestamp: context.timestamp ?? Date.now(),
  });
}

/**
 * Set ISL tags for current scope
 */
export function setISLTags(
  domain: string,
  behavior?: string,
  checkType?: CheckType
): void {
  const tags: Record<string, string> = { 'isl.domain': domain };

  if (behavior) {
    tags['isl.behavior'] = behavior;
  }

  if (checkType) {
    tags['isl.check_type'] = checkType;
  }

  Sentry.setTags(tags);
}

/**
 * Clear ISL context from current scope
 */
export function clearISLContext(): void {
  Sentry.setContext('isl', null);
  Sentry.setTag('isl.domain', '');
  Sentry.setTag('isl.behavior', '');
  Sentry.setTag('isl.check_type', '');
}

/**
 * Run callback within ISL scope
 */
export function withISLScope<T>(
  context: Partial<ISLContext>,
  callback: () => T
): T {
  return Sentry.withScope((scope: Sentry.Scope) => {
    scope.setContext('isl', {
      ...context,
      timestamp: context.timestamp ?? Date.now(),
    });

    if (context.domain) {
      scope.setTag('isl.domain', context.domain);
    }

    if (context.behavior) {
      scope.setTag('isl.behavior', context.behavior);
    }

    if (context.checkType) {
      scope.setTag('isl.check_type', context.checkType);
    }

    return callback();
  });
}

/**
 * Re-export Sentry for direct access when needed
 */
export { Sentry };
