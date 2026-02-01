/**
 * @isl-lang/stdlib-workflow
 * Workflow Engine Standard Library
 *
 * Provides state machines, saga orchestration, and distributed transaction
 * compensation for IntentOS applications.
 */

// ============================================
// Core Engine
// ============================================

export {
  WorkflowEngine,
  createWorkflowEngine,
} from './engine';

// ============================================
// Saga Pattern
// ============================================

export {
  SagaOrchestrator,
  SagaDefinition,
  SagaStep,
  SagaExecutionResult,
  SagaBuilder,
  createSagaOrchestrator,
  createTransactionalStep,
} from './saga';

// ============================================
// Compensation
// ============================================

export {
  CompensationExecutor,
  CompensationPlanBuilder,
  CompensationPlan,
  CompensationAction,
  CompensationStrategy,
  CompensationFailureStrategy,
  CompensationExecutionResult,
  CompensationFailure,
  createCompensationExecutor,
  createCompensationPlan,
  idempotentCompensation,
  logOnlyCompensation,
  apiCompensation,
  composeCompensations,
  withRetry,
} from './compensation';

// ============================================
// Types
// ============================================

export {
  // IDs
  WorkflowId,
  StepId,
  HandlerName,

  // Enums
  WorkflowStatus,
  StepStatus,
  RetryStrategy,
  FailureAction,

  // Configuration
  RetryConfig,
  StepDefinition,
  WorkflowEngineConfig,
  Logger,

  // Errors
  WorkflowError,
  StepError,

  // Entities
  Workflow,
  Step,

  // Handler Types
  StepExecutionContext,
  CompensationContext,
  StepHandler,
  CompensationHandler,
  StepHandlerResult,
  CompensationResult,

  // Events
  WorkflowEvent,
  WorkflowEventType,
  WorkflowStartedEvent,
  WorkflowCompletedEvent,
  WorkflowFailedEvent,
  StepTransitionedEvent,
  CompensationStartedEvent,
  CompensationCompletedEvent,

  // Results
  WorkflowResult,
  WorkflowProgress,
  WorkflowStatusInfo,

  // Query
  ListWorkflowsQuery,
  ListWorkflowsResult,
} from './types';

// ============================================
// Convenience Builders
// ============================================

import { StepDefinition, RetryStrategy, FailureAction, RetryConfig } from './types';

/**
 * Builder for creating step definitions
 */
export class StepBuilder {
  private step: Partial<StepDefinition> & { id: string };

  constructor(id: string) {
    this.step = { id };
  }

  name(name: string): this {
    this.step.name = name;
    return this;
  }

  handler(handler: string): this {
    this.step.handler = handler;
    return this;
  }

  compensate(handler: string): this {
    this.step.compensationHandler = handler;
    return this;
  }

  timeout(ms: number): this {
    this.step.timeout = ms;
    return this;
  }

  retry(config: Partial<RetryConfig>): this {
    this.step.retry = {
      strategy: config.strategy ?? RetryStrategy.EXPONENTIAL,
      maxRetries: config.maxRetries ?? 3,
      initialDelayMs: config.initialDelayMs,
      maxDelayMs: config.maxDelayMs,
      multiplier: config.multiplier,
    };
    return this;
  }

  onFailure(action: FailureAction): this {
    this.step.onFailure = action;
    return this;
  }

  when(condition: string): this {
    this.step.condition = condition;
    return this;
  }

  input(data: Record<string, unknown>): this {
    this.step.input = data;
    return this;
  }

  build(): StepDefinition {
    if (!this.step.name || !this.step.handler) {
      throw new Error('Step requires name and handler');
    }
    return this.step as StepDefinition;
  }
}

/**
 * Create a new step builder
 */
export function step(id: string): StepBuilder {
  return new StepBuilder(id);
}

// ============================================
// Quick Start Helpers
// ============================================

import { createWorkflowEngine } from './engine';
import { StepHandler, CompensationHandler } from './types';

/**
 * Quick workflow definition helper
 */
export function defineWorkflow(
  name: string,
  steps: Array<{
    id: string;
    name: string;
    handler: string;
    compensate?: string;
  }>
): StepDefinition[] {
  return steps.map((s) => ({
    id: s.id,
    name: s.name,
    handler: s.handler,
    compensationHandler: s.compensate,
  }));
}

/**
 * Create and run a simple workflow
 */
export async function runWorkflow(
  name: string,
  steps: StepDefinition[],
  handlers: Record<string, StepHandler>,
  compensationHandlers?: Record<string, CompensationHandler>,
  context?: Record<string, unknown>
) {
  const engine = createWorkflowEngine();

  // Register handlers
  for (const [handlerName, handler] of Object.entries(handlers)) {
    engine.registerHandler(handlerName, handler);
  }

  // Register compensation handlers
  if (compensationHandlers) {
    for (const [handlerName, handler] of Object.entries(compensationHandlers)) {
      engine.registerCompensationHandler(handlerName, handler);
    }
  }

  // Start workflow
  return engine.start(name, steps, { initialContext: context });
}
