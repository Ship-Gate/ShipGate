/**
 * Workflow Engine
 * Core execution engine for workflow/saga patterns
 */

import { v4 as uuid } from 'uuid';
import type {
  Workflow,
  WorkflowId,
  Step,
  StepDefinition,
  StepHandler,
  CompensationHandler,
  StepExecutionContext,
  CompensationContext,
  StepError,
  WorkflowResult,
  WorkflowProgress,
  WorkflowStatusInfo,
  WorkflowEngineConfig,
  WorkflowEventType,
  Logger,
  ListWorkflowsQuery,
  ListWorkflowsResult,
} from './types';
import {
  WorkflowStatus,
  StepStatus,
  RetryStrategy,
  FailureAction,
} from './types';

// ============================================
// Default Logger
// ============================================

const defaultLogger: Logger = {
  debug: (msg, meta) => {
    if (process.env.DEBUG) {
      console.debug(`[workflow:debug] ${msg}`, meta);
    }
  },
  info: (msg, meta) => console.info(`[workflow:info] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[workflow:warn] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[workflow:error] ${msg}`, meta ?? ''),
};

// ============================================
// Workflow Engine
// ============================================

export class WorkflowEngine {
  private workflows: Map<WorkflowId, Workflow> = new Map();
  private handlers: Map<string, StepHandler> = new Map();
  private compensationHandlers: Map<string, CompensationHandler> = new Map();
  private config: Required<WorkflowEngineConfig>;
  private logger: Logger;

  constructor(config: WorkflowEngineConfig = {}) {
    this.config = {
      maxConcurrentWorkflows: config.maxConcurrentWorkflows ?? 100,
      defaultStepTimeout: config.defaultStepTimeout ?? 30000,
      defaultRetryConfig: config.defaultRetryConfig ?? {
        strategy: RetryStrategy.EXPONENTIAL,
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        multiplier: 2,
      },
      onEvent: config.onEvent ?? (() => {}),
      logger: config.logger ?? defaultLogger,
    };
    this.logger = this.config.logger;
  }

  // ============================================
  // Handler Registration
  // ============================================

  /**
   * Register a step handler
   */
  registerHandler(name: string, handler: StepHandler): void {
    this.handlers.set(name, handler);
    this.logger.debug(`Registered handler: ${name}`);
  }

  /**
   * Register a compensation handler
   */
  registerCompensationHandler(
    name: string,
    handler: CompensationHandler
  ): void {
    this.compensationHandlers.set(name, handler);
    this.logger.debug(`Registered compensation handler: ${name}`);
  }

  /**
   * Check if a handler is registered
   */
  hasHandler(name: string): boolean {
    return this.handlers.has(name);
  }

  // ============================================
  // Workflow Creation & Execution
  // ============================================

  /**
   * Start a new workflow
   */
  async start(
    name: string,
    steps: StepDefinition[],
    options: {
      initialContext?: Record<string, unknown>;
      correlationId?: string;
      metadata?: Record<string, string>;
      description?: string;
    } = {}
  ): Promise<WorkflowResult<Workflow>> {
    // Validate
    const validation = this.validateWorkflowDefinition(steps);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'INVALID_WORKFLOW',
          message: validation.message!,
          timestamp: new Date(),
        },
      };
    }

    // Check handler registration
    for (const step of steps) {
      if (!this.handlers.has(step.handler)) {
        return {
          success: false,
          error: {
            code: 'INVALID_HANDLER',
            message: `Unknown handler: ${step.handler}`,
            timestamp: new Date(),
          },
        };
      }
    }

    // Create workflow
    const workflowId = uuid();
    const now = new Date();

    const workflowSteps: Step[] = steps.map((def) => this.createStep(workflowId, def));

    // workflowSteps is guaranteed non-empty by validateWorkflowDefinition
    const firstStep = workflowSteps[0]!;
    const workflow: Workflow = {
      id: workflowId,
      name,
      description: options.description,
      status: WorkflowStatus.RUNNING,
      currentStep: firstStep.id,
      context: options.initialContext ?? {},
      steps: workflowSteps,
      compensationStack: [],
      createdAt: now,
      startedAt: now,
      correlationId: options.correlationId,
      metadata: options.metadata,
      version: 1,
    };

    this.workflows.set(workflowId, workflow);

    this.emitEvent({
      type: 'WORKFLOW_STARTED',
      workflowId,
      timestamp: now,
      payload: {
        name,
        stepCount: steps.length,
        correlationId: options.correlationId,
      },
    });

    this.logger.info(`Workflow started: ${name}`, { workflowId });

    // Execute first step
    await this.executeCurrentStep(workflow);

    return { success: true, data: this.workflows.get(workflowId)! };
  }

  /**
   * Create a workflow without starting execution
   */
  async create(
    name: string,
    steps: StepDefinition[],
    options: {
      initialContext?: Record<string, unknown>;
      correlationId?: string;
      metadata?: Record<string, string>;
      description?: string;
    } = {}
  ): Promise<WorkflowResult<Workflow>> {
    const validation = this.validateWorkflowDefinition(steps);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'INVALID_WORKFLOW',
          message: validation.message!,
          timestamp: new Date(),
        },
      };
    }

    const workflowId = uuid();
    const workflowSteps: Step[] = steps.map((def) => this.createStep(workflowId, def));

    const workflow: Workflow = {
      id: workflowId,
      name,
      description: options.description,
      status: WorkflowStatus.PENDING,
      context: options.initialContext ?? {},
      steps: workflowSteps,
      compensationStack: [],
      createdAt: new Date(),
      correlationId: options.correlationId,
      metadata: options.metadata,
      version: 1,
    };

    this.workflows.set(workflowId, workflow);
    return { success: true, data: workflow };
  }

  /**
   * Resume a pending or paused workflow
   */
  async resume(
    workflowId: WorkflowId,
    updatedContext?: Record<string, unknown>
  ): Promise<WorkflowResult<Workflow>> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return {
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow not found: ${workflowId}`,
          timestamp: new Date(),
        },
      };
    }

    if (workflow.status !== WorkflowStatus.PAUSED && workflow.status !== WorkflowStatus.PENDING) {
      return {
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: `Cannot resume workflow in ${workflow.status} state`,
          timestamp: new Date(),
        },
      };
    }

    if (updatedContext) {
      workflow.context = { ...workflow.context, ...updatedContext };
    }

    if (workflow.status === WorkflowStatus.PENDING) {
      workflow.startedAt = new Date();
      // Workflow steps are validated non-empty during creation
      const firstStep = workflow.steps[0]!;
      workflow.currentStep = firstStep.id;
    }

    workflow.status = WorkflowStatus.RUNNING;
    workflow.version++;

    this.logger.info(`Workflow resumed: ${workflow.name}`, { workflowId });

    await this.executeCurrentStep(workflow);

    return { success: true, data: workflow };
  }

  // ============================================
  // Step Execution
  // ============================================

  private async executeCurrentStep(workflow: Workflow): Promise<void> {
    if (!workflow.currentStep) {
      return;
    }

    const step = workflow.steps.find((s) => s.id === workflow.currentStep);
    if (!step) {
      this.logger.error(`Step not found: ${workflow.currentStep}`);
      return;
    }

    // Check condition
    if (step.condition) {
      const shouldExecute = this.evaluateCondition(step.condition, workflow.context);
      if (!shouldExecute) {
        step.status = StepStatus.SKIPPED;
        step.skipReason = 'Condition not met';
        this.logger.info(`Step skipped: ${step.name}`, {
          workflowId: workflow.id,
          stepId: step.id,
        });
        await this.transitionToNextStep(workflow, step);
        return;
      }
    }

    // Execute step
    step.status = StepStatus.RUNNING;
    step.startedAt = new Date();
    step.attempt++;

    const handler = this.handlers.get(step.handler);
    if (!handler) {
      await this.handleStepFailure(workflow, step, {
        code: 'HANDLER_NOT_FOUND',
        message: `Handler not registered: ${step.handler}`,
        attempt: step.attempt,
        recoverable: false,
      });
      return;
    }

    const ctx: StepExecutionContext = {
      workflowId: workflow.id,
      stepId: step.id,
      context: workflow.context,
      input: step.input,
      attempt: step.attempt,
      timeout: step.timeout ?? this.config.defaultStepTimeout,
    };

    try {
      const result = await this.executeWithTimeout(
        handler(ctx),
        step.timeout ?? this.config.defaultStepTimeout
      );

      if (result.success) {
        step.status = StepStatus.COMPLETED;
        step.output = result.output;
        step.completedAt = new Date();

        // Add to compensation stack if compensatable
        if (step.compensationHandler) {
          workflow.compensationStack.push(step.id);
        }

        // Merge output to context
        if (result.output) {
          workflow.context = { ...workflow.context, ...result.output };
        }

        this.logger.info(`Step completed: ${step.name}`, {
          workflowId: workflow.id,
          stepId: step.id,
        });

        await this.transitionToNextStep(workflow, step);
      } else {
        await this.handleStepFailure(workflow, step, result.error ?? {
          code: 'UNKNOWN_ERROR',
          message: 'Step handler returned failure without error',
          attempt: step.attempt,
          recoverable: true,
        });
      }
    } catch (error) {
      await this.handleStepFailure(workflow, step, {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : String(error),
        attempt: step.attempt,
        recoverable: true,
      });
    }
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Step execution timeout')), timeoutMs)
      ),
    ]);
  }

  private async transitionToNextStep(
    workflow: Workflow,
    completedStep: Step
  ): Promise<void> {
    const currentIndex = workflow.steps.findIndex((s) => s.id === completedStep.id);
    const nextStep = workflow.steps[currentIndex + 1];

    if (nextStep) {
      const fromStep = workflow.currentStep!;
      workflow.currentStep = nextStep.id;
      workflow.version++;

      this.emitEvent({
        type: 'STEP_TRANSITIONED',
        workflowId: workflow.id,
        timestamp: new Date(),
        payload: {
          fromStep,
          toStep: nextStep.id,
        },
      });

      await this.executeCurrentStep(workflow);
    } else {
      // Workflow complete
      await this.completeWorkflow(workflow);
    }
  }

  private async handleStepFailure(
    workflow: Workflow,
    step: Step,
    error: StepError
  ): Promise<void> {
    step.status = StepStatus.FAILED;
    step.error = error;

    this.logger.warn(`Step failed: ${step.name}`, {
      workflowId: workflow.id,
      stepId: step.id,
      error,
    });

    // Check retry
    if (error.recoverable && step.attempt < step.maxRetries) {
      const delay = this.calculateRetryDelay(step);
      step.nextRetryAt = new Date(Date.now() + delay);

      this.logger.info(`Scheduling step retry: ${step.name}`, {
        workflowId: workflow.id,
        stepId: step.id,
        attempt: step.attempt + 1,
        delayMs: delay,
      });

      // Schedule retry
      setTimeout(async () => {
        step.error = undefined;
        step.status = StepStatus.PENDING;
        await this.executeCurrentStep(workflow);
      }, delay);

      return;
    }

    // Handle failure based on action
    const action = step.onFailure;

    switch (action) {
      case FailureAction.FAIL_WORKFLOW:
        await this.failWorkflow(workflow, step, error);
        break;

      case FailureAction.COMPENSATE:
        await this.compensate(workflow.id, `Step ${step.id} failed: ${error.message}`);
        break;

      case FailureAction.SKIP:
        step.status = StepStatus.SKIPPED;
        step.skipReason = `Failed: ${error.message}`;
        await this.transitionToNextStep(workflow, step);
        break;

      case FailureAction.PAUSE:
        workflow.status = WorkflowStatus.PAUSED;
        workflow.version++;
        this.logger.info(`Workflow paused for intervention`, {
          workflowId: workflow.id,
          stepId: step.id,
        });
        break;
    }
  }

  // ============================================
  // Workflow State Management
  // ============================================

  private async completeWorkflow(workflow: Workflow): Promise<void> {
    workflow.status = WorkflowStatus.COMPLETED;
    workflow.currentStep = undefined;
    workflow.completedAt = new Date();
    workflow.version++;

    const stepsCompleted = workflow.steps.filter(
      (s) => s.status === StepStatus.COMPLETED
    ).length;
    const stepsSkipped = workflow.steps.filter(
      (s) => s.status === StepStatus.SKIPPED
    ).length;
    const durationMs = workflow.completedAt.getTime() - workflow.startedAt!.getTime();

    this.emitEvent({
      type: 'WORKFLOW_COMPLETED',
      workflowId: workflow.id,
      timestamp: new Date(),
      payload: {
        durationMs,
        stepsCompleted,
        stepsSkipped,
      },
    });

    this.logger.info(`Workflow completed: ${workflow.name}`, {
      workflowId: workflow.id,
      durationMs,
      stepsCompleted,
      stepsSkipped,
    });
  }

  private async failWorkflow(
    workflow: Workflow,
    step: Step,
    error: StepError
  ): Promise<void> {
    workflow.status = WorkflowStatus.FAILED;
    workflow.completedAt = new Date();
    workflow.error = {
      code: 'STEP_FAILED',
      message: error.message,
      stepId: step.id,
      details: error.details,
      timestamp: new Date(),
    };
    workflow.version++;

    this.emitEvent({
      type: 'WORKFLOW_FAILED',
      workflowId: workflow.id,
      timestamp: new Date(),
      payload: {
        stepId: step.id,
        error,
      },
    });

    this.logger.error(`Workflow failed: ${workflow.name}`, {
      workflowId: workflow.id,
      stepId: step.id,
      error,
    });
  }

  /**
   * Pause a running workflow
   */
  async pause(workflowId: WorkflowId, reason?: string): Promise<WorkflowResult<Workflow>> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return {
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow not found: ${workflowId}`,
          timestamp: new Date(),
        },
      };
    }

    if (workflow.status !== WorkflowStatus.RUNNING) {
      return {
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: `Cannot pause workflow in ${workflow.status} state`,
          timestamp: new Date(),
        },
      };
    }

    workflow.status = WorkflowStatus.PAUSED;
    workflow.version++;

    this.logger.info(`Workflow paused: ${workflow.name}`, { workflowId, reason });

    return { success: true, data: workflow };
  }

  /**
   * Cancel a workflow
   */
  async cancel(
    workflowId: WorkflowId,
    options: { reason?: string; skipCompensation?: boolean } = {}
  ): Promise<WorkflowResult<Workflow>> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return {
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow not found: ${workflowId}`,
          timestamp: new Date(),
        },
      };
    }

    const cancellableStatuses = [
      WorkflowStatus.PENDING,
      WorkflowStatus.RUNNING,
      WorkflowStatus.PAUSED,
    ];

    if (!cancellableStatuses.includes(workflow.status)) {
      return {
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: `Cannot cancel workflow in ${workflow.status} state`,
          timestamp: new Date(),
        },
      };
    }

    if (workflow.compensationStack.length > 0 && !options.skipCompensation) {
      return this.compensate(workflowId, options.reason ?? 'Workflow cancelled');
    }

    workflow.status = WorkflowStatus.CANCELLED;
    workflow.completedAt = new Date();
    workflow.version++;

    if (options.reason) {
      workflow.error = {
        code: 'CANCELLED',
        message: options.reason,
        timestamp: new Date(),
      };
    }

    this.logger.info(`Workflow cancelled: ${workflow.name}`, {
      workflowId,
      reason: options.reason,
    });

    return { success: true, data: workflow };
  }

  // ============================================
  // Compensation (Saga Pattern)
  // ============================================

  /**
   * Trigger compensation for a workflow
   */
  async compensate(
    workflowId: WorkflowId,
    reason?: string
  ): Promise<WorkflowResult<Workflow>> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return {
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow not found: ${workflowId}`,
          timestamp: new Date(),
        },
      };
    }

    const compensatableStatuses = [
      WorkflowStatus.RUNNING,
      WorkflowStatus.FAILED,
      WorkflowStatus.PAUSED,
    ];

    if (!compensatableStatuses.includes(workflow.status)) {
      return {
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: `Cannot compensate workflow in ${workflow.status} state`,
          timestamp: new Date(),
        },
      };
    }

    if (workflow.compensationStack.length === 0) {
      // No compensation needed, just mark as compensated
      workflow.status = WorkflowStatus.COMPENSATED;
      workflow.completedAt = new Date();
      workflow.version++;
      return { success: true, data: workflow };
    }

    workflow.status = WorkflowStatus.COMPENSATING;
    workflow.error = {
      code: 'COMPENSATION_TRIGGERED',
      message: reason ?? 'Compensation triggered',
      timestamp: new Date(),
    };
    workflow.version++;

    this.emitEvent({
      type: 'COMPENSATION_STARTED',
      workflowId,
      timestamp: new Date(),
      payload: {
        reason,
        stepsToCompensate: workflow.compensationStack.length,
      },
    });

    this.logger.info(`Compensation started: ${workflow.name}`, {
      workflowId,
      reason,
      stepsToCompensate: workflow.compensationStack.length,
    });

    await this.executeCompensationStack(workflow);

    return { success: true, data: workflow };
  }

  private async executeCompensationStack(workflow: Workflow): Promise<void> {
    const stack = [...workflow.compensationStack].reverse(); // LIFO

    for (const stepId of stack) {
      const step = workflow.steps.find((s) => s.id === stepId);
      if (!step || !step.compensationHandler) {
        continue;
      }

      step.status = StepStatus.COMPENSATING;

      const handler = this.compensationHandlers.get(step.compensationHandler);
      if (!handler) {
        this.logger.warn(`Compensation handler not found: ${step.compensationHandler}`, {
          workflowId: workflow.id,
          stepId,
        });
        continue;
      }

      const ctx: CompensationContext = {
        workflowId: workflow.id,
        stepId,
        context: workflow.context,
        input: step.input,
        attempt: 1,
        originalInput: step.input,
        originalOutput: step.output,
      };

      try {
        const result = await handler(ctx);

        if (result.success) {
          step.status = StepStatus.COMPENSATED;
          this.logger.info(`Step compensated: ${step.name}`, {
            workflowId: workflow.id,
            stepId,
          });
        } else {
          this.logger.error(`Compensation failed: ${step.name}`, {
            workflowId: workflow.id,
            stepId,
            error: result.error,
          });
          // Continue with remaining compensations
        }
      } catch (error) {
        this.logger.error(`Compensation error: ${step.name}`, {
          workflowId: workflow.id,
          stepId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with remaining compensations
      }
    }

    // Mark workflow as compensated
    workflow.status = WorkflowStatus.COMPENSATED;
    workflow.completedAt = new Date();
    workflow.version++;

    const compensationStart = workflow.error?.timestamp ?? new Date();
    const durationMs = new Date().getTime() - compensationStart.getTime();

    this.emitEvent({
      type: 'COMPENSATION_COMPLETED',
      workflowId: workflow.id,
      timestamp: new Date(),
      payload: {
        stepsCompensated: stack.length,
        durationMs,
      },
    });

    this.logger.info(`Compensation completed: ${workflow.name}`, {
      workflowId: workflow.id,
      stepsCompensated: stack.length,
      durationMs,
    });
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Get workflow by ID
   */
  get(workflowId: WorkflowId): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get workflow status and progress
   */
  getStatus(workflowId: WorkflowId): WorkflowResult<WorkflowStatusInfo> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return {
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow not found: ${workflowId}`,
          timestamp: new Date(),
        },
      };
    }

    const progress = this.calculateProgress(workflow);
    const currentStep = workflow.currentStep
      ? workflow.steps.find((s) => s.id === workflow.currentStep)
      : undefined;

    return {
      success: true,
      data: {
        workflow,
        progress,
        currentStep,
        estimatedTimeRemainingMs: this.estimateRemainingTime(workflow),
      },
    };
  }

  /**
   * List workflows with filtering
   */
  list(query: ListWorkflowsQuery = {}): ListWorkflowsResult {
    let workflows = Array.from(this.workflows.values());

    if (query.status) {
      workflows = workflows.filter((w) => w.status === query.status);
    }

    if (query.name) {
      workflows = workflows.filter((w) => w.name.includes(query.name!));
    }

    if (query.correlationId) {
      workflows = workflows.filter((w) => w.correlationId === query.correlationId);
    }

    if (query.createdAfter) {
      workflows = workflows.filter((w) => w.createdAt >= query.createdAfter!);
    }

    if (query.createdBefore) {
      workflows = workflows.filter((w) => w.createdAt <= query.createdBefore!);
    }

    // Sort by created date descending
    workflows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = workflows.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;

    workflows = workflows.slice(offset, offset + limit);

    return {
      workflows,
      total,
      hasMore: total > offset + workflows.length,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private createStep(workflowId: WorkflowId, def: StepDefinition): Step {
    const retry = def.retry ?? this.config.defaultRetryConfig;

    return {
      id: def.id,
      workflowId,
      name: def.name,
      handler: def.handler,
      compensationHandler: def.compensationHandler,
      status: StepStatus.PENDING,
      input: def.input,
      attempt: 0,
      maxRetries: retry.maxRetries,
      retryStrategy: retry.strategy,
      retryDelayMs: retry.initialDelayMs ?? 1000,
      timeout: def.timeout,
      onFailure: def.onFailure ?? FailureAction.COMPENSATE,
      condition: def.condition,
    };
  }

  private validateWorkflowDefinition(
    steps: StepDefinition[]
  ): { valid: boolean; message?: string } {
    if (steps.length === 0) {
      return { valid: false, message: 'Workflow must have at least one step' };
    }

    const ids = new Set<string>();
    for (const step of steps) {
      if (ids.has(step.id)) {
        return { valid: false, message: `Duplicate step ID: ${step.id}` };
      }
      ids.add(step.id);
    }

    return { valid: true };
  }

  private calculateRetryDelay(step: Step): number {
    const baseDelay = step.retryDelayMs;
    const attempt = step.attempt;

    switch (step.retryStrategy) {
      case RetryStrategy.NONE:
        return 0;

      case RetryStrategy.FIXED_DELAY:
        return baseDelay;

      case RetryStrategy.LINEAR:
        return baseDelay * attempt;

      case RetryStrategy.EXPONENTIAL:
      default:
        const multiplier = this.config.defaultRetryConfig.multiplier ?? 2;
        const delay = baseDelay * Math.pow(multiplier, attempt - 1);
        const maxDelay = this.config.defaultRetryConfig.maxDelayMs ?? 30000;
        return Math.min(delay, maxDelay);
    }
  }

  private evaluateCondition(
    condition: string,
    context: Record<string, unknown>
  ): boolean {
    try {
      // Simple expression evaluation
      // In production, use a proper expression evaluator
      const fn = new Function('ctx', `return ${condition}`);
      return Boolean(fn(context));
    } catch {
      this.logger.warn(`Failed to evaluate condition: ${condition}`);
      return true; // Default to executing
    }
  }

  private calculateProgress(workflow: Workflow): WorkflowProgress {
    const total = workflow.steps.length;
    const completed = workflow.steps.filter(
      (s) => s.status === StepStatus.COMPLETED
    ).length;
    const failed = workflow.steps.filter(
      (s) => s.status === StepStatus.FAILED
    ).length;
    const skipped = workflow.steps.filter(
      (s) => s.status === StepStatus.SKIPPED
    ).length;

    return {
      totalSteps: total,
      completedSteps: completed,
      failedSteps: failed,
      skippedSteps: skipped,
      percentage: ((completed + skipped) / total) * 100,
    };
  }

  private estimateRemainingTime(workflow: Workflow): number | undefined {
    if (workflow.status !== WorkflowStatus.RUNNING) {
      return undefined;
    }

    const completedSteps = workflow.steps.filter(
      (s) => s.status === StepStatus.COMPLETED && s.completedAt && s.startedAt
    );

    if (completedSteps.length === 0) {
      return undefined;
    }

    const avgDuration =
      completedSteps.reduce((sum, s) => {
        return sum + (s.completedAt!.getTime() - s.startedAt!.getTime());
      }, 0) / completedSteps.length;

    const remainingSteps = workflow.steps.filter(
      (s) => s.status === StepStatus.PENDING
    ).length;

    return avgDuration * remainingSteps;
  }

  private emitEvent(event: WorkflowEventType): void {
    try {
      this.config.onEvent(event);
    } catch (error) {
      this.logger.error('Event handler error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create a new workflow engine instance
 */
export function createWorkflowEngine(
  config?: WorkflowEngineConfig
): WorkflowEngine {
  return new WorkflowEngine(config);
}
