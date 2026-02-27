/**
 * Workflow Entity
 * 
 * Represents a multi-step job workflow with dependencies.
 */

import { WorkflowStatus, StepStatus, HandlerName, RetryPolicy } from "./domain.isl"

// ═══════════════════════════════════════════════════════════════════════════
// Workflow Step
// ═══════════════════════════════════════════════════════════════════════════

/** Input for defining a workflow step */
type WorkflowStepInput = {
  /** Step name (unique within workflow) */
  name: String { minLength: 1, maxLength: 255 }
  
  /** Handler to invoke */
  handler: HandlerName
  
  /** Input data for the step */
  input: Map<String, Any>?
  
  /** Steps that must complete before this one */
  depends_on: List<String>?
  
  /** Condition for running this step (expression) */
  condition: String?
  
  /** Retry policy for this step */
  retry_policy: RetryPolicy?
  
  /** Timeout in milliseconds */
  timeout: Int? { min: 1000, max: 3600000 }
}

/** Workflow step with execution state */
type WorkflowStep = {
  /** Step name */
  name: String
  
  /** Handler to invoke */
  handler: HandlerName
  
  /** Input data */
  input: Map<String, Any>?
  
  /** Output data from execution */
  output: Map<String, Any>?
  
  /** Current status */
  status: StepStatus
  
  /** Dependencies */
  depends_on: List<String>?
  
  /** Condition expression */
  condition: String?
  
  /** Retry policy */
  retry_policy: RetryPolicy?
  
  /** Timeout in milliseconds */
  timeout: Int?
  
  /** When execution started */
  started_at: Timestamp?
  
  /** When execution completed */
  completed_at: Timestamp?
  
  /** Execution duration */
  duration_ms: Int?
  
  /** Number of attempts */
  attempts: Int
  
  /** Error message if failed */
  error: String?
}

// ═══════════════════════════════════════════════════════════════════════════
// Workflow Entity
// ═══════════════════════════════════════════════════════════════════════════

entity Workflow {
  // ═══════════════════════════════════════════════════════════════════════════
  // Identity
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Unique identifier */
  id: UUID [immutable, unique]
  
  /** Human-readable name */
  name: String { minLength: 1, maxLength: 255 }
  
  /** Description */
  description: String?
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Execution State
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** List of steps to execute */
  steps: List<WorkflowStep>
  
  /** Index of currently executing step */
  current_step: Int? { min: 0 }
  
  /** Overall workflow status */
  status: WorkflowStatus
  
  /** Shared context between steps */
  context: Map<String, Any>
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Execution Tracking
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** When execution started */
  started_at: Timestamp?
  
  /** When execution completed */
  completed_at: Timestamp?
  
  /** Total execution duration */
  duration_ms: Int?
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Progress
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Number of completed steps */
  completed_steps: Int { min: 0, default: 0 }
  
  /** Number of failed steps */
  failed_steps: Int { min: 0, default: 0 }
  
  /** Number of skipped steps */
  skipped_steps: Int { min: 0, default: 0 }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Configuration
  // ═══════════════════════════════════════════════════════════════════════════
  
  /** Whether to continue on step failure */
  continue_on_failure: Boolean { default: false }
  
  /** Maximum parallel steps */
  max_parallelism: Int { min: 1, max: 10, default: 1 }
  
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
    // At least one step
    steps.length > 0
    
    // Step counts are consistent
    completed_steps + failed_steps + skipped_steps <= steps.length
    
    // Completed workflows have completed_at
    status == COMPLETED implies completed_at != null
    
    // Running workflows have started_at
    status == RUNNING implies started_at != null
    
    // Current step is valid
    current_step != null implies current_step < steps.length
    
    // Failed workflows have at least one failed step (unless cancelled)
    status == FAILED implies failed_steps > 0 or status == CANCELLED
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════
  
  lifecycle {
    initial: PENDING
    
    transitions {
      PENDING -> RUNNING      // Execution started
      RUNNING -> PAUSED       // Paused by user
      PAUSED -> RUNNING       // Resumed
      RUNNING -> COMPLETED    // All steps completed
      RUNNING -> FAILED       // Step failed (no continue_on_failure)
      RUNNING -> CANCELLED    // Cancelled by user
      PAUSED -> CANCELLED     // Cancelled while paused
      PENDING -> CANCELLED    // Cancelled before start
    }
    
    terminal: [COMPLETED, FAILED, CANCELLED]
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Computed Properties
  // ═══════════════════════════════════════════════════════════════════════════
  
  computed progress: Float = steps.length > 0 ? completed_steps / steps.length : 0.0
  computed is_terminal: Boolean = status in [COMPLETED, FAILED, CANCELLED]
  computed pending_steps: Int = steps.length - completed_steps - failed_steps - skipped_steps
}
