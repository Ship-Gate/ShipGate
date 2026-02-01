/**
 * Workflow Engine
 *
 * Execute complex workflows based on ISL behavior chains.
 */

import { StateMachine, StateMachineConfig, createStateMachine } from './machine.js';

export interface WorkflowOptions {
  /** Maximum retries for failed steps */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Enable parallel execution where possible */
  parallelExecution?: boolean;
  /** Timeout for individual steps */
  stepTimeout?: number;
  /** Enable compensation (rollback) on failure */
  enableCompensation?: boolean;
}

export interface WorkflowStep {
  /** Step ID */
  id: string;
  /** Step name */
  name: string;
  /** Step type */
  type: 'action' | 'decision' | 'parallel' | 'wait' | 'compensation';
  /** Handler function */
  handler?: (context: WorkflowContext) => Promise<WorkflowStepResult>;
  /** Condition for decision steps */
  condition?: (context: WorkflowContext) => boolean;
  /** Parallel steps */
  parallel?: WorkflowStep[];
  /** Wait duration in milliseconds */
  waitDuration?: number;
  /** Compensation handler for rollback */
  compensate?: (context: WorkflowContext) => Promise<void>;
  /** Next step ID(s) */
  next?: string | Record<string, string>;
  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    delay: number;
    backoff?: 'linear' | 'exponential';
  };
}

export interface WorkflowStepResult {
  success: boolean;
  output?: unknown;
  error?: Error;
  branch?: string;
}

export interface WorkflowContext {
  /** Workflow ID */
  workflowId: string;
  /** Input data */
  input: Record<string, unknown>;
  /** Accumulated step outputs */
  outputs: Record<string, unknown>;
  /** Current step ID */
  currentStep: string;
  /** Execution history */
  history: WorkflowHistoryEntry[];
  /** Custom context data */
  data: Record<string, unknown>;
}

export interface WorkflowHistoryEntry {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'compensated';
  startedAt: string;
  completedAt?: string;
  output?: unknown;
  error?: string;
  attempts: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  steps: WorkflowStep[];
  initialStep: string;
  finalSteps: string[];
}

export class WorkflowEngine {
  private options: Required<WorkflowOptions>;
  private workflows: Map<string, WorkflowDefinition>;
  private executions: Map<string, WorkflowContext>;
  private stepHandlers: Map<string, (context: WorkflowContext) => Promise<WorkflowStepResult>>;

  constructor(options: WorkflowOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      parallelExecution: options.parallelExecution ?? true,
      stepTimeout: options.stepTimeout ?? 30000,
      enableCompensation: options.enableCompensation ?? true,
    };

    this.workflows = new Map();
    this.executions = new Map();
    this.stepHandlers = new Map();
  }

  /**
   * Register a workflow definition
   */
  registerWorkflow(definition: WorkflowDefinition): void {
    this.workflows.set(definition.id, definition);
  }

  /**
   * Register a step handler
   */
  registerStepHandler(
    stepId: string,
    handler: (context: WorkflowContext) => Promise<WorkflowStepResult>
  ): void {
    this.stepHandlers.set(stepId, handler);
  }

  /**
   * Start a workflow execution
   */
  async startWorkflow(
    workflowId: string,
    input: Record<string, unknown>
  ): Promise<WorkflowContext> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const executionId = `${workflowId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const context: WorkflowContext = {
      workflowId: executionId,
      input,
      outputs: {},
      currentStep: workflow.initialStep,
      history: [],
      data: {},
    };

    this.executions.set(executionId, context);

    // Start execution
    await this.executeWorkflow(workflow, context);

    return context;
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(
    executionId: string,
    resumeData?: Record<string, unknown>
  ): Promise<WorkflowContext> {
    const context = this.executions.get(executionId);
    if (!context) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (resumeData) {
      context.data = { ...context.data, ...resumeData };
    }

    const workflow = this.workflows.get(context.workflowId.split('-')[0]);
    if (!workflow) {
      throw new Error('Workflow definition not found');
    }

    await this.executeWorkflow(workflow, context);

    return context;
  }

  /**
   * Execute a workflow
   */
  private async executeWorkflow(
    workflow: WorkflowDefinition,
    context: WorkflowContext
  ): Promise<void> {
    while (!workflow.finalSteps.includes(context.currentStep)) {
      const step = workflow.steps.find((s) => s.id === context.currentStep);
      if (!step) {
        throw new Error(`Step not found: ${context.currentStep}`);
      }

      const result = await this.executeStep(step, context);

      if (!result.success) {
        // Compensation logic
        if (this.options.enableCompensation) {
          await this.compensate(workflow, context);
        }
        throw new Error(`Workflow failed at step ${step.id}: ${result.error?.message}`);
      }

      // Store output
      context.outputs[step.id] = result.output;

      // Determine next step
      const nextStep = this.getNextStep(step, result);
      if (!nextStep) {
        break;
      }
      context.currentStep = nextStep;
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<WorkflowStepResult> {
    const historyEntry: WorkflowHistoryEntry = {
      stepId: step.id,
      status: 'running',
      startedAt: new Date().toISOString(),
      attempts: 0,
    };
    context.history.push(historyEntry);

    const maxAttempts = step.retry?.maxAttempts ?? this.options.maxRetries;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      historyEntry.attempts = attempt + 1;

      try {
        let result: WorkflowStepResult;

        switch (step.type) {
          case 'action':
            result = await this.executeAction(step, context);
            break;
          case 'decision':
            result = this.executeDecision(step, context);
            break;
          case 'parallel':
            result = await this.executeParallel(step, context);
            break;
          case 'wait':
            result = await this.executeWait(step, context);
            break;
          default:
            result = { success: true };
        }

        if (result.success) {
          historyEntry.status = 'completed';
          historyEntry.completedAt = new Date().toISOString();
          historyEntry.output = result.output;
          return result;
        }

        lastError = result.error;
      } catch (error) {
        lastError = error as Error;
      }

      // Wait before retry
      if (attempt < maxAttempts - 1) {
        const delay = this.calculateRetryDelay(step, attempt);
        await this.sleep(delay);
      }
    }

    historyEntry.status = 'failed';
    historyEntry.completedAt = new Date().toISOString();
    historyEntry.error = lastError?.message;

    return { success: false, error: lastError };
  }

  /**
   * Execute an action step
   */
  private async executeAction(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<WorkflowStepResult> {
    const handler = step.handler ?? this.stepHandlers.get(step.id);
    if (!handler) {
      return { success: false, error: new Error(`No handler for step: ${step.id}`) };
    }

    const timeoutPromise = new Promise<WorkflowStepResult>((_, reject) => {
      setTimeout(() => reject(new Error('Step timeout')), this.options.stepTimeout);
    });

    return Promise.race([handler(context), timeoutPromise]);
  }

  /**
   * Execute a decision step
   */
  private executeDecision(
    step: WorkflowStep,
    context: WorkflowContext
  ): WorkflowStepResult {
    if (!step.condition) {
      return { success: false, error: new Error('Decision step missing condition') };
    }

    const result = step.condition(context);
    return { success: true, branch: result ? 'true' : 'false' };
  }

  /**
   * Execute parallel steps
   */
  private async executeParallel(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<WorkflowStepResult> {
    if (!step.parallel || step.parallel.length === 0) {
      return { success: true };
    }

    const results = await Promise.all(
      step.parallel.map((s) => this.executeStep(s, context))
    );

    const failed = results.find((r) => !r.success);
    if (failed) {
      return { success: false, error: failed.error };
    }

    return {
      success: true,
      output: results.map((r) => r.output),
    };
  }

  /**
   * Execute a wait step
   */
  private async executeWait(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<WorkflowStepResult> {
    await this.sleep(step.waitDuration ?? 0);
    return { success: true };
  }

  /**
   * Compensate (rollback) failed workflow
   */
  private async compensate(
    workflow: WorkflowDefinition,
    context: WorkflowContext
  ): Promise<void> {
    const completedSteps = context.history
      .filter((h) => h.status === 'completed')
      .reverse();

    for (const historyEntry of completedSteps) {
      const step = workflow.steps.find((s) => s.id === historyEntry.stepId);
      if (step?.compensate) {
        try {
          await step.compensate(context);
          historyEntry.status = 'compensated';
        } catch (error) {
          console.error(`Compensation failed for step ${step.id}:`, error);
        }
      }
    }
  }

  /**
   * Get next step based on result
   */
  private getNextStep(step: WorkflowStep, result: WorkflowStepResult): string | undefined {
    if (!step.next) return undefined;

    if (typeof step.next === 'string') {
      return step.next;
    }

    if (result.branch && step.next[result.branch]) {
      return step.next[result.branch];
    }

    return step.next['default'];
  }

  /**
   * Calculate retry delay with backoff
   */
  private calculateRetryDelay(step: WorkflowStep, attempt: number): number {
    const baseDelay = step.retry?.delay ?? this.options.retryDelay;
    const backoff = step.retry?.backoff ?? 'exponential';

    if (backoff === 'linear') {
      return baseDelay * (attempt + 1);
    }

    return baseDelay * Math.pow(2, attempt);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get workflow execution status
   */
  getExecution(executionId: string): WorkflowContext | undefined {
    return this.executions.get(executionId);
  }

  /**
   * List all executions
   */
  listExecutions(): WorkflowContext[] {
    return Array.from(this.executions.values());
  }
}

/**
 * Create a workflow engine
 */
export function createWorkflowEngine(options?: WorkflowOptions): WorkflowEngine {
  return new WorkflowEngine(options);
}
