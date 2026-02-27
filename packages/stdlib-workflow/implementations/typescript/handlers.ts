/**
 * Handler Registry
 * 
 * Manages step handler functions for workflow execution.
 */

import type { HandlerFn, HandlerName, HandlerContext } from './types.js';

// ============================================
// Handler Registry
// ============================================

export class HandlerRegistry {
  private handlers: Map<HandlerName, HandlerFn> = new Map();

  /**
   * Register a handler function
   */
  register<TInput = unknown, TOutput = unknown>(
    name: HandlerName,
    handler: HandlerFn<TInput, TOutput>
  ): void {
    if (this.handlers.has(name)) {
      throw new Error(`Handler already registered: ${name}`);
    }
    this.handlers.set(name, handler as HandlerFn);
  }

  /**
   * Register multiple handlers at once
   */
  registerAll(handlers: Record<HandlerName, HandlerFn>): void {
    for (const [name, handler] of Object.entries(handlers)) {
      this.register(name, handler);
    }
  }

  /**
   * Get a handler by name
   */
  get(name: HandlerName): HandlerFn | undefined {
    return this.handlers.get(name);
  }

  /**
   * Check if a handler exists
   */
  has(name: HandlerName): boolean {
    return this.handlers.has(name);
  }

  /**
   * Remove a handler
   */
  unregister(name: HandlerName): boolean {
    return this.handlers.delete(name);
  }

  /**
   * List all registered handler names
   */
  list(): HandlerName[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }
}

// ============================================
// Handler Decorators/Wrappers
// ============================================

/**
 * Wrap a handler with timeout
 */
export function withTimeout<TInput, TOutput>(
  handler: HandlerFn<TInput, TOutput>,
  timeoutMs: number
): HandlerFn<TInput, TOutput> {
  return async (input, ctx) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Handler timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      handler(input, ctx)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  };
}

/**
 * Wrap a handler with retry logic
 */
export function withRetry<TInput, TOutput>(
  handler: HandlerFn<TInput, TOutput>,
  options: {
    maxRetries: number;
    delayMs?: number;
    backoff?: 'fixed' | 'exponential';
    shouldRetry?: (error: Error, attempt: number) => boolean;
  }
): HandlerFn<TInput, TOutput> {
  const {
    maxRetries,
    delayMs = 1000,
    backoff = 'exponential',
    shouldRetry = () => true,
  } = options;

  return async (input, ctx) => {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await handler(input, { ...ctx, attempt });
      } catch (error) {
        lastError = error as Error;
        
        if (attempt > maxRetries || !shouldRetry(lastError, attempt)) {
          throw lastError;
        }

        const delay = backoff === 'exponential'
          ? delayMs * Math.pow(2, attempt - 1)
          : delayMs;

        await sleep(delay);
      }
    }

    throw lastError;
  };
}

/**
 * Wrap a handler with logging
 */
export function withLogging<TInput, TOutput>(
  handler: HandlerFn<TInput, TOutput>,
  logger: {
    info: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
  }
): HandlerFn<TInput, TOutput> {
  return async (input, ctx) => {
    const startTime = Date.now();
    
    logger.info(`Starting handler`, {
      workflowId: ctx.workflowId,
      stepId: ctx.stepId,
      attempt: ctx.attempt,
    });

    try {
      const result = await handler(input, ctx);
      
      logger.info(`Handler completed`, {
        workflowId: ctx.workflowId,
        stepId: ctx.stepId,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error(`Handler failed`, {
        workflowId: ctx.workflowId,
        stepId: ctx.stepId,
        error: (error as Error).message,
        durationMs: Date.now() - startTime,
      });
      throw error;
    }
  };
}

/**
 * Wrap a handler with validation
 */
export function withValidation<TInput, TOutput>(
  handler: HandlerFn<TInput, TOutput>,
  validate: (input: TInput) => void | Promise<void>
): HandlerFn<TInput, TOutput> {
  return async (input, ctx) => {
    await validate(input);
    return handler(input, ctx);
  };
}

/**
 * Create a handler that always succeeds (for testing)
 */
export function alwaysSucceeds<TOutput>(output: TOutput): HandlerFn<unknown, TOutput> {
  return async () => output;
}

/**
 * Create a handler that always fails (for testing)
 */
export function alwaysFails(error: string | Error): HandlerFn<unknown, never> {
  return async () => {
    throw typeof error === 'string' ? new Error(error) : error;
  };
}

/**
 * Create a handler that fails N times then succeeds
 */
export function failsNTimes<TInput, TOutput>(
  n: number,
  error: string | Error,
  successOutput: TOutput
): HandlerFn<TInput, TOutput> {
  let failures = 0;
  
  return async () => {
    if (failures < n) {
      failures++;
      throw typeof error === 'string' ? new Error(error) : error;
    }
    return successOutput;
  };
}

// ============================================
// Utilities
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
