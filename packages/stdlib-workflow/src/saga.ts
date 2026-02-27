/**
 * Saga Pattern Implementation
 * Distributed transaction coordination with compensation
 */

import { v4 as uuid } from 'uuid';
import {
  WorkflowEngine,
  createWorkflowEngine,
} from './engine';
import {
  Workflow,
  WorkflowId,
  WorkflowStatus,
  StepDefinition,
  StepHandler,
  CompensationHandler,
  StepExecutionContext,
  CompensationContext,
  WorkflowResult,
  RetryStrategy,
  FailureAction,
  WorkflowEngineConfig,
  Logger,
} from './types';

// ============================================
// Saga Types
// ============================================

export interface SagaStep {
  id: string;
  name: string;
  execute: StepHandler;
  compensate?: CompensationHandler;
  timeout?: number;
  retries?: number;
  retryStrategy?: RetryStrategy;
}

export interface SagaDefinition {
  id: string;
  name: string;
  description?: string;
  steps: SagaStep[];
  version: string;
  createdAt: Date;
}

export interface SagaExecutionResult {
  sagaId: string;
  workflowId: WorkflowId;
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  compensated: boolean;
  durationMs: number;
}

export interface SagaBuilder {
  step(
    id: string,
    name: string,
    execute: StepHandler,
    compensate?: CompensationHandler
  ): SagaBuilder;
  timeout(ms: number): SagaBuilder;
  retries(count: number, strategy?: RetryStrategy): SagaBuilder;
  build(): SagaDefinition;
}

// ============================================
// Saga Orchestrator
// ============================================

export class SagaOrchestrator {
  private engine: WorkflowEngine;
  private sagas: Map<string, SagaDefinition> = new Map();
  private executions: Map<WorkflowId, string> = new Map(); // workflowId -> sagaId
  private logger: Logger;

  constructor(config?: WorkflowEngineConfig) {
    this.engine = createWorkflowEngine(config);
    this.logger = config?.logger ?? {
      debug: () => {},
      info: (msg) => console.info(`[saga:info] ${msg}`),
      warn: (msg) => console.warn(`[saga:warn] ${msg}`),
      error: (msg) => console.error(`[saga:error] ${msg}`),
    };
  }

  /**
   * Define a new saga
   */
  define(name: string): SagaBuilder {
    return new SagaBuilderImpl(name, this);
  }

  /**
   * Register a saga definition
   */
  register(saga: SagaDefinition): void {
    this.sagas.set(saga.id, saga);

    // Register handlers with engine
    for (const step of saga.steps) {
      const handlerName = `${saga.id}:${step.id}`;
      this.engine.registerHandler(handlerName, step.execute);

      if (step.compensate) {
        this.engine.registerCompensationHandler(
          `${handlerName}:compensate`,
          step.compensate
        );
      }
    }

    this.logger.info(`Saga registered: ${saga.name}`, { sagaId: saga.id });
  }

  /**
   * Execute a saga
   */
  async execute(
    sagaId: string,
    context: Record<string, unknown> = {},
    options: {
      correlationId?: string;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<SagaExecutionResult> {
    const saga = this.sagas.get(sagaId);
    if (!saga) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    const startTime = Date.now();

    // Convert saga steps to workflow step definitions
    const stepDefs: StepDefinition[] = saga.steps.map((step) => ({
      id: step.id,
      name: step.name,
      handler: `${sagaId}:${step.id}`,
      compensationHandler: step.compensate
        ? `${sagaId}:${step.id}:compensate`
        : undefined,
      timeout: step.timeout,
      retry: step.retries
        ? {
            strategy: step.retryStrategy ?? RetryStrategy.EXPONENTIAL,
            maxRetries: step.retries,
          }
        : undefined,
      onFailure: FailureAction.COMPENSATE,
    }));

    // Start workflow
    const result = await this.engine.start(saga.name, stepDefs, {
      initialContext: context,
      correlationId: options.correlationId,
      metadata: {
        ...options.metadata,
        sagaId,
        sagaVersion: saga.version,
      },
      description: saga.description,
    });

    if (!result.success) {
      return {
        sagaId,
        workflowId: '',
        success: false,
        error: result.error.message,
        compensated: false,
        durationMs: Date.now() - startTime,
      };
    }

    const workflow = result.data;
    this.executions.set(workflow.id, sagaId);

    // Wait for completion (poll-based for simplicity)
    const finalWorkflow = await this.waitForCompletion(workflow.id);
    const durationMs = Date.now() - startTime;

    return {
      sagaId,
      workflowId: workflow.id,
      success: finalWorkflow.status === WorkflowStatus.COMPLETED,
      result: finalWorkflow.context,
      error:
        finalWorkflow.status !== WorkflowStatus.COMPLETED
          ? finalWorkflow.error?.message
          : undefined,
      compensated:
        finalWorkflow.status === WorkflowStatus.COMPENSATED,
      durationMs,
    };
  }

  /**
   * Execute saga asynchronously (returns immediately)
   */
  async executeAsync(
    sagaId: string,
    context: Record<string, unknown> = {},
    options: {
      correlationId?: string;
      metadata?: Record<string, string>;
    } = {}
  ): Promise<WorkflowResult<Workflow>> {
    const saga = this.sagas.get(sagaId);
    if (!saga) {
      return {
        success: false,
        error: {
          code: 'SAGA_NOT_FOUND',
          message: `Saga not found: ${sagaId}`,
          timestamp: new Date(),
        },
      };
    }

    const stepDefs: StepDefinition[] = saga.steps.map((step) => ({
      id: step.id,
      name: step.name,
      handler: `${sagaId}:${step.id}`,
      compensationHandler: step.compensate
        ? `${sagaId}:${step.id}:compensate`
        : undefined,
      timeout: step.timeout,
      onFailure: FailureAction.COMPENSATE,
    }));

    const result = await this.engine.start(saga.name, stepDefs, {
      initialContext: context,
      correlationId: options.correlationId,
      metadata: {
        ...options.metadata,
        sagaId,
        sagaVersion: saga.version,
      },
    });

    if (result.success) {
      this.executions.set(result.data.id, sagaId);
    }

    return result;
  }

  /**
   * Get saga execution status
   */
  getStatus(workflowId: WorkflowId): Workflow | undefined {
    return this.engine.get(workflowId);
  }

  /**
   * Abort a running saga
   */
  async abort(
    workflowId: WorkflowId,
    reason?: string
  ): Promise<WorkflowResult<Workflow>> {
    return this.engine.compensate(workflowId, reason ?? 'Saga aborted');
  }

  /**
   * Get the underlying workflow engine
   */
  getEngine(): WorkflowEngine {
    return this.engine;
  }

  private async waitForCompletion(
    workflowId: WorkflowId,
    timeoutMs: number = 300000
  ): Promise<Workflow> {
    const startTime = Date.now();
    const pollInterval = 100;

    while (Date.now() - startTime < timeoutMs) {
      const workflow = this.engine.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      const terminalStatuses = [
        WorkflowStatus.COMPLETED,
        WorkflowStatus.FAILED,
        WorkflowStatus.COMPENSATED,
        WorkflowStatus.CANCELLED,
      ];

      if (terminalStatuses.includes(workflow.status)) {
        return workflow;
      }

      await sleep(pollInterval);
    }

    throw new Error(`Saga execution timeout after ${timeoutMs}ms`);
  }
}

// ============================================
// Saga Builder Implementation
// ============================================

class SagaBuilderImpl implements SagaBuilder {
  private name: string;
  private orchestrator: SagaOrchestrator;
  private steps: SagaStep[] = [];
  private currentStep: Partial<SagaStep> = {};
  private description?: string;

  constructor(name: string, orchestrator: SagaOrchestrator) {
    this.name = name;
    this.orchestrator = orchestrator;
  }

  step(
    id: string,
    name: string,
    execute: StepHandler,
    compensate?: CompensationHandler
  ): SagaBuilder {
    // Finalize previous step if exists
    if (this.currentStep.id) {
      this.steps.push(this.currentStep as SagaStep);
    }

    this.currentStep = {
      id,
      name,
      execute,
      compensate,
    };

    return this;
  }

  timeout(ms: number): SagaBuilder {
    this.currentStep.timeout = ms;
    return this;
  }

  retries(count: number, strategy?: RetryStrategy): SagaBuilder {
    this.currentStep.retries = count;
    this.currentStep.retryStrategy = strategy;
    return this;
  }

  build(): SagaDefinition {
    // Add final step
    if (this.currentStep.id) {
      this.steps.push(this.currentStep as SagaStep);
    }

    const saga: SagaDefinition = {
      id: uuid(),
      name: this.name,
      description: this.description,
      steps: this.steps,
      version: '1.0.0',
      createdAt: new Date(),
    };

    this.orchestrator.register(saga);
    return saga;
  }
}

// ============================================
// Saga Utilities
// ============================================

/**
 * Create a saga step with transaction semantics
 */
export function createTransactionalStep(
  id: string,
  name: string,
  options: {
    execute: (ctx: StepExecutionContext) => Promise<Record<string, unknown>>;
    compensate: (ctx: CompensationContext) => Promise<void>;
    timeout?: number;
    retries?: number;
  }
): SagaStep {
  return {
    id,
    name,
    execute: async (ctx) => {
      try {
        const output = await options.execute(ctx);
        return { success: true, output };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'EXECUTION_ERROR',
            message: error instanceof Error ? error.message : String(error),
            attempt: ctx.attempt,
            recoverable: true,
          },
        };
      }
    },
    compensate: async (ctx) => {
      try {
        await options.compensate(ctx);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'COMPENSATION_ERROR',
            message: error instanceof Error ? error.message : String(error),
            attempt: 1,
            recoverable: false,
          },
        };
      }
    },
    timeout: options.timeout,
    retries: options.retries,
  };
}

/**
 * Create a saga orchestrator instance
 */
export function createSagaOrchestrator(
  config?: WorkflowEngineConfig
): SagaOrchestrator {
  return new SagaOrchestrator(config);
}

// ============================================
// Helpers
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
