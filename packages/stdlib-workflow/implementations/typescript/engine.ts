/**
 * Workflow Engine
 * 
 * Core execution engine for workflows with step management,
 * retries, and state tracking.
 */

import { randomUUID } from 'crypto';
import type {
  Workflow,
  WorkflowId,
  Step,
  StepId,
  StepDefinition,
  WorkflowStatus,
  StepStatus,
  WorkflowContext,
  WorkflowError,
  StepError,
  StartWorkflowInput,
  TransitionInput,
  WorkflowEngineConfig,
  HandlerContext,
  Result,
  RetryConfig,
  RetryStrategy,
  FailureAction,
} from './types.js';
import { HandlerRegistry } from './handlers.js';
import { CompensationRunner } from './compensation.js';
import { WorkflowEventBus } from './events.js';

export class WorkflowEngine {
  private workflows: Map<WorkflowId, Workflow> = new Map();
  private handlers: HandlerRegistry;
  private compensationRunner: CompensationRunner;
  private eventBus: WorkflowEventBus;
  private config: WorkflowEngineConfig;

  constructor(config: WorkflowEngineConfig = {}) {
    this.config = {
      defaultTimeoutMs: 30000,
      defaultRetry: {
        strategy: RetryStrategy.NONE,
        maxRetries: 0,
      },
      ...config,
    };
    
    this.handlers = new HandlerRegistry();
    this.eventBus = new WorkflowEventBus();
    this.compensationRunner = new CompensationRunner(this.handlers, this.eventBus);
  }

  /**
   * Get the handler registry for registering step handlers
   */
  getHandlers(): HandlerRegistry {
    return this.handlers;
  }

  /**
   * Get the event bus for subscribing to workflow events
   */
  getEventBus(): WorkflowEventBus {
    return this.eventBus;
  }

  /**
   * Start a new workflow
   */
  async startWorkflow(input: StartWorkflowInput): Promise<Result<Workflow, WorkflowError>> {
    // Validate input
    const validationError = this.validateWorkflowInput(input);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Create workflow
    const workflowId = randomUUID();
    const now = new Date();
    
    const steps: Step[] = input.steps.map((def) => this.createStep(workflowId, def));
    
    const workflow: Workflow = {
      id: workflowId,
      name: input.name,
      description: input.description,
      status: WorkflowStatus.RUNNING,
      currentStep: steps[0]?.id,
      context: input.initialContext ?? {},
      steps,
      compensationStack: [],
      createdAt: now,
      startedAt: now,
      metadata: input.metadata,
      correlationId: input.correlationId,
    };

    this.workflows.set(workflowId, workflow);
    
    this.eventBus.emit({
      type: 'workflow.started',
      workflowId,
      timestamp: now,
      data: { name: input.name, stepsCount: steps.length },
    });

    // Start first step
    await this.executeCurrentStep(workflow);

    return { success: true, value: this.workflows.get(workflowId)! };
  }

  /**
   * Get a workflow by ID
   */
  getWorkflow(id: WorkflowId): Workflow | null {
    return this.workflows.get(id) ?? null;
  }

  /**
   * Transition to the next step
   */
  async transition(input: TransitionInput): Promise<Result<Workflow, WorkflowError>> {
    const workflow = this.workflows.get(input.workflowId);
    
    if (!workflow) {
      return {
        success: false,
        error: this.createError('WORKFLOW_NOT_FOUND', 'Workflow not found'),
      };
    }

    if (workflow.status !== WorkflowStatus.RUNNING) {
      return {
        success: false,
        error: this.createError('INVALID_STATE', `Cannot transition: workflow is ${workflow.status}`),
      };
    }

    const currentStep = this.getCurrentStep(workflow);
    if (!currentStep || currentStep.status !== StepStatus.COMPLETED) {
      return {
        success: false,
        error: this.createError('STEP_NOT_COMPLETE', 'Current step has not completed'),
      };
    }

    // Merge step output into context
    if (input.stepOutput) {
      workflow.context = { ...workflow.context, ...input.stepOutput };
    }

    // Add to compensation stack if step has compensation handler
    if (currentStep.compensationHandler) {
      workflow.compensationStack.push(currentStep.id);
    }

    // Find next step
    const currentIndex = workflow.steps.findIndex((s) => s.id === workflow.currentStep);
    const nextStep = workflow.steps[currentIndex + 1];

    if (!nextStep) {
      // Workflow complete
      return this.completeWorkflow(workflow);
    }

    // Check if next step should be skipped (conditional)
    const shouldSkip = await this.shouldSkipStep(nextStep, workflow);
    if (shouldSkip) {
      nextStep.status = StepStatus.SKIPPED;
      workflow.currentStep = nextStep.id;
      
      this.eventBus.emit({
        type: 'step.skipped',
        workflowId: workflow.id,
        stepId: nextStep.id,
        timestamp: new Date(),
      });

      // Recursively transition to next
      return this.transition({ workflowId: workflow.id });
    }

    // Move to next step
    workflow.currentStep = nextStep.id;
    
    // Execute next step
    await this.executeCurrentStep(workflow);

    return { success: true, value: workflow };
  }

  /**
   * Pause a running workflow
   */
  async pauseWorkflow(workflowId: WorkflowId, reason?: string): Promise<Result<Workflow, WorkflowError>> {
    const workflow = this.workflows.get(workflowId);
    
    if (!workflow) {
      return { success: false, error: this.createError('WORKFLOW_NOT_FOUND', 'Workflow not found') };
    }

    if (workflow.status !== WorkflowStatus.RUNNING) {
      return { success: false, error: this.createError('INVALID_STATE', 'Workflow is not running') };
    }

    workflow.status = WorkflowStatus.PAUSED;
    
    this.eventBus.emit({
      type: 'workflow.paused',
      workflowId,
      timestamp: new Date(),
      data: { reason },
    });

    return { success: true, value: workflow };
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(workflowId: WorkflowId): Promise<Result<Workflow, WorkflowError>> {
    const workflow = this.workflows.get(workflowId);
    
    if (!workflow) {
      return { success: false, error: this.createError('WORKFLOW_NOT_FOUND', 'Workflow not found') };
    }

    if (workflow.status !== WorkflowStatus.PAUSED) {
      return { success: false, error: this.createError('INVALID_STATE', 'Workflow is not paused') };
    }

    workflow.status = WorkflowStatus.RUNNING;
    
    this.eventBus.emit({
      type: 'workflow.resumed',
      workflowId,
      timestamp: new Date(),
    });

    // Continue execution
    const currentStep = this.getCurrentStep(workflow);
    if (currentStep && currentStep.status === StepStatus.PENDING) {
      await this.executeCurrentStep(workflow);
    }

    return { success: true, value: workflow };
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(
    workflowId: WorkflowId,
    reason?: string,
    compensate = false
  ): Promise<Result<Workflow, WorkflowError>> {
    const workflow = this.workflows.get(workflowId);
    
    if (!workflow) {
      return { success: false, error: this.createError('WORKFLOW_NOT_FOUND', 'Workflow not found') };
    }

    if (this.isTerminalStatus(workflow.status)) {
      return {
        success: false,
        error: this.createError('ALREADY_TERMINAL', `Workflow is already ${workflow.status}`),
      };
    }

    if (compensate && workflow.compensationStack.length > 0) {
      return this.triggerCompensation(workflowId, reason);
    }

    workflow.status = WorkflowStatus.CANCELLED;
    workflow.completedAt = new Date();
    
    this.eventBus.emit({
      type: 'workflow.cancelled',
      workflowId,
      timestamp: new Date(),
      data: { reason },
    });

    return { success: true, value: workflow };
  }

  /**
   * Trigger compensation (saga rollback)
   */
  async triggerCompensation(
    workflowId: WorkflowId,
    reason?: string
  ): Promise<Result<Workflow, WorkflowError>> {
    const workflow = this.workflows.get(workflowId);
    
    if (!workflow) {
      return { success: false, error: this.createError('WORKFLOW_NOT_FOUND', 'Workflow not found') };
    }

    if (workflow.status === WorkflowStatus.COMPENSATING) {
      return { success: false, error: this.createError('ALREADY_COMPENSATING', 'Already compensating') };
    }

    if (workflow.status === WorkflowStatus.COMPENSATED) {
      return { success: false, error: this.createError('ALREADY_COMPENSATED', 'Already compensated') };
    }

    if (workflow.compensationStack.length === 0) {
      return { success: false, error: this.createError('NO_COMPENSATION_NEEDED', 'No steps to compensate') };
    }

    workflow.status = WorkflowStatus.COMPENSATING;
    
    this.eventBus.emit({
      type: 'workflow.compensation_started',
      workflowId,
      timestamp: new Date(),
      data: { reason, stepsToCompensate: workflow.compensationStack.length },
    });

    // Run compensation in background
    this.runCompensation(workflow).catch((err) => {
      console.error('Compensation failed:', err);
    });

    return { success: true, value: workflow };
  }

  /**
   * Retry a failed step
   */
  async retryStep(workflowId: WorkflowId, stepId?: StepId): Promise<Result<Step, WorkflowError>> {
    const workflow = this.workflows.get(workflowId);
    
    if (!workflow) {
      return { success: false, error: this.createError('WORKFLOW_NOT_FOUND', 'Workflow not found') };
    }

    const step = stepId
      ? workflow.steps.find((s) => s.id === stepId)
      : this.getCurrentStep(workflow);

    if (!step) {
      return { success: false, error: this.createError('STEP_NOT_FOUND', 'Step not found') };
    }

    if (step.status !== StepStatus.FAILED) {
      return { success: false, error: this.createError('STEP_NOT_FAILED', 'Step is not in failed state') };
    }

    if (step.attempt > step.maxRetries) {
      return {
        success: false,
        error: this.createError('MAX_RETRIES_EXCEEDED', `Max retries (${step.maxRetries}) exceeded`),
      };
    }

    // Reset step for retry
    step.status = StepStatus.PENDING;
    step.error = undefined;
    
    workflow.status = WorkflowStatus.RUNNING;
    workflow.currentStep = step.id;

    this.eventBus.emit({
      type: 'step.retrying',
      workflowId,
      stepId: step.id,
      timestamp: new Date(),
      data: { attempt: step.attempt + 1 },
    });

    // Execute step
    await this.executeCurrentStep(workflow);

    return { success: true, value: step };
  }

  // ============================================
  // Private Methods
  // ============================================

  private createStep(workflowId: WorkflowId, def: StepDefinition): Step {
    const retry = def.retry ?? this.config.defaultRetry!;
    
    return {
      id: def.id,
      workflowId,
      name: def.name,
      handler: def.handler,
      compensationHandler: def.compensationHandler,
      status: StepStatus.PENDING,
      attempt: 0,
      maxRetries: retry.maxRetries,
      timeoutMs: def.timeoutMs ?? this.config.defaultTimeoutMs,
    };
  }

  private async executeCurrentStep(workflow: Workflow): Promise<void> {
    const step = this.getCurrentStep(workflow);
    if (!step) return;

    step.status = StepStatus.RUNNING;
    step.attempt += 1;
    step.startedAt = new Date();
    step.error = undefined;

    this.eventBus.emit({
      type: 'step.started',
      workflowId: workflow.id,
      stepId: step.id,
      timestamp: new Date(),
      data: { attempt: step.attempt },
    });

    try {
      const handler = this.handlers.get(step.handler);
      if (!handler) {
        throw new Error(`Handler not found: ${step.handler}`);
      }

      const ctx: HandlerContext = {
        workflowId: workflow.id,
        stepId: step.id,
        attempt: step.attempt,
        context: workflow.context,
      };

      // Execute with timeout
      const output = await this.executeWithTimeout(
        () => handler(step.input ?? {}, ctx),
        step.timeoutMs
      );

      // Success
      step.status = StepStatus.COMPLETED;
      step.output = output as Record<string, unknown>;
      step.completedAt = new Date();
      step.durationMs = step.completedAt.getTime() - step.startedAt!.getTime();

      this.eventBus.emit({
        type: 'step.completed',
        workflowId: workflow.id,
        stepId: step.id,
        timestamp: new Date(),
        data: { durationMs: step.durationMs },
      });

      // Auto-transition to next step
      await this.transition({ workflowId: workflow.id, stepOutput: step.output });

    } catch (error) {
      await this.handleStepFailure(workflow, step, error as Error);
    }
  }

  private async handleStepFailure(workflow: Workflow, step: Step, error: Error): Promise<void> {
    const stepDef = this.findStepDefinition(workflow, step.id);
    const canRetry = step.attempt < step.maxRetries + 1;

    step.error = {
      code: 'HANDLER_ERROR',
      message: error.message,
      attempt: step.attempt,
      recoverable: canRetry,
    };

    if (canRetry) {
      // Schedule retry
      const delay = this.calculateRetryDelay(step);
      step.status = StepStatus.FAILED;
      step.nextRetryAt = new Date(Date.now() + delay);
      
      setTimeout(() => {
        this.retryStep(workflow.id, step.id);
      }, delay);
      
      return;
    }

    // Step permanently failed
    step.status = StepStatus.FAILED;
    step.completedAt = new Date();

    this.eventBus.emit({
      type: 'step.failed',
      workflowId: workflow.id,
      stepId: step.id,
      timestamp: new Date(),
      data: { error: error.message, attempts: step.attempt },
    });

    // Handle failure based on step config
    const failureAction = stepDef?.onFailure ?? FailureAction.FAIL_WORKFLOW;
    
    switch (failureAction) {
      case FailureAction.COMPENSATE:
        await this.triggerCompensation(workflow.id, error.message);
        break;
      
      case FailureAction.SKIP:
        step.status = StepStatus.SKIPPED;
        await this.transition({ workflowId: workflow.id });
        break;
      
      case FailureAction.PAUSE:
        await this.pauseWorkflow(workflow.id, error.message);
        break;
      
      case FailureAction.FAIL_WORKFLOW:
      default:
        workflow.status = WorkflowStatus.FAILED;
        workflow.error = this.createError('STEP_FAILED', error.message, step.id);
        workflow.completedAt = new Date();
        
        this.eventBus.emit({
          type: 'workflow.failed',
          workflowId: workflow.id,
          timestamp: new Date(),
          data: { stepId: step.id, error: error.message },
        });
        break;
    }
  }

  private async runCompensation(workflow: Workflow): Promise<void> {
    const result = await this.compensationRunner.run(workflow);
    
    if (result.success) {
      workflow.status = WorkflowStatus.COMPENSATED;
      workflow.completedAt = new Date();
      
      this.eventBus.emit({
        type: 'workflow.compensation_completed',
        workflowId: workflow.id,
        timestamp: new Date(),
        data: { compensatedSteps: result.value.compensatedSteps },
      });
    }
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    if (!timeoutMs) {
      return fn();
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Step execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private calculateRetryDelay(step: Step): number {
    // Default exponential backoff: 1s, 2s, 4s, 8s...
    const baseDelay = 1000;
    const multiplier = 2;
    return baseDelay * Math.pow(multiplier, step.attempt - 1);
  }

  private async shouldSkipStep(step: Step, workflow: Workflow): Promise<boolean> {
    // Find step definition to check condition
    // For now, always return false (no skip)
    return false;
  }

  private getCurrentStep(workflow: Workflow): Step | undefined {
    return workflow.steps.find((s) => s.id === workflow.currentStep);
  }

  private findStepDefinition(workflow: Workflow, stepId: StepId): StepDefinition | undefined {
    // In a real implementation, we'd store the original definitions
    return undefined;
  }

  private async completeWorkflow(workflow: Workflow): Promise<Result<Workflow, WorkflowError>> {
    workflow.status = WorkflowStatus.COMPLETED;
    workflow.currentStep = undefined;
    workflow.completedAt = new Date();

    this.eventBus.emit({
      type: 'workflow.completed',
      workflowId: workflow.id,
      timestamp: new Date(),
      data: {
        durationMs: workflow.completedAt.getTime() - workflow.startedAt!.getTime(),
        stepsExecuted: workflow.steps.filter((s) => s.status === StepStatus.COMPLETED).length,
      },
    });

    return { success: true, value: workflow };
  }

  private validateWorkflowInput(input: StartWorkflowInput): WorkflowError | null {
    if (!input.name || input.name.length === 0) {
      return this.createError('INVALID_WORKFLOW', 'Workflow name is required');
    }

    if (!input.steps || input.steps.length === 0) {
      return this.createError('INVALID_WORKFLOW', 'At least one step is required');
    }

    // Check for duplicate step IDs
    const stepIds = input.steps.map((s) => s.id);
    const duplicates = stepIds.filter((id, i) => stepIds.indexOf(id) !== i);
    if (duplicates.length > 0) {
      return this.createError('DUPLICATE_STEP_IDS', `Duplicate step IDs: ${duplicates.join(', ')}`);
    }

    // Validate handlers exist
    for (const step of input.steps) {
      if (!this.handlers.has(step.handler)) {
        return this.createError('INVALID_HANDLER', `Handler not found: ${step.handler}`);
      }
      if (step.compensationHandler && !this.handlers.has(step.compensationHandler)) {
        return this.createError('INVALID_HANDLER', `Compensation handler not found: ${step.compensationHandler}`);
      }
    }

    return null;
  }

  private createError(code: string, message: string, stepId?: StepId): WorkflowError {
    return {
      code,
      message,
      stepId,
      timestamp: new Date(),
    };
  }

  private isTerminalStatus(status: WorkflowStatus): boolean {
    return [
      WorkflowStatus.COMPLETED,
      WorkflowStatus.COMPENSATED,
      WorkflowStatus.CANCELLED,
    ].includes(status);
  }
}
