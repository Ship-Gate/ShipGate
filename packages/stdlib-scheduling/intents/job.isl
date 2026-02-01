/**
 * Job Entity
 * 
 * Represents a scheduled unit of work to be executed.
 */

import { JobId, JobStatus, HandlerName, Priority, Duration, CronExpression, RetryPolicy, JobResult } from "./domain.isl"

entity Job {
  // ═══════════════════════════════════════════════════════════════════════════
  // Identity
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Unique identifier */
  id: JobId [immutable, unique]
  
  /** Human-readable name */
  name: String { minLength: 1, maxLength: 255 }
  
  /** Unique key for deduplication (optional) */
  unique_key: String? { maxLength: 255 }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Execution
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Handler function to invoke */
  handler: HandlerName
  
  /** Payload to pass to handler */
  payload: Map<String, Any>
  
  /** Current execution status */
  status: JobStatus
  
  /** Execution priority (higher = sooner) */
  priority: Priority
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Scheduling
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** When to run (for one-time jobs) */
  scheduled_at: Timestamp?
  
  /** Cron expression (for recurring jobs) */
  cron: CronExpression?
  
  /** Timezone for cron evaluation */
  timezone: String? { default: "UTC" }
  
  /** Next run time (computed for cron jobs) */
  next_run_at: Timestamp?
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Execution Tracking
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** When execution started */
  started_at: Timestamp?
  
  /** When execution completed */
  completed_at: Timestamp?
  
  /** Execution duration in milliseconds */
  duration_ms: Int?
  
  /** Result of last execution */
  result: JobResult?
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Retry Configuration
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Number of execution attempts */
  attempts: Int { min: 0, default: 0 }
  
  /** Maximum number of attempts */
  max_attempts: Int { min: 1, max: 10, default: 3 }
  
  /** Delay before retry */
  retry_delay: Duration? { default: 1000 }
  
  /** Backoff multiplier for retries */
  retry_backoff: Float? { min: 1.0, max: 10.0, default: 2.0 }
  
  /** Last error message */
  last_error: String?
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Metadata
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Tags for categorization */
  tags: List<String>?
  
  /** Custom metadata */
  metadata: Map<String, Any>?
  
  /** Creation timestamp */
  created_at: Timestamp [immutable]
  
  /** Last update timestamp */
  updated_at: Timestamp
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Invariants
  // ═══════════════════════════════════════════════════════════════════════════
  
  invariants {
    // Attempts cannot exceed max
    attempts <= max_attempts
    
    // Completed jobs must have started
    completed_at != null implies started_at != null
    
    // Completed status requires completed_at
    status == COMPLETED implies completed_at != null
    
    // Running jobs must have started_at
    status == RUNNING implies started_at != null
    
    // Failed jobs must have error
    status == FAILED implies last_error != null
    
    // One-time or recurring, not both
    (scheduled_at != null) xor (cron != null) or (scheduled_at == null and cron == null)
    
    // Duration is positive
    duration_ms != null implies duration_ms >= 0
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════
  
  lifecycle {
    initial: PENDING
    
    transitions {
      PENDING -> SCHEDULED     // Job scheduled for execution
      SCHEDULED -> RUNNING     // Execution started
      RUNNING -> COMPLETED     // Execution succeeded
      RUNNING -> FAILED        // Execution failed
      FAILED -> RETRYING       // Retry scheduled
      RETRYING -> RUNNING      // Retry started
      FAILED -> CANCELLED      // Cancelled after failure
      PENDING -> CANCELLED     // Cancelled before scheduling
      SCHEDULED -> CANCELLED   // Cancelled before execution
    }
    
    terminal: [COMPLETED, CANCELLED]
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Computed Properties
  // ═══════════════════════════════════════════════════════════════════════════
  
  computed is_recurring: Boolean = cron != null
  computed is_terminal: Boolean = status in [COMPLETED, CANCELLED]
  computed can_retry: Boolean = status == FAILED and attempts < max_attempts
  computed retry_delay_ms: Duration = retry_delay * (retry_backoff ^ (attempts - 1))
}
