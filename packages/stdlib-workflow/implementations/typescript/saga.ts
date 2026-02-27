/**
 * Saga Orchestrator
 * 
 * High-level API for building and running sagas (distributed transactions
 * with compensation).
 */

import type {
  Workflow,
  WorkflowId,
  StepDefinition,
  WorkflowContext,
  HandlerFn,
  CompensationFn,
  Result,
  WorkflowError,
  RetryConfig,
  RetryStrategy,
  FailureAction,
} from './types.js';
import { WorkflowEngine } from './engine.js';

// ============================================
// Saga Builder Types
// ============================================

export interface SagaStep<TInput = unknown, TOutput = unknown> {
  id: string;
  name: string;
  execute: HandlerFn<TInput, TOutput>;
  compensate?: CompensationFn<TOutput>;
  timeout?: number;
  retry?: RetryConfig;
  onFailure?: FailureAction;
}

export interface SagaDefinition {
  name: string;
  description?: string;
  steps: SagaStep[];
}

export interface SagaInstance {
  id: WorkflowId;
  definition: SagaDefinition;
  workflow: Workflow;
}

// ============================================
// Saga Builder (Fluent API)
// ============================================

export class SagaBuilder {
  private name: string;
  private description?: string;
  private steps: SagaStep[] = [];

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Set saga description
   */
  describe(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Add a step to the saga
   */
  step<TInput = unknown, TOutput = unknown>(
    id: string,
    config: {
      name?: string;
      execute: HandlerFn<TInput, TOutput>;
      compensate?: CompensationFn<TOutput>;
      timeout?: number;
      retry?: RetryConfig;
      onFailure?: FailureAction;
    }
  ): this {
    this.steps.push({
      id,
      name: config.name ?? id,
      execute: config.execute as HandlerFn,
      compensate: config.compensate as CompensationFn,
      timeout: config.timeout,
      retry: config.retry,
      onFailure: config.onFailure,
    });
    return this;
  }

  /**
   * Add a step with automatic compensation on failure
   */
  compensatedStep<TInput = unknown, TOutput = unknown>(
    id: string,
    execute: HandlerFn<TInput, TOutput>,
    compensate: CompensationFn<TOutput>,
    options?: {
      name?: string;
      timeout?: number;
      retry?: RetryConfig;
    }
  ): this {
    return this.step(id, {
      ...options,
      execute,
      compensate,
      onFailure: FailureAction.COMPENSATE,
    });
  }

  /**
   * Build the saga definition
   */
  build(): SagaDefinition {
    if (this.steps.length === 0) {
      throw new Error('Saga must have at least one step');
    }

    return {
      name: this.name,
      description: this.description,
      steps: this.steps,
    };
  }
}

// ============================================
// Saga Orchestrator
// ============================================

export class SagaOrchestrator {
  private engine: WorkflowEngine;
  private registeredSagas: Map<string, SagaDefinition> = new Map();

  constructor(engine?: WorkflowEngine) {
    this.engine = engine ?? new WorkflowEngine();
  }

  /**
   * Get the underlying workflow engine
   */
  getEngine(): WorkflowEngine {
    return this.engine;
  }

  /**
   * Create a new saga builder
   */
  static define(name: string): SagaBuilder {
    return new SagaBuilder(name);
  }

  /**
   * Register a saga definition
   */
  register(definition: SagaDefinition): void {
    // Register handlers with the engine
    const handlers = this.engine.getHandlers();
    
    for (const step of definition.steps) {
      handlers.register(step.id, step.execute);
      
      if (step.compensate) {
        handlers.register(`${step.id}:compensate`, async (input, ctx) => {
          await step.compensate!(input, ctx);
          return {};
        });
      }
    }

    this.registeredSagas.set(definition.name, definition);
  }

  /**
   * Execute a registered saga
   */
  async execute(
    sagaName: string,
    context?: WorkflowContext
  ): Promise<Result<SagaInstance, WorkflowError>> {
    const definition = this.registeredSagas.get(sagaName);
    
    if (!definition) {
      return {
        success: false,
        error: {
          code: 'SAGA_NOT_FOUND',
          message: `Saga not found: ${sagaName}`,
          timestamp: new Date(),
        },
      };
    }

    return this.run(definition, context);
  }

  /**
   * Run a saga definition directly
   */
  async run(
    definition: SagaDefinition,
    context?: WorkflowContext
  ): Promise<Result<SagaInstance, WorkflowError>> {
    // Register handlers if not already registered
    if (!this.registeredSagas.has(definition.name)) {
      this.register(definition);
    }

    // Convert saga steps to workflow step definitions
    const stepDefs: StepDefinition[] = definition.steps.map((step) => ({
      id: step.id,
      name: step.name,
      handler: step.id,
      compensationHandler: step.compensate ? `${step.id}:compensate` : undefined,
      timeoutMs: step.timeout,
      retry: step.retry,
      onFailure: step.onFailure,
    }));

    // Start workflow
    const result = await this.engine.startWorkflow({
      name: definition.name,
      description: definition.description,
      steps: stepDefs,
      initialContext: context,
    });

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      value: {
        id: result.value.id,
        definition,
        workflow: result.value,
      },
    };
  }

  /**
   * Get saga instance status
   */
  getStatus(id: WorkflowId): SagaInstance | null {
    const workflow = this.engine.getWorkflow(id);
    if (!workflow) return null;

    const definition = this.registeredSagas.get(workflow.name);
    if (!definition) return null;

    return {
      id,
      definition,
      workflow,
    };
  }

  /**
   * Trigger compensation for a saga
   */
  async compensate(id: WorkflowId, reason?: string): Promise<Result<Workflow, WorkflowError>> {
    return this.engine.triggerCompensation(id, reason);
  }
}

// ============================================
// Saga Helpers
// ============================================

/**
 * Create a simple saga with automatic compensation
 */
export function createSaga(
  name: string,
  steps: Array<{
    id: string;
    execute: HandlerFn;
    compensate?: CompensationFn;
  }>
): SagaDefinition {
  const builder = new SagaBuilder(name);
  
  for (const step of steps) {
    if (step.compensate) {
      builder.compensatedStep(step.id, step.execute, step.compensate);
    } else {
      builder.step(step.id, { execute: step.execute });
    }
  }
  
  return builder.build();
}

/**
 * Create a retry configuration
 */
export function withRetry(options: {
  maxRetries: number;
  strategy?: RetryStrategy;
  initialDelayMs?: number;
  maxDelayMs?: number;
}): RetryConfig {
  return {
    strategy: options.strategy ?? RetryStrategy.EXPONENTIAL,
    maxRetries: options.maxRetries,
    initialDelayMs: options.initialDelayMs ?? 1000,
    maxDelayMs: options.maxDelayMs ?? 30000,
    multiplier: 2,
  };
}
