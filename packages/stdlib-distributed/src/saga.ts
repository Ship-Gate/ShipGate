// ============================================================================
// ISL Standard Library - Saga Pattern (Distributed Transactions)
// @isl-lang/stdlib-distributed/saga
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export interface Saga<T = unknown> {
  id: string;
  name: string;
  steps: SagaStep<T>[];
  compensationPolicy: CompensationPolicy;
}

export interface SagaStep<T = unknown> {
  name: string;
  action: (context: SagaContext<T>) => Promise<SagaStepResult>;
  compensation: (context: SagaContext<T>) => Promise<CompensationResult>;
  timeout: number; // ms
  retryPolicy?: RetryPolicy;
}

export interface SagaContext<T = unknown> {
  sagaId: string;
  stepIndex: number;
  data: T;
  completedSteps: string[];
  failedStep?: string;
  stepResults: Map<string, unknown>;
}

export type SagaStepResult =
  | { status: 'success'; data: unknown }
  | { status: 'failure'; error: Error; retriable: boolean }
  | { status: 'timeout' };

export type CompensationResult =
  | { status: 'compensated' }
  | { status: 'failed'; error: Error }
  | { status: 'skipped'; reason: string };

export type CompensationPolicy = 'backward' | 'forward' | 'parallel';

export interface RetryPolicy {
  maxAttempts: number;
  backoff: BackoffStrategy;
  jitter: boolean;
}

export type BackoffStrategy =
  | { type: 'constant'; delay: number }
  | { type: 'linear'; initial: number; increment: number }
  | { type: 'exponential'; initial: number; multiplier: number; max: number }
  | { type: 'fibonacci'; initial: number; max: number };

export type SagaStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'compensating'
  | 'compensated'
  | 'failed';

export interface SagaExecution<T = unknown> {
  saga: Saga<T>;
  status: SagaStatus;
  context: SagaContext<T>;
  startedAt: Date;
  completedAt?: Date;
  error?: Error;
  compensationErrors: Error[];
}

export interface SagaResult<T = unknown> {
  sagaId: string;
  status: 'completed' | 'compensated' | 'partially_compensated' | 'failed';
  finalData: T;
  completedSteps: string[];
  duration: number;
  error?: Error;
}

// ============================================================================
// SAGA BUILDER
// ============================================================================

export class SagaBuilder<T = unknown> {
  private steps: SagaStep<T>[] = [];
  private compensationPolicy: CompensationPolicy = 'backward';

  constructor(private name: string) {}

  /**
   * Add a step to the saga.
   */
  step(
    name: string,
    action: SagaStep<T>['action'],
    compensation: SagaStep<T>['compensation'],
    options: { timeout?: number; retryPolicy?: RetryPolicy } = {}
  ): this {
    this.steps.push({
      name,
      action,
      compensation,
      timeout: options.timeout ?? 30000,
      retryPolicy: options.retryPolicy,
    });
    return this;
  }

  /**
   * Set compensation policy.
   */
  withCompensationPolicy(policy: CompensationPolicy): this {
    this.compensationPolicy = policy;
    return this;
  }

  /**
   * Build the saga.
   */
  build(): Saga<T> {
    return {
      id: crypto.randomUUID(),
      name: this.name,
      steps: this.steps,
      compensationPolicy: this.compensationPolicy,
    };
  }
}

export function saga<T>(name: string): SagaBuilder<T> {
  return new SagaBuilder<T>(name);
}

// ============================================================================
// SAGA EXECUTOR
// ============================================================================

export class SagaExecutor<T = unknown> {
  private executions = new Map<string, SagaExecution<T>>();

  /**
   * Execute a saga.
   */
  async execute(sagaDef: Saga<T>, initialData: T): Promise<SagaResult<T>> {
    const sagaId = crypto.randomUUID();
    const startedAt = new Date();

    const context: SagaContext<T> = {
      sagaId,
      stepIndex: 0,
      data: initialData,
      completedSteps: [],
      stepResults: new Map(),
    };

    const execution: SagaExecution<T> = {
      saga: sagaDef,
      status: 'running',
      context,
      startedAt,
      compensationErrors: [],
    };

    this.executions.set(sagaId, execution);

    try {
      // Execute forward steps
      for (let i = 0; i < sagaDef.steps.length; i++) {
        const step = sagaDef.steps[i];
        if (!step) continue;
        
        context.stepIndex = i;

        const result = await this.executeStep(step, context);

        if (result.status === 'success') {
          context.completedSteps.push(step.name);
          context.stepResults.set(step.name, result.data);
        } else {
          // Step failed - initiate compensation
          context.failedStep = step.name;
          const error = result.status === 'failure' 
            ? result.error 
            : new Error('Step timeout');

          await this.compensate(execution, error);

          const completedAt = new Date();
          execution.status = execution.compensationErrors.length > 0 
            ? 'failed' 
            : 'compensated';
          execution.completedAt = completedAt;

          return {
            sagaId,
            status: execution.compensationErrors.length > 0 
              ? 'partially_compensated' 
              : 'compensated',
            finalData: context.data,
            completedSteps: context.completedSteps,
            duration: completedAt.getTime() - startedAt.getTime(),
            error,
          };
        }
      }

      // All steps completed successfully
      execution.status = 'completed';
      execution.completedAt = new Date();

      return {
        sagaId,
        status: 'completed',
        finalData: context.data,
        completedSteps: context.completedSteps,
        duration: execution.completedAt.getTime() - startedAt.getTime(),
      };
    } catch (error) {
      execution.status = 'failed';
      execution.error = error as Error;
      execution.completedAt = new Date();

      return {
        sagaId,
        status: 'failed',
        finalData: context.data,
        completedSteps: context.completedSteps,
        duration: execution.completedAt.getTime() - startedAt.getTime(),
        error: error as Error,
      };
    }
  }

  /**
   * Execute a single step with retry support.
   */
  private async executeStep(
    step: SagaStep<T>,
    context: SagaContext<T>
  ): Promise<SagaStepResult> {
    const maxAttempts = step.retryPolicy?.maxAttempts ?? 1;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const delay = this.calculateDelay(step.retryPolicy!, attempt);
        await this.sleep(delay);
      }

      try {
        const result = await Promise.race([
          step.action(context),
          this.timeout(step.timeout),
        ]);

        if (result.status === 'success') {
          return result;
        }

        if (result.status === 'failure') {
          if (!result.retriable || attempt === maxAttempts - 1) {
            return result;
          }
          lastError = result.error;
        }

        if (result.status === 'timeout') {
          if (attempt === maxAttempts - 1) {
            return result;
          }
        }
      } catch (error) {
        lastError = error as Error;
        if (attempt === maxAttempts - 1) {
          return { status: 'failure', error: lastError, retriable: false };
        }
      }
    }

    return { 
      status: 'failure', 
      error: lastError ?? new Error('Unknown error'), 
      retriable: false 
    };
  }

  /**
   * Compensate completed steps.
   */
  private async compensate(
    execution: SagaExecution<T>,
    error: Error
  ): Promise<void> {
    execution.status = 'compensating';
    execution.error = error;
    const { saga, context } = execution;

    const stepsToCompensate = saga.steps
      .slice(0, context.completedSteps.length)
      .reverse();

    if (saga.compensationPolicy === 'parallel') {
      // Compensate all in parallel
      const results = await Promise.allSettled(
        stepsToCompensate.map(step => step.compensation(context))
      );

      for (const result of results) {
        if (result.status === 'rejected') {
          execution.compensationErrors.push(result.reason as Error);
        } else if (result.value.status === 'failed') {
          execution.compensationErrors.push(result.value.error);
        }
      }
    } else {
      // Compensate sequentially (backward or forward)
      const orderedSteps = saga.compensationPolicy === 'forward'
        ? stepsToCompensate.reverse()
        : stepsToCompensate;

      for (const step of orderedSteps) {
        try {
          const result = await step.compensation(context);
          if (result.status === 'failed') {
            execution.compensationErrors.push(result.error);
          }
        } catch (err) {
          execution.compensationErrors.push(err as Error);
        }
      }
    }
  }

  /**
   * Calculate delay based on backoff strategy.
   */
  private calculateDelay(policy: RetryPolicy, attempt: number): number {
    let delay: number;

    switch (policy.backoff.type) {
      case 'constant':
        delay = policy.backoff.delay;
        break;

      case 'linear':
        delay = policy.backoff.initial + attempt * policy.backoff.increment;
        break;

      case 'exponential':
        delay = Math.min(
          policy.backoff.initial * Math.pow(policy.backoff.multiplier, attempt),
          policy.backoff.max
        );
        break;

      case 'fibonacci':
        delay = Math.min(this.fibonacci(attempt) * policy.backoff.initial, policy.backoff.max);
        break;

      default:
        delay = 1000;
    }

    if (policy.jitter) {
      delay = delay * (0.5 + Math.random());
    }

    return delay;
  }

  private fibonacci(n: number): number {
    if (n <= 1) return 1;
    let a = 1, b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private timeout(ms: number): Promise<SagaStepResult> {
    return new Promise(resolve => 
      setTimeout(() => resolve({ status: 'timeout' }), ms)
    );
  }

  /**
   * Get execution status.
   */
  getExecution(sagaId: string): SagaExecution<T> | undefined {
    return this.executions.get(sagaId);
  }
}

// ============================================================================
// SAGA HELPERS
// ============================================================================

/**
 * Create a simple action step result.
 */
export function success(data: unknown = null): SagaStepResult {
  return { status: 'success', data };
}

/**
 * Create a failure step result.
 */
export function failure(error: Error, retriable = false): SagaStepResult {
  return { status: 'failure', error, retriable };
}

/**
 * Create a compensated result.
 */
export function compensated(): CompensationResult {
  return { status: 'compensated' };
}

/**
 * Create a skipped compensation result.
 */
export function skipped(reason: string): CompensationResult {
  return { status: 'skipped', reason };
}

/**
 * Create an exponential backoff retry policy.
 */
export function exponentialBackoff(options: {
  maxAttempts?: number;
  initial?: number;
  multiplier?: number;
  max?: number;
  jitter?: boolean;
}): RetryPolicy {
  return {
    maxAttempts: options.maxAttempts ?? 3,
    backoff: {
      type: 'exponential',
      initial: options.initial ?? 100,
      multiplier: options.multiplier ?? 2,
      max: options.max ?? 10000,
    },
    jitter: options.jitter ?? true,
  };
}
