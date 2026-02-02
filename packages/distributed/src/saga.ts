/**
 * ISL Saga Implementation
 * 
 * Distributed transaction coordination using the Saga pattern
 */

import type {
  Saga,
  SagaStep,
  SagaContext,
  SagaResult,
  RetryPolicy,
} from './types';

/**
 * Saga builder for fluent API
 */
export class SagaBuilder<TData = unknown> {
  private saga: Saga<TData>;

  constructor(id: string) {
    this.saga = {
      id,
      steps: [],
    };
  }

  /**
   * Set description
   */
  description(desc: string): this {
    this.saga.description = desc;
    return this;
  }

  /**
   * Add a step
   */
  step(
    name: string,
    execute: SagaStep<TData>['execute'],
    compensate: SagaStep<TData>['compensate'],
    options?: {
      description?: string;
      retryPolicy?: RetryPolicy;
      timeout?: number;
    }
  ): this {
    this.saga.steps.push({
      name,
      execute,
      compensate,
      description: options?.description,
      retryPolicy: options?.retryPolicy,
      timeout: options?.timeout,
    });
    return this;
  }

  /**
   * Set compensation order
   */
  compensationOrder(order: 'reverse' | 'parallel'): this {
    this.saga.compensationOrder = order;
    return this;
  }

  /**
   * Set timeout
   */
  timeout(ms: number): this {
    this.saga.timeout = ms;
    return this;
  }

  /**
   * Build the saga
   */
  build(): Saga<TData> {
    return this.saga;
  }
}

/**
 * Create a new saga builder
 */
export function saga<TData = unknown>(id: string): SagaBuilder<TData> {
  return new SagaBuilder<TData>(id);
}

/**
 * Execute a saga
 */
export async function executeSaga<TData>(
  saga: Saga<TData>,
  initialData: TData,
  options?: {
    onStepStart?: (step: string, data: TData) => void;
    onStepComplete?: (step: string, data: TData) => void;
    onStepFailed?: (step: string, error: Error) => void;
    onCompensating?: (step: string) => void;
  }
): Promise<SagaResult<TData>> {
  const startTime = Date.now();
  const completedSteps: string[] = [];
  const compensatedSteps: string[] = [];
  let currentData = initialData;
  let failedStep: string | undefined;
  let error: Error | undefined;

  // Execute forward steps
  for (let i = 0; i < saga.steps.length; i++) {
    const step = saga.steps[i]!;
    const context: SagaContext = {
      sagaId: saga.id,
      stepIndex: i,
      attempts: 1,
      startTime,
      metadata: {},
    };

    options?.onStepStart?.(step.name, currentData);

    try {
      currentData = await executeStepWithRetry(step, currentData, context);
      completedSteps.push(step.name);
      options?.onStepComplete?.(step.name, currentData);
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      failedStep = step.name;
      options?.onStepFailed?.(step.name, error);
      break;
    }
  }

  // If all steps completed successfully
  if (!failedStep) {
    return {
      status: 'completed',
      data: currentData,
      completedSteps,
      compensatedSteps,
      duration: Date.now() - startTime,
    };
  }

  // Compensate completed steps
  const stepsToCompensate = saga.compensationOrder === 'parallel'
    ? completedSteps
    : [...completedSteps].reverse();

  if (saga.compensationOrder === 'parallel') {
    // Parallel compensation
    await Promise.all(
      stepsToCompensate.map(async (stepName) => {
        const step = saga.steps.find((s: SagaStep<TData>) => s.name === stepName)!;
        options?.onCompensating?.(step.name);
        try {
          const context: SagaContext = {
            sagaId: saga.id,
            stepIndex: saga.steps.indexOf(step),
            attempts: 1,
            startTime,
            metadata: {},
          };
          await step.compensate(currentData, context);
          compensatedSteps.push(step.name);
        } catch {
          // Compensation failed - log but continue
        }
      })
    );
  } else {
    // Sequential compensation (reverse order)
    for (const stepName of stepsToCompensate) {
      const step = saga.steps.find((s: SagaStep<TData>) => s.name === stepName)!;
      options?.onCompensating?.(step.name);
      try {
        const context: SagaContext = {
          sagaId: saga.id,
          stepIndex: saga.steps.indexOf(step),
          attempts: 1,
          startTime,
          metadata: {},
        };
        currentData = await step.compensate(currentData, context);
        compensatedSteps.push(step.name);
      } catch {
        // Compensation failed - log but continue
      }
    }
  }

  return {
    status: compensatedSteps.length === completedSteps.length ? 'compensated' : 'failed',
    data: currentData,
    completedSteps,
    compensatedSteps,
    failedStep,
    error,
    duration: Date.now() - startTime,
  };
}

/**
 * Execute a step with retry policy
 */
async function executeStepWithRetry<TData>(
  step: SagaStep<TData>,
  data: TData,
  context: SagaContext
): Promise<TData> {
  const policy = step.retryPolicy ?? {
    maxAttempts: 1,
    initialDelay: 0,
    backoff: 'fixed' as const,
  };

  let lastError: Error | undefined;
  let delay = policy.initialDelay;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      context.attempts = attempt;
      return await withTimeout(
        step.execute(data, context),
        step.timeout ?? 30000
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Check if we should retry this error
      if (policy.ignoreOn?.includes(lastError.name)) {
        throw lastError;
      }

      if (policy.retryOn && !policy.retryOn.includes(lastError.name)) {
        throw lastError;
      }

      if (attempt < policy.maxAttempts) {
        await sleep(delay);

        // Calculate next delay
        if (policy.backoff === 'exponential') {
          delay = Math.min(delay * 2, policy.maxDelay ?? Infinity);
        } else if (policy.backoff === 'linear') {
          delay = Math.min(delay + policy.initialDelay, policy.maxDelay ?? Infinity);
        }
      }
    }
  }

  throw lastError ?? new Error('Step failed');
}

/**
 * Wrap promise with timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate ISL specification from saga
 */
export function sagaToISL<TData>(sagaDef: Saga<TData>): string {
  const lines: string[] = [];

  lines.push(`saga ${sagaDef.id} {`);

  if (sagaDef.description) {
    lines.push(`  // ${sagaDef.description}`);
  }

  if (sagaDef.timeout) {
    lines.push(`  timeout ${sagaDef.timeout}ms;`);
  }

  if (sagaDef.compensationOrder) {
    lines.push(`  compensation ${sagaDef.compensationOrder};`);
  }

  lines.push('');
  lines.push('  steps {');

  for (const step of sagaDef.steps) {
    lines.push(`    step ${step.name} {`);
    if (step.description) {
      lines.push(`      // ${step.description}`);
    }
    lines.push(`      execute: ${step.name}Execute;`);
    lines.push(`      compensate: ${step.name}Compensate;`);
    if (step.timeout) {
      lines.push(`      timeout: ${step.timeout}ms;`);
    }
    if (step.retryPolicy) {
      lines.push(`      retry: { maxAttempts: ${step.retryPolicy.maxAttempts}, backoff: "${step.retryPolicy.backoff}" };`);
    }
    lines.push('    }');
  }

  lines.push('  }');
  lines.push('}');

  return lines.join('\n');
}
