/**
 * Schedule Entity
 * 
 * Represents a recurring schedule definition for job execution.
 */

import { CronExpression, HandlerName, Priority, RetryPolicy } from "./domain.isl"

entity Schedule {
  // ═══════════════════════════════════════════════════════════════════════════
  // Identity
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Unique identifier */
  id: UUID [immutable, unique]
  
  /** Human-readable name */
  name: String { minLength: 1, maxLength: 255 }
  
  /** Description of what this schedule does */
  description: String?
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Schedule Definition
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Cron expression */
  cron: CronExpression
  
  /** Timezone for cron evaluation */
  timezone: String { default: "UTC" }
  
  /** Whether the schedule is active */
  enabled: Boolean { default: true }
  
  /** Start date (don't run before this) */
  start_date: Timestamp?
  
  /** End date (don't run after this) */
  end_date: Timestamp?
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Job Template
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Handler to invoke */
  handler: HandlerName
  
  /** Default payload */
  payload: Map<String, Any>?
  
  /** Job priority */
  priority: Priority
  
  /** Retry policy for generated jobs */
  retry_policy: RetryPolicy?
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Execution Tracking
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Last time a job was created from this schedule */
  last_run_at: Timestamp?
  
  /** Next scheduled run time */
  next_run_at: Timestamp?
  
  /** Number of times this schedule has been executed */
  run_count: Int { min: 0, default: 0 }
  
  /** Number of successful executions */
  success_count: Int { min: 0, default: 0 }
  
  /** Number of failed executions */
  failure_count: Int { min: 0, default: 0 }
  
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
    // End date must be after start date
    end_date != null and start_date != null implies end_date > start_date
    
    // Counts are consistent
    run_count >= success_count + failure_count
    
    // Next run only if enabled
    enabled == false implies next_run_at == null
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Computed Properties
  // ═══════════════════════════════════════════════════════════════════════════
  
  computed success_rate: Float = run_count > 0 ? success_count / run_count : 0.0
  computed is_active: Boolean = enabled and (end_date == null or end_date > now())
}
