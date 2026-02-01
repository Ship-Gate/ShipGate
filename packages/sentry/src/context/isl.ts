// ============================================================================
// ISL Context Management
// ============================================================================

import * as Sentry from '@sentry/node';

import type { ISLContext, CheckType, VerifyResult } from '../types';
import { generateExecutionId } from '../utils';

/**
 * Context stack for nested ISL operations
 */
const contextStack: ISLContext[] = [];

/**
 * Create a new ISL context
 */
export function createISLContext(
  domain: string,
  behavior?: string,
  options?: Partial<Omit<ISLContext, 'domain' | 'behavior' | 'timestamp'>>
): ISLContext {
  return {
    domain,
    behavior,
    timestamp: Date.now(),
    executionId: options?.executionId ?? generateExecutionId(),
    ...options,
  };
}

/**
 * Push a context onto the stack
 */
export function pushContext(context: ISLContext): void {
  // Set parent execution ID if there's a parent context
  if (contextStack.length > 0) {
    const parent = contextStack[contextStack.length - 1];
    context.parentExecutionId = parent.executionId;
  }

  contextStack.push(context);
  applyContextToSentry(context);
}

/**
 * Pop a context from the stack
 */
export function popContext(): ISLContext | undefined {
  const context = contextStack.pop();

  // Restore previous context or clear
  if (contextStack.length > 0) {
    const previous = contextStack[contextStack.length - 1];
    applyContextToSentry(previous);
  } else {
    clearSentryContext();
  }

  return context;
}

/**
 * Get the current context
 */
export function getCurrentContext(): ISLContext | undefined {
  return contextStack[contextStack.length - 1];
}

/**
 * Get the context stack depth
 */
export function getContextDepth(): number {
  return contextStack.length;
}

/**
 * Apply context to Sentry
 */
function applyContextToSentry(context: ISLContext): void {
  Sentry.setContext('isl', {
    domain: context.domain,
    behavior: context.behavior,
    checkType: context.checkType,
    expression: context.expression,
    timestamp: context.timestamp,
    executionId: context.executionId,
    parentExecutionId: context.parentExecutionId,
  });

  Sentry.setTags({
    'isl.domain': context.domain,
  });

  if (context.behavior) {
    Sentry.setTag('isl.behavior', context.behavior);
  }

  if (context.checkType) {
    Sentry.setTag('isl.check_type', context.checkType);
  }

  if (context.executionId) {
    Sentry.setTag('isl.execution_id', context.executionId);
  }
}

/**
 * Clear Sentry ISL context
 */
function clearSentryContext(): void {
  Sentry.setContext('isl', null);
}

/**
 * Run a function within an ISL context
 */
export function withContext<T>(
  context: ISLContext,
  fn: () => T
): T {
  pushContext(context);
  try {
    return fn();
  } finally {
    popContext();
  }
}

/**
 * Run an async function within an ISL context
 */
export async function withContextAsync<T>(
  context: ISLContext,
  fn: () => Promise<T>
): Promise<T> {
  pushContext(context);
  try {
    return await fn();
  } finally {
    popContext();
  }
}

/**
 * Set domain context
 */
export function setDomainContext(domain: string, metadata?: Record<string, unknown>): void {
  const context = createISLContext(domain, undefined, { metadata });
  pushContext(context);
}

/**
 * Set behavior context
 */
export function setBehaviorContext(
  domain: string,
  behavior: string,
  metadata?: Record<string, unknown>
): void {
  const context = createISLContext(domain, behavior, { metadata });
  pushContext(context);
}

/**
 * Set check context
 */
export function setCheckContext(
  domain: string,
  behavior: string,
  checkType: CheckType,
  expression?: string
): void {
  const context = createISLContext(domain, behavior, {
    checkType,
    expression,
  });
  pushContext(context);
}

/**
 * Set verification context from a verify result
 */
export function setVerificationContext(result: VerifyResult): void {
  const context = createISLContext(result.domain, result.behavior, {
    executionId: result.executionId,
    metadata: {
      verdict: result.verdict,
      score: result.score,
      coverage: result.coverage,
      failedCount: result.failed.length,
      passedCount: result.passed.length,
    },
  });

  Sentry.setContext('isl.verification', {
    verdict: result.verdict,
    score: result.score,
    coverage: result.coverage,
    failed_checks: result.failed.map((f) => f.name),
    passed_checks: result.passed.map((p) => p.name),
  });

  pushContext(context);
}

/**
 * Clear all ISL contexts
 */
export function clearAllContexts(): void {
  contextStack.length = 0;
  clearSentryContext();
}

/**
 * Context manager for automatic cleanup
 */
export class ISLContextManager {
  private context: ISLContext;

  constructor(domain: string, behavior?: string, options?: Partial<ISLContext>) {
    this.context = createISLContext(domain, behavior, options);
  }

  /**
   * Enter the context
   */
  enter(): this {
    pushContext(this.context);
    return this;
  }

  /**
   * Exit the context
   */
  exit(): void {
    popContext();
  }

  /**
   * Get the context
   */
  getContext(): ISLContext {
    return this.context;
  }

  /**
   * Update context metadata
   */
  setMetadata(key: string, value: unknown): this {
    this.context.metadata = {
      ...this.context.metadata,
      [key]: value,
    };
    return this;
  }

  /**
   * Run a function within this context
   */
  run<T>(fn: () => T): T {
    return withContext(this.context, fn);
  }

  /**
   * Run an async function within this context
   */
  async runAsync<T>(fn: () => Promise<T>): Promise<T> {
    return withContextAsync(this.context, fn);
  }
}

/**
 * Create a context manager
 */
export function contextManager(
  domain: string,
  behavior?: string,
  options?: Partial<ISLContext>
): ISLContextManager {
  return new ISLContextManager(domain, behavior, options);
}
