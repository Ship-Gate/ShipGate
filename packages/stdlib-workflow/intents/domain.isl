# Workflow Engine Standard Library
# State machines, sagas, and distributed transaction compensation

domain Workflow {
  version: "1.0.0"
  description: "Workflow orchestration with saga pattern support"
  
  imports {
    core from "@intentos/stdlib-core"
  }
  
  # ============================================
  # Core Types
  # ============================================
  
  type WorkflowId = UUID
  type StepId = String
  type HandlerName = String
  
  # ============================================
  # Enums
  # ============================================
  
  enum WorkflowStatus {
    PENDING       { description: "Workflow created but not started" }
    RUNNING       { description: "Workflow is executing steps" }
    PAUSED        { description: "Workflow is paused, awaiting resume" }
    COMPLETED     { description: "All steps completed successfully" }
    FAILED        { description: "A step failed, compensation may be needed" }
    COMPENSATING  { description: "Running compensation handlers" }
    COMPENSATED   { description: "All compensations completed" }
    CANCELLED     { description: "Workflow was cancelled" }
  }
  
  enum StepStatus {
    PENDING      { description: "Step not yet started" }
    RUNNING      { description: "Step is currently executing" }
    COMPLETED    { description: "Step completed successfully" }
    FAILED       { description: "Step execution failed" }
    SKIPPED      { description: "Step was skipped (conditional)" }
    COMPENSATING { description: "Running compensation handler" }
    COMPENSATED  { description: "Compensation completed" }
  }
  
  enum RetryStrategy {
    NONE           { description: "No retries" }
    FIXED_DELAY    { description: "Fixed delay between retries" }
    EXPONENTIAL    { description: "Exponential backoff" }
    LINEAR         { description: "Linear backoff" }
  }
  
  # ============================================
  # Value Types
  # ============================================
  
  type RetryConfig = {
    strategy: RetryStrategy
    max_retries: Int [min: 0, max: 100]
    initial_delay: Duration?
    max_delay: Duration?
    multiplier: Float? [min: 1.0]
  }
  
  type StepDefinition = {
    id: StepId [unique_within_workflow]
    name: String
    handler: HandlerName
    compensation_handler: HandlerName?
    timeout: Duration?
    retry: RetryConfig?
    condition: String?  # Expression to evaluate
    on_failure: FailureAction?
  }
  
  enum FailureAction {
    FAIL_WORKFLOW    { description: "Fail the entire workflow" }
    COMPENSATE       { description: "Trigger compensation" }
    SKIP             { description: "Skip and continue" }
    PAUSE            { description: "Pause for manual intervention" }
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity Workflow {
    id: WorkflowId [immutable, unique]
    name: String
    description: String?
    status: WorkflowStatus
    
    # Execution state
    current_step: StepId?
    context: Map<String, Any>
    
    # Steps
    steps: List<Step>
    compensation_stack: List<StepId>
    
    # Timing
    created_at: Timestamp [immutable]
    started_at: Timestamp?
    completed_at: Timestamp?
    
    # Error handling
    error: WorkflowError?
    
    # Metadata
    metadata: Map<String, String>?
    correlation_id: String?
    
    lifecycle {
      PENDING -> RUNNING [on: start]
      RUNNING -> PAUSED [on: pause]
      PAUSED -> RUNNING [on: resume]
      RUNNING -> COMPLETED [on: all_steps_complete]
      RUNNING -> FAILED [on: step_failure]
      RUNNING -> COMPENSATING [on: trigger_compensation]
      FAILED -> COMPENSATING [on: trigger_compensation]
      COMPENSATING -> COMPENSATED [on: compensation_complete]
      RUNNING -> CANCELLED [on: cancel]
      PAUSED -> CANCELLED [on: cancel]
    }
  }
  
  entity Step {
    id: StepId
    workflow_id: WorkflowId [immutable]
    name: String
    handler: HandlerName
    compensation_handler: HandlerName?
    
    status: StepStatus
    
    # Execution
    input: Map<String, Any>?
    output: Map<String, Any>?
    
    # Retries
    attempt: Int
    max_retries: Int
    next_retry_at: Timestamp?
    
    # Timing
    timeout: Duration?
    started_at: Timestamp?
    completed_at: Timestamp?
    duration_ms: Int?
    
    # Error
    error: StepError?
    
    lifecycle {
      PENDING -> RUNNING [on: execute]
      RUNNING -> COMPLETED [on: success]
      RUNNING -> FAILED [on: failure]
      FAILED -> RUNNING [on: retry]
      COMPLETED -> COMPENSATING [on: compensate]
      COMPENSATING -> COMPENSATED [on: compensation_success]
      PENDING -> SKIPPED [on: skip]
    }
  }
  
  type WorkflowError = {
    code: String
    message: String
    step_id: StepId?
    details: Map<String, Any>?
    timestamp: Timestamp
  }
  
  type StepError = {
    code: String
    message: String
    attempt: Int
    recoverable: Boolean
    details: Map<String, Any>?
  }
}
