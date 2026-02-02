/**
 * ISL StdLib - Scheduling
 * 
 * Job scheduling standard library implementation.
 * Supports cron jobs, delayed execution, and multi-step workflows.
 * 
 * @packageDocumentation
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types - Scheduler
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Core types
  JobId,
  WorkflowId,
  JobStatus,
  Priority,
  
  // Entities
  Job,
  Schedule,
  
  // Value objects
  RetryPolicy,
  JobResult,
  ScheduleConfig,
  
  // Input/Output types
  ScheduleJobInput,
  ScheduleJobOutput,
  CancelJobInput,
  CancelJobOutput,
  RetryJobInput,
  RetryJobOutput,
  
  // Handler types
  JobHandler,
  HandlerRegistry,
  
  // Event types
  SchedulerEvent,
  JobEvent,
} from './scheduler.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types - Workflow
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Core types
  WorkflowStatus,
  StepStatus,
  
  // Entities
  Workflow,
  WorkflowStep,
  
  // Value objects
  WorkflowStepInput,
  
  // Input/Output types
  RunWorkflowInput,
  RunWorkflowOutput,
  
  // Event types
  WorkflowEvent,
} from './workflow.js';

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Main scheduler class
  Scheduler,
  
  // Behavior functions
  scheduleJob,
  cancelJob,
  retryJob,
  getJob,
  listJobs,
  
  // Factory functions
  createScheduler,
  
  // Constants
  JOB_STATUSES,
  DEFAULT_PRIORITY,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RETRY_DELAY,
} from './scheduler.js';

// ─────────────────────────────────────────────────────────────────────────────
// Workflow
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Workflow engine
  WorkflowEngine,
  
  // Behavior functions
  runWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  cancelWorkflow,
  getWorkflow,
  listWorkflows,
  
  // Utilities
  validateWorkflowSteps,
  topologicalSort,
  detectCycles,
  
  // Constants
  WORKFLOW_STATUSES,
  STEP_STATUSES,
} from './workflow.js';

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Cron utilities
  parseCronExpression,
  getNextCronRun,
  isValidCronExpression,
  
  // Duration utilities
  parseDuration,
  formatDuration,
  
  // Error types
  SchedulingError,
  JobNotFoundError,
  DuplicateJobError,
  InvalidCronError,
  MaxRetriesExceededError,
  WorkflowValidationError,
} from './scheduler.js';
