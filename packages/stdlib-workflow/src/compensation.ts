/**
 * Compensation Module
 * Advanced compensation strategies and helpers
 */

import {
  WorkflowId,
  StepId,
  CompensationHandler,
  CompensationContext,
  CompensationResult,
  StepError,
  Logger,
} from './types';

// ============================================
// Compensation Types
// ============================================

export interface CompensationAction {
  stepId: StepId;
  handler: CompensationHandler;
  priority: number;
  timeout?: number;
  retries?: number;
}

export interface CompensationPlan {
  workflowId: WorkflowId;
  actions: CompensationAction[];
  strategy: CompensationStrategy;
  onFailure: CompensationFailureStrategy;
}

export enum CompensationStrategy {
  /** Execute compensations in strict reverse order */
  SEQUENTIAL = 'SEQUENTIAL',
  /** Execute independent compensations in parallel */
  PARALLEL = 'PARALLEL',
  /** Execute all compensations regardless of failures */
  BEST_EFFORT = 'BEST_EFFORT',
}

export enum CompensationFailureStrategy {
  /** Stop compensation on first failure */
  STOP_ON_FAILURE = 'STOP_ON_FAILURE',
  /** Continue with remaining compensations */
  CONTINUE_ON_FAILURE = 'CONTINUE_ON_FAILURE',
  /** Retry failed compensation before continuing */
  RETRY_THEN_CONTINUE = 'RETRY_THEN_CONTINUE',
}

export interface CompensationExecutionResult {
  success: boolean;
  totalActions: number;
  completedActions: number;
  failedActions: CompensationFailure[];
  durationMs: number;
}

export interface CompensationFailure {
  stepId: StepId;
  error: StepError;
  attempt: number;
}

// ============================================
// Compensation Executor
// ============================================

export class CompensationExecutor {
  private logger: Logger;
  private defaultTimeout: number;
  private defaultRetries: number;

  constructor(options: {
    logger?: Logger;
    defaultTimeout?: number;
    defaultRetries?: number;
  } = {}) {
    this.logger = options.logger ?? {
      debug: () => {},
      info: (msg) => console.info(`[compensation:info] ${msg}`),
      warn: (msg) => console.warn(`[compensation:warn] ${msg}`),
      error: (msg) => console.error(`[compensation:error] ${msg}`),
    };
    this.defaultTimeout = options.defaultTimeout ?? 30000;
    this.defaultRetries = options.defaultRetries ?? 3;
  }

  /**
   * Execute a compensation plan
   */
  async execute(
    plan: CompensationPlan,
    context: CompensationContext
  ): Promise<CompensationExecutionResult> {
    const startTime = Date.now();
    const failedActions: CompensationFailure[] = [];
    let completedActions = 0;

    // Sort actions by priority (higher priority first)
    const sortedActions = [...plan.actions].sort(
      (a, b) => b.priority - a.priority
    );

    this.logger.info(`Starting compensation: ${sortedActions.length} actions`, {
      workflowId: plan.workflowId,
      strategy: plan.strategy,
    });

    switch (plan.strategy) {
      case CompensationStrategy.SEQUENTIAL:
        for (const action of sortedActions) {
          const result = await this.executeAction(action, context, plan);
          if (result.success) {
            completedActions++;
          } else {
            failedActions.push({
              stepId: action.stepId,
              error: result.error!,
              attempt: result.attempt,
            });

            if (plan.onFailure === CompensationFailureStrategy.STOP_ON_FAILURE) {
              break;
            }
          }
        }
        break;

      case CompensationStrategy.PARALLEL:
        const results = await Promise.all(
          sortedActions.map((action) =>
            this.executeAction(action, context, plan).then((result) => ({
              action,
              result,
            }))
          )
        );

        for (const { action, result } of results) {
          if (result.success) {
            completedActions++;
          } else {
            failedActions.push({
              stepId: action.stepId,
              error: result.error!,
              attempt: result.attempt,
            });
          }
        }
        break;

      case CompensationStrategy.BEST_EFFORT:
        for (const action of sortedActions) {
          try {
            const result = await this.executeAction(action, context, plan);
            if (result.success) {
              completedActions++;
            } else {
              failedActions.push({
                stepId: action.stepId,
                error: result.error!,
                attempt: result.attempt,
              });
            }
          } catch (error) {
            failedActions.push({
              stepId: action.stepId,
              error: {
                code: 'UNEXPECTED_ERROR',
                message: error instanceof Error ? error.message : String(error),
                attempt: 1,
                recoverable: false,
              },
              attempt: 1,
            });
          }
        }
        break;
    }

    const durationMs = Date.now() - startTime;

    this.logger.info(
      `Compensation complete: ${completedActions}/${sortedActions.length} succeeded`,
      {
        workflowId: plan.workflowId,
        durationMs,
        failures: failedActions.length,
      }
    );

    return {
      success: failedActions.length === 0,
      totalActions: sortedActions.length,
      completedActions,
      failedActions,
      durationMs,
    };
  }

  private async executeAction(
    action: CompensationAction,
    context: CompensationContext,
    plan: CompensationPlan
  ): Promise<{ success: boolean; error?: StepError; attempt: number }> {
    const maxRetries = action.retries ?? this.defaultRetries;
    const timeout = action.timeout ?? this.defaultTimeout;
    let lastError: StepError | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeWithTimeout(
          action.handler({
            ...context,
            stepId: action.stepId,
            attempt,
          }),
          timeout
        );

        if (result.success) {
          this.logger.debug(`Compensation succeeded: ${action.stepId}`, {
            attempt,
          });
          return { success: true, attempt };
        }

        lastError = result.error ?? {
          code: 'COMPENSATION_FAILED',
          message: 'Compensation handler returned failure',
          attempt,
          recoverable: attempt < maxRetries,
        };

        if (
          plan.onFailure === CompensationFailureStrategy.RETRY_THEN_CONTINUE &&
          attempt < maxRetries
        ) {
          this.logger.warn(
            `Compensation retry ${attempt}/${maxRetries}: ${action.stepId}`,
            { error: lastError.message }
          );
          await this.delay(1000 * attempt); // Simple backoff
        }
      } catch (error) {
        lastError = {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          attempt,
          recoverable: attempt < maxRetries,
        };

        if (
          plan.onFailure === CompensationFailureStrategy.RETRY_THEN_CONTINUE &&
          attempt < maxRetries
        ) {
          this.logger.warn(
            `Compensation error retry ${attempt}/${maxRetries}: ${action.stepId}`,
            { error: lastError.message }
          );
          await this.delay(1000 * attempt);
        }
      }
    }

    this.logger.error(`Compensation failed after ${maxRetries} attempts: ${action.stepId}`, {
      error: lastError?.message,
    });

    return { success: false, error: lastError, attempt: maxRetries };
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Compensation timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// Compensation Builder
// ============================================

export class CompensationPlanBuilder {
  private workflowId: WorkflowId;
  private actions: CompensationAction[] = [];
  private strategy: CompensationStrategy = CompensationStrategy.SEQUENTIAL;
  private onFailure: CompensationFailureStrategy =
    CompensationFailureStrategy.CONTINUE_ON_FAILURE;

  constructor(workflowId: WorkflowId) {
    this.workflowId = workflowId;
  }

  /**
   * Add a compensation action
   */
  addAction(
    stepId: StepId,
    handler: CompensationHandler,
    options: {
      priority?: number;
      timeout?: number;
      retries?: number;
    } = {}
  ): this {
    this.actions.push({
      stepId,
      handler,
      priority: options.priority ?? this.actions.length,
      timeout: options.timeout,
      retries: options.retries,
    });
    return this;
  }

  /**
   * Set compensation strategy
   */
  withStrategy(strategy: CompensationStrategy): this {
    this.strategy = strategy;
    return this;
  }

  /**
   * Set failure handling strategy
   */
  onFailureStrategy(strategy: CompensationFailureStrategy): this {
    this.onFailure = strategy;
    return this;
  }

  /**
   * Build the compensation plan
   */
  build(): CompensationPlan {
    return {
      workflowId: this.workflowId,
      actions: this.actions,
      strategy: this.strategy,
      onFailure: this.onFailure,
    };
  }
}

// ============================================
// Compensation Helpers
// ============================================

/**
 * Create an idempotent compensation handler
 */
export function idempotentCompensation(
  handler: CompensationHandler,
  checkAlreadyCompensated: (ctx: CompensationContext) => Promise<boolean>
): CompensationHandler {
  return async (ctx) => {
    const alreadyCompensated = await checkAlreadyCompensated(ctx);
    if (alreadyCompensated) {
      return { success: true };
    }
    return handler(ctx);
  };
}

/**
 * Create a compensation handler that logs but doesn't fail
 */
export function logOnlyCompensation(
  description: string,
  logger?: Logger
): CompensationHandler {
  return async (ctx) => {
    const log = logger ?? console;
    log.info(`[compensation] ${description}`, {
      workflowId: ctx.workflowId,
      stepId: ctx.stepId,
      originalOutput: ctx.originalOutput,
    });
    return { success: true };
  };
}

/**
 * Create a compensation handler that calls an external API
 */
export function apiCompensation(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    bodyBuilder?: (ctx: CompensationContext) => Record<string, unknown>;
    timeout?: number;
  } = {}
): CompensationHandler {
  return async (ctx) => {
    try {
      const body = options.bodyBuilder?.(ctx) ?? {
        workflowId: ctx.workflowId,
        stepId: ctx.stepId,
        originalInput: ctx.originalInput,
        originalOutput: ctx.originalOutput,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options.timeout ?? 30000
      );

      const response = await fetch(url, {
        method: options.method ?? 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: 'API_ERROR',
            message: `API returned ${response.status}: ${response.statusText}`,
            attempt: ctx.attempt,
            recoverable: response.status >= 500,
          },
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'API_CALL_FAILED',
          message: error instanceof Error ? error.message : String(error),
          attempt: ctx.attempt,
          recoverable: true,
        },
      };
    }
  };
}

/**
 * Compose multiple compensation handlers
 */
export function composeCompensations(
  handlers: CompensationHandler[]
): CompensationHandler {
  return async (ctx) => {
    for (const handler of handlers) {
      const result = await handler(ctx);
      if (!result.success) {
        return result;
      }
    }
    return { success: true };
  };
}

/**
 * Create a compensation handler with automatic retry
 */
export function withRetry(
  handler: CompensationHandler,
  maxRetries: number = 3,
  delayMs: number = 1000
): CompensationHandler {
  return async (ctx) => {
    let lastResult: CompensationResult = { success: false };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      lastResult = await handler({ ...ctx, attempt });
      if (lastResult.success) {
        return lastResult;
      }

      if (attempt < maxRetries && lastResult.error?.recoverable !== false) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * attempt)
        );
      }
    }

    return lastResult;
  };
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a compensation executor
 */
export function createCompensationExecutor(options?: {
  logger?: Logger;
  defaultTimeout?: number;
  defaultRetries?: number;
}): CompensationExecutor {
  return new CompensationExecutor(options);
}

/**
 * Create a compensation plan builder
 */
export function createCompensationPlan(
  workflowId: WorkflowId
): CompensationPlanBuilder {
  return new CompensationPlanBuilder(workflowId);
}
