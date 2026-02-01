/**
 * Compensation Runner
 * 
 * Handles saga rollback by executing compensation handlers
 * in reverse order (LIFO).
 */

import type {
  Workflow,
  Step,
  StepId,
  StepStatus,
  HandlerContext,
  Result,
} from './types.js';
import { HandlerRegistry } from './handlers.js';
import { WorkflowEventBus } from './events.js';

// ============================================
// Types
// ============================================

export interface CompensationResult {
  compensatedSteps: StepId[];
  failedSteps: StepId[];
  errors: CompensationError[];
}

export interface CompensationError {
  stepId: StepId;
  handler: string;
  error: string;
  continueOnError: boolean;
}

export interface CompensationOptions {
  /** Continue compensation even if a handler fails */
  continueOnError?: boolean;
  /** Maximum time for all compensations */
  timeoutMs?: number;
  /** Parallel compensation (default is sequential/LIFO) */
  parallel?: boolean;
}

// ============================================
// Compensation Runner
// ============================================

export class CompensationRunner {
  private handlers: HandlerRegistry;
  private eventBus: WorkflowEventBus;

  constructor(handlers: HandlerRegistry, eventBus: WorkflowEventBus) {
    this.handlers = handlers;
    this.eventBus = eventBus;
  }

  /**
   * Run compensation for a workflow
   * Executes compensation handlers in reverse order (LIFO)
   */
  async run(
    workflow: Workflow,
    options: CompensationOptions = {}
  ): Promise<Result<CompensationResult, Error>> {
    const {
      continueOnError = true,
      timeoutMs,
      parallel = false,
    } = options;

    const compensatedSteps: StepId[] = [];
    const failedSteps: StepId[] = [];
    const errors: CompensationError[] = [];

    // Get steps to compensate in reverse order
    const stepsToCompensate = [...workflow.compensationStack].reverse();

    if (parallel) {
      // Execute all compensations in parallel
      const results = await Promise.allSettled(
        stepsToCompensate.map((stepId) =>
          this.compensateStep(workflow, stepId)
        )
      );

      results.forEach((result, index) => {
        const stepId = stepsToCompensate[index];
        if (result.status === 'fulfilled') {
          compensatedSteps.push(stepId);
        } else {
          failedSteps.push(stepId);
          errors.push({
            stepId,
            handler: this.getCompensationHandler(workflow, stepId) ?? 'unknown',
            error: result.reason?.message ?? 'Unknown error',
            continueOnError: true,
          });
        }
      });
    } else {
      // Execute compensations sequentially (LIFO)
      for (const stepId of stepsToCompensate) {
        try {
          await this.compensateStep(workflow, stepId);
          compensatedSteps.push(stepId);
          
          // Remove from compensation stack
          const idx = workflow.compensationStack.indexOf(stepId);
          if (idx >= 0) {
            workflow.compensationStack.splice(idx, 1);
          }
        } catch (error) {
          const step = workflow.steps.find((s) => s.id === stepId);
          
          errors.push({
            stepId,
            handler: step?.compensationHandler ?? 'unknown',
            error: (error as Error).message,
            continueOnError,
          });

          if (!continueOnError) {
            return {
              success: false,
              error: new Error(`Compensation failed at step ${stepId}: ${(error as Error).message}`),
            };
          }

          failedSteps.push(stepId);
        }
      }
    }

    return {
      success: true,
      value: {
        compensatedSteps,
        failedSteps,
        errors,
      },
    };
  }

  /**
   * Compensate a single step
   */
  private async compensateStep(workflow: Workflow, stepId: StepId): Promise<void> {
    const step = workflow.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    if (!step.compensationHandler) {
      throw new Error(`No compensation handler for step: ${stepId}`);
    }

    const handler = this.handlers.get(step.compensationHandler);
    if (!handler) {
      throw new Error(`Compensation handler not found: ${step.compensationHandler}`);
    }

    // Update step status
    step.status = StepStatus.COMPENSATING;

    this.eventBus.emit({
      type: 'step.compensation_started',
      workflowId: workflow.id,
      stepId,
      timestamp: new Date(),
    });

    const ctx: HandlerContext = {
      workflowId: workflow.id,
      stepId,
      attempt: 1,
      context: workflow.context,
    };

    try {
      // Pass the original step output to the compensation handler
      await handler(step.output ?? {}, ctx);

      step.status = StepStatus.COMPENSATED;

      this.eventBus.emit({
        type: 'step.compensation_completed',
        workflowId: workflow.id,
        stepId,
        timestamp: new Date(),
      });
    } catch (error) {
      step.status = StepStatus.FAILED;
      throw error;
    }
  }

  private getCompensationHandler(workflow: Workflow, stepId: StepId): string | undefined {
    const step = workflow.steps.find((s) => s.id === stepId);
    return step?.compensationHandler;
  }
}

// ============================================
// Compensation Utilities
// ============================================

/**
 * Create a compensating action that wraps execute and compensate functions
 */
export function compensatingAction<TInput, TOutput>(
  execute: (input: TInput, ctx: HandlerContext) => Promise<TOutput>,
  compensate: (output: TOutput, ctx: HandlerContext) => Promise<void>
): {
  execute: (input: TInput, ctx: HandlerContext) => Promise<TOutput>;
  compensate: (output: TOutput, ctx: HandlerContext) => Promise<void>;
} {
  return { execute, compensate };
}

/**
 * Create a no-op compensation (for steps that don't need rollback)
 */
export function noCompensation(): (output: unknown, ctx: HandlerContext) => Promise<void> {
  return async () => {
    // No-op
  };
}

/**
 * Create a logging compensation (logs but doesn't actually roll back)
 */
export function logCompensation(
  logger: (message: string, data: unknown) => void
): (output: unknown, ctx: HandlerContext) => Promise<void> {
  return async (output, ctx) => {
    logger(`Compensation triggered for step ${ctx.stepId}`, {
      workflowId: ctx.workflowId,
      stepId: ctx.stepId,
      output,
    });
  };
}
