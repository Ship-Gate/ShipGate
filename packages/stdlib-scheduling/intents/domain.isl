/**
 * Scheduling Domain
 * 
 * Job scheduling standard library for ISL.
 * Supports cron jobs, delayed execution, and multi-step workflows.
 * 
 * @version 1.0.0
 * @author IntentOS Team
 */

domain Scheduling {
  version: "1.0.0"
  description: "Job scheduling with cron, delayed jobs, and workflows"
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Base Types
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Unique job identifier */
  type JobId = UUID
  
  /** Unique workflow identifier */
  type WorkflowId = UUID
  
  /** Cron expression for recurring jobs */
  type CronExpression = String { 
    pattern: /^[\d*\/,-]+\s+[\d*\/,-]+\s+[\d*\/,-]+\s+[\d*\/,-]+\s+[\d*\/,-]+$/
    description: "Standard 5-field cron expression (minute hour day month weekday)"
  }
  
  /** Duration in milliseconds */
  type Duration = Int { min: 0 }
  
  /** Handler identifier (e.g., "email.send", "reports.generate") */
  type HandlerName = String { minLength: 1, maxLength: 255 }
  
  /** Priority level (higher = more urgent) */
  type Priority = Int { min: 0, max: 100, default: 50 }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Enums
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Job execution status */
  enum JobStatus {
    PENDING     // Created but not yet scheduled
    SCHEDULED   // Scheduled for future execution
    RUNNING     // Currently executing
    COMPLETED   // Successfully completed
    FAILED      // Execution failed
    CANCELLED   // Cancelled by user
    RETRYING    // Scheduled for retry after failure
  }
  
  /** Workflow execution status */
  enum WorkflowStatus {
    PENDING     // Created but not started
    RUNNING     // Currently executing steps
    PAUSED      // Paused by user
    COMPLETED   // All steps completed successfully
    FAILED      // One or more steps failed
    CANCELLED   // Cancelled by user
  }
  
  /** Individual workflow step status */
  enum StepStatus {
    PENDING     // Waiting to execute
    RUNNING     // Currently executing
    COMPLETED   // Successfully completed
    FAILED      // Execution failed
    SKIPPED     // Skipped due to condition or dependency failure
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Value Objects
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Retry policy configuration */
  type RetryPolicy = {
    max_attempts: Int { min: 1, max: 10, default: 3 }
    initial_delay: Duration { default: 1000 }
    max_delay: Duration { default: 300000 }
    backoff_multiplier: Float { min: 1.0, max: 10.0, default: 2.0 }
    retryable_errors: List<String>?
  }
  
  /** Job execution result */
  type JobResult = {
    success: Boolean
    output: Map<String, Any>?
    error: String?
    duration_ms: Int
  }
  
  /** Schedule configuration */
  type ScheduleConfig = {
    run_at: Timestamp?
    delay: Duration?
    cron: CronExpression?
    timezone: String?
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Domain Invariants
  // ═══════════════════════════════════════════════════════════════════════════
  
  invariant "unique_key ensures deduplication" {
    forall j1, j2: Job =>
      j1.unique_key != null and j2.unique_key != null and j1.unique_key == j2.unique_key
      and j1.status not in [COMPLETED, CANCELLED] and j2.status not in [COMPLETED, CANCELLED]
      implies j1.id == j2.id
  }
  
  invariant "workflow steps form valid DAG" {
    forall w: Workflow =>
      isValidDAG(w.steps)
  }
  
  invariant "running jobs have started_at" {
    forall j: Job =>
      j.status == RUNNING implies j.started_at != null
  }
  
  invariant "completed jobs have duration" {
    forall j: Job =>
      j.status == COMPLETED implies j.duration_ms != null
  }
}
