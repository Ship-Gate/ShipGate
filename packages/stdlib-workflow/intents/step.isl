# Step Entity
# Individual step within a workflow

entity Step {
  description: "A single step in a workflow execution"
  
  domain: Workflow
  version: "1.0.0"
  
  # ============================================
  # Identity
  # ============================================
  
  id: StepId {
    description: "Unique step identifier within the workflow"
    constraints: [required]
  }
  
  workflow_id: WorkflowId {
    description: "Parent workflow ID"
    constraints: [immutable, required]
    indexed: true
  }
  
  # ============================================
  # Definition
  # ============================================
  
  name: String {
    description: "Human-readable step name"
    constraints: [required]
  }
  
  handler: HandlerName {
    description: "Name of the handler function to execute"
    constraints: [required]
  }
  
  compensation_handler: HandlerName? {
    description: "Handler to call for compensation/rollback"
  }
  
  # ============================================
  # Execution State
  # ============================================
  
  status: StepStatus {
    description: "Current step status"
    default: StepStatus.PENDING
  }
  
  input: Map<String, Any>? {
    description: "Input data passed to the handler"
  }
  
  output: Map<String, Any>? {
    description: "Output data from handler execution"
  }
  
  # ============================================
  # Retry Configuration
  # ============================================
  
  attempt: Int {
    description: "Current attempt number (1-indexed)"
    default: 0
  }
  
  max_retries: Int {
    description: "Maximum number of retry attempts"
    default: 3
    constraints: [min: 0, max: 100]
  }
  
  retry_strategy: RetryStrategy {
    description: "Strategy for calculating retry delays"
    default: RetryStrategy.EXPONENTIAL
  }
  
  retry_delay_ms: Int {
    description: "Base delay between retries in milliseconds"
    default: 1000
    constraints: [min: 0]
  }
  
  next_retry_at: Timestamp? {
    description: "Scheduled time for next retry"
  }
  
  # ============================================
  # Timing
  # ============================================
  
  timeout: Duration? {
    description: "Maximum execution time for this step"
  }
  
  started_at: Timestamp? {
    description: "When step execution began"
  }
  
  completed_at: Timestamp? {
    description: "When step finished"
  }
  
  # ============================================
  # Error Handling
  # ============================================
  
  error: StepError? {
    description: "Error information if step failed"
  }
  
  on_failure: FailureAction {
    description: "Action to take when step fails"
    default: FailureAction.COMPENSATE
  }
  
  # ============================================
  # Conditional Execution
  # ============================================
  
  condition: String? {
    description: "Expression to evaluate for conditional execution"
  }
  
  skip_reason: String? {
    description: "Reason why step was skipped"
  }
  
  # ============================================
  # Lifecycle State Machine
  # ============================================
  
  lifecycle {
    initial: PENDING
    terminal: [COMPLETED, COMPENSATED, SKIPPED]
    
    transitions {
      PENDING -> RUNNING {
        trigger: execute
        action: {
          started_at = now()
          attempt = attempt + 1
        }
      }
      
      PENDING -> SKIPPED {
        trigger: skip
        guard: condition != null
        action: { }
      }
      
      RUNNING -> COMPLETED {
        trigger: success
        action: {
          completed_at = now()
        }
      }
      
      RUNNING -> FAILED {
        trigger: failure
        action: { }
      }
      
      FAILED -> RUNNING {
        trigger: retry
        guard: attempt < max_retries
        action: {
          error = null
          attempt = attempt + 1
          started_at = now()
        }
      }
      
      COMPLETED -> COMPENSATING {
        trigger: compensate
        guard: compensation_handler != null
        action: { }
      }
      
      COMPENSATING -> COMPENSATED {
        trigger: compensation_success
        action: {
          completed_at = now()
        }
      }
    }
  }
  
  # ============================================
  # Invariants
  # ============================================
  
  invariants {
    # Output only exists for completed steps
    output != null implies status in [COMPLETED, COMPENSATED]
    
    # Started timestamp when running or later
    started_at != null implies attempt > 0
    
    # Completed timestamp for terminal states
    completed_at != null implies status in [COMPLETED, COMPENSATED, SKIPPED]
    
    # Error exists when failed
    status == FAILED implies error != null
    
    # Attempt count within bounds
    attempt <= max_retries + 1
  }
  
  # ============================================
  # Computed Properties
  # ============================================
  
  computed {
    duration_ms: Int? = {
      if completed_at != null and started_at != null {
        completed_at - started_at
      } else {
        null
      }
    }
    
    is_compensatable: Boolean = {
      compensation_handler != null and status == StepStatus.COMPLETED
    }
    
    can_retry: Boolean = {
      status == StepStatus.FAILED and 
      attempt < max_retries and
      error != null and 
      error.recoverable
    }
    
    is_terminal: Boolean = {
      status in [COMPLETED, COMPENSATED, SKIPPED]
    }
  }
}

# ============================================
# Step Builder Pattern
# ============================================

type StepBuilder = {
  id: StepId
  
  methods {
    name(name: String): StepBuilder
    handler(handler: HandlerName): StepBuilder
    compensate(handler: HandlerName): StepBuilder
    timeout(duration: Duration): StepBuilder
    retries(max: Int, strategy: RetryStrategy?): StepBuilder
    onFailure(action: FailureAction): StepBuilder
    when(condition: String): StepBuilder
    input(data: Map<String, Any>): StepBuilder
    build(): StepDefinition
  }
}

# ============================================
# Step Result Types
# ============================================

type StepResult = {
  success: Boolean
  output: Map<String, Any>?
  error: StepError?
  duration_ms: Int
}

type StepExecutionContext = {
  workflow_id: WorkflowId
  step_id: StepId
  context: Map<String, Any>
  input: Map<String, Any>?
  attempt: Int
  timeout: Duration?
}
