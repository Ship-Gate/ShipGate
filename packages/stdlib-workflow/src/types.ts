/**
 * Workflow Engine Types
 * Core types for workflow/saga execution
 */

// ============================================
// Core ID Types
// ============================================

export type WorkflowId = string;
export type StepId = string;
export type HandlerName = string;

// ============================================
// Enums
// ============================================

export enum WorkflowStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  CANCELLED = 'CANCELLED',
}

export enum StepStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
}

export enum RetryStrategy {
  NONE = 'NONE',
  FIXED_DELAY = 'FIXED_DELAY',
  EXPONENTIAL = 'EXPONENTIAL',
  LINEAR = 'LINEAR',
}

export enum FailureAction {
  FAIL_WORKFLOW = 'FAIL_WORKFLOW',
  COMPENSATE = 'COMPENSATE',
  SKIP = 'SKIP',
  PAUSE = 'PAUSE',
}

// ============================================
// Configuration Types
// ============================================

export interface RetryConfig {
  strategy: RetryStrategy;
  maxRetries: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  multiplier?: number;
}

export interface StepDefinition {
  id: StepId;
  name: string;
  handler: HandlerName;
  compensationHandler?: HandlerName;
  timeout?: number;
  retry?: RetryConfig;
  condition?: string;
  onFailure?: FailureAction;
  input?: Record<string, unknown>;
}

// ============================================
// Error Types
// ============================================

export interface WorkflowError {
  code: string;
  message: string;
  stepId?: StepId;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export interface StepError {
  code: string;
  message: string;
  attempt: number;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

// ============================================
// Entity Types
// ============================================

export interface Step {
  id: StepId;
  workflowId: WorkflowId;
  name: string;
  handler: HandlerName;
  compensationHandler?: HandlerName;
  status: StepStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  attempt: number;
  maxRetries: number;
  retryStrategy: RetryStrategy;
  retryDelayMs: number;
  nextRetryAt?: Date;
  timeout?: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: StepError;
  onFailure: FailureAction;
  condition?: string;
  skipReason?: string;
}

export interface Workflow {
  id: WorkflowId;
  name: string;
  description?: string;
  status: WorkflowStatus;
  currentStep?: StepId;
  context: Record<string, unknown>;
  steps: Step[];
  compensationStack: StepId[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: WorkflowError;
  correlationId?: string;
  metadata?: Record<string, string>;
  version: number;
}

// ============================================
// Handler Types
// ============================================

export interface StepExecutionContext {
  workflowId: WorkflowId;
  stepId: StepId;
  context: Record<string, unknown>;
  input?: Record<string, unknown>;
  attempt: number;
  timeout?: number;
}

export interface CompensationContext extends StepExecutionContext {
  originalInput?: Record<string, unknown>;
  originalOutput?: Record<string, unknown>;
}

export type StepHandler = (
  ctx: StepExecutionContext
) => Promise<StepHandlerResult>;

export type CompensationHandler = (
  ctx: CompensationContext
) => Promise<CompensationResult>;

export interface StepHandlerResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: StepError;
}

export interface CompensationResult {
  success: boolean;
  error?: StepError;
}

// ============================================
// Event Types
// ============================================

export interface WorkflowEvent {
  type: string;
  workflowId: WorkflowId;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export interface WorkflowStartedEvent extends WorkflowEvent {
  type: 'WORKFLOW_STARTED';
  payload: {
    name: string;
    stepCount: number;
    correlationId?: string;
  };
}

export interface WorkflowCompletedEvent extends WorkflowEvent {
  type: 'WORKFLOW_COMPLETED';
  payload: {
    durationMs: number;
    stepsCompleted: number;
    stepsSkipped: number;
  };
}

export interface WorkflowFailedEvent extends WorkflowEvent {
  type: 'WORKFLOW_FAILED';
  payload: {
    stepId: StepId;
    error: StepError;
  };
}

export interface StepTransitionedEvent extends WorkflowEvent {
  type: 'STEP_TRANSITIONED';
  payload: {
    fromStep: StepId;
    toStep: StepId;
  };
}

export interface CompensationStartedEvent extends WorkflowEvent {
  type: 'COMPENSATION_STARTED';
  payload: {
    reason?: string;
    stepsToCompensate: number;
  };
}

export interface CompensationCompletedEvent extends WorkflowEvent {
  type: 'COMPENSATION_COMPLETED';
  payload: {
    stepsCompensated: number;
    durationMs: number;
  };
}

export type WorkflowEventType =
  | WorkflowStartedEvent
  | WorkflowCompletedEvent
  | WorkflowFailedEvent
  | StepTransitionedEvent
  | CompensationStartedEvent
  | CompensationCompletedEvent;

// ============================================
// Engine Configuration
// ============================================

export interface WorkflowEngineConfig {
  /** Maximum concurrent workflows */
  maxConcurrentWorkflows?: number;
  /** Default step timeout in ms */
  defaultStepTimeout?: number;
  /** Default retry configuration */
  defaultRetryConfig?: RetryConfig;
  /** Event handler for workflow events */
  onEvent?: (event: WorkflowEventType) => void;
  /** Custom logger */
  logger?: Logger;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ============================================
// Result Types
// ============================================

export type WorkflowResult<T = Workflow> =
  | { success: true; data: T }
  | { success: false; error: WorkflowError };

export interface WorkflowProgress {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  percentage: number;
}

export interface WorkflowStatusInfo {
  workflow: Workflow;
  progress: WorkflowProgress;
  currentStep?: Step;
  estimatedTimeRemainingMs?: number;
}

// ============================================
// Query Types
// ============================================

export interface ListWorkflowsQuery {
  status?: WorkflowStatus;
  name?: string;
  correlationId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface ListWorkflowsResult {
  workflows: Workflow[];
  total: number;
  hasMore: boolean;
}
