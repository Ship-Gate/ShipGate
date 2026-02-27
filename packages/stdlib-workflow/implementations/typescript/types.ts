/**
 * Type definitions for the Workflow Engine
 */

// ============================================
// Core Types
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
  timeoutMs?: number;
  retry?: RetryConfig;
  condition?: string | ((context: WorkflowContext) => boolean);
  onFailure?: FailureAction;
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
  nextRetryAt?: Date;
  
  timeoutMs?: number;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  
  error?: StepError;
}

export interface Workflow {
  id: WorkflowId;
  name: string;
  description?: string;
  status: WorkflowStatus;
  
  currentStep?: StepId;
  context: WorkflowContext;
  
  steps: Step[];
  compensationStack: StepId[];
  
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  error?: WorkflowError;
  
  metadata?: Record<string, string>;
  correlationId?: string;
}

// ============================================
// Context & Handler Types
// ============================================

export type WorkflowContext = Record<string, unknown>;

export interface HandlerContext {
  workflowId: WorkflowId;
  stepId: StepId;
  attempt: number;
  context: WorkflowContext;
  signal?: AbortSignal;
}

export type HandlerFn<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  ctx: HandlerContext
) => Promise<TOutput>;

export type CompensationFn<TOutput = unknown> = (
  originalOutput: TOutput,
  ctx: HandlerContext
) => Promise<void>;

// ============================================
// Event Types
// ============================================

export type WorkflowEventType =
  | 'workflow.created'
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.cancelled'
  | 'workflow.paused'
  | 'workflow.resumed'
  | 'workflow.compensation_started'
  | 'workflow.compensation_completed'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'step.retrying'
  | 'step.skipped'
  | 'step.compensation_started'
  | 'step.compensation_completed';

export interface WorkflowEvent {
  type: WorkflowEventType;
  workflowId: WorkflowId;
  stepId?: StepId;
  timestamp: Date;
  data?: Record<string, unknown>;
}

// ============================================
// Result Types
// ============================================

export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

export interface StartWorkflowInput {
  name: string;
  description?: string;
  steps: StepDefinition[];
  initialContext?: WorkflowContext;
  correlationId?: string;
  metadata?: Record<string, string>;
}

export interface TransitionInput {
  workflowId: WorkflowId;
  stepOutput?: Record<string, unknown>;
}

export interface CompensateInput {
  workflowId: WorkflowId;
  reason?: string;
  fromStep?: StepId;
}

// ============================================
// Engine Configuration
// ============================================

export interface WorkflowEngineConfig {
  defaultTimeoutMs?: number;
  defaultRetry?: RetryConfig;
  maxConcurrentWorkflows?: number;
  persistenceAdapter?: PersistenceAdapter;
  eventEmitter?: WorkflowEventEmitter;
}

export interface PersistenceAdapter {
  saveWorkflow(workflow: Workflow): Promise<void>;
  loadWorkflow(id: WorkflowId): Promise<Workflow | null>;
  updateWorkflow(id: WorkflowId, update: Partial<Workflow>): Promise<void>;
  listWorkflows(filter?: WorkflowFilter): Promise<Workflow[]>;
}

export interface WorkflowFilter {
  status?: WorkflowStatus[];
  name?: string;
  correlationId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface WorkflowEventEmitter {
  emit(event: WorkflowEvent): void;
  on(type: WorkflowEventType, handler: (event: WorkflowEvent) => void): void;
  off(type: WorkflowEventType, handler: (event: WorkflowEvent) => void): void;
}
