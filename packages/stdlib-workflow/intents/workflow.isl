# Workflow Entity
# Full specification of the Workflow entity

entity Workflow {
  description: "A workflow instance representing a series of orchestrated steps"
  
  domain: Workflow
  version: "1.0.0"
  
  # ============================================
  # Identity
  # ============================================
  
  id: WorkflowId {
    constraints: [immutable, unique]
    description: "Unique identifier for this workflow instance"
    generated: uuid_v4
  }
  
  # ============================================
  # Core Fields
  # ============================================
  
  name: String {
    description: "Name identifying the workflow type"
    constraints: [required, non_empty]
    indexed: true
  }
  
  description: String? {
    description: "Human-readable description"
  }
  
  status: WorkflowStatus {
    description: "Current execution status"
    default: WorkflowStatus.PENDING
    indexed: true
  }
  
  # ============================================
  # Execution State
  # ============================================
  
  current_step: StepId? {
    description: "ID of the currently executing step"
  }
  
  context: Map<String, Any> {
    description: "Shared context data accessible to all steps"
    default: {}
  }
  
  # ============================================
  # Steps
  # ============================================
  
  steps: List<Step> {
    description: "Ordered list of steps in this workflow"
    constraints: [non_empty]
    embedded: true
  }
  
  compensation_stack: List<StepId> {
    description: "Stack of step IDs to compensate (LIFO order)"
    default: []
  }
  
  # ============================================
  # Timing
  # ============================================
  
  created_at: Timestamp {
    constraints: [immutable]
    default: now()
    indexed: true
  }
  
  started_at: Timestamp? {
    description: "When workflow execution began"
  }
  
  completed_at: Timestamp? {
    description: "When workflow finished (completed, failed, or compensated)"
  }
  
  # ============================================
  # Error Handling
  # ============================================
  
  error: WorkflowError? {
    description: "Error information if workflow failed"
  }
  
  # ============================================
  # Metadata
  # ============================================
  
  correlation_id: String? {
    description: "External correlation ID for distributed tracing"
    indexed: true
  }
  
  metadata: Map<String, String>? {
    description: "Additional key-value metadata"
  }
  
  version: Int {
    description: "Optimistic locking version"
    default: 1
  }
  
  # ============================================
  # Lifecycle State Machine
  # ============================================
  
  lifecycle {
    initial: PENDING
    terminal: [COMPLETED, COMPENSATED, CANCELLED]
    
    transitions {
      PENDING -> RUNNING {
        trigger: start
        guard: steps.length > 0
        action: {
          started_at = now()
          current_step = steps[0].id
        }
      }
      
      RUNNING -> PAUSED {
        trigger: pause
        action: { }
      }
      
      PAUSED -> RUNNING {
        trigger: resume
        action: { }
      }
      
      RUNNING -> COMPLETED {
        trigger: complete
        guard: {
          steps.filter(s => s.status != StepStatus.SKIPPED)
               .all(s => s.status == StepStatus.COMPLETED)
        }
        action: {
          completed_at = now()
          current_step = null
        }
      }
      
      RUNNING -> FAILED {
        trigger: fail
        action: {
          completed_at = now()
        }
      }
      
      RUNNING -> COMPENSATING {
        trigger: compensate
        guard: compensation_stack.length > 0
        action: { }
      }
      
      FAILED -> COMPENSATING {
        trigger: compensate
        guard: compensation_stack.length > 0
        action: { }
      }
      
      COMPENSATING -> COMPENSATED {
        trigger: compensation_complete
        action: {
          completed_at = now()
        }
      }
      
      RUNNING -> CANCELLED {
        trigger: cancel
        action: {
          completed_at = now()
        }
      }
      
      PAUSED -> CANCELLED {
        trigger: cancel
        action: {
          completed_at = now()
        }
      }
      
      PENDING -> CANCELLED {
        trigger: cancel
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
    # Started timestamp should be set when running
    status == RUNNING implies started_at != null
    
    # Completed timestamp should be set when terminal
    status in [COMPLETED, COMPENSATED, CANCELLED] implies completed_at != null
    
    # Current step should be null when not running
    status in [COMPLETED, COMPENSATED, CANCELLED] implies current_step == null
    
    # Current step should exist in steps
    current_step != null implies steps.exists(s => s.id == current_step)
    
    # Compensation stack should only contain completed steps
    compensation_stack.all(id => 
      steps.find(s => s.id == id).status == StepStatus.COMPLETED or
      steps.find(s => s.id == id).status == StepStatus.COMPENSATED
    )
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
    
    progress_percentage: Float = {
      let completed = steps.filter(s => 
        s.status in [StepStatus.COMPLETED, StepStatus.SKIPPED]
      ).length
      completed / steps.length * 100
    }
    
    is_terminal: Boolean = {
      status in [COMPLETED, COMPENSATED, CANCELLED, FAILED]
    }
    
    has_failed_steps: Boolean = {
      steps.exists(s => s.status == StepStatus.FAILED)
    }
  }
  
  # ============================================
  # Indices
  # ============================================
  
  indices {
    by_status: [status, created_at.desc]
    by_name: [name, created_at.desc]
    by_correlation: [correlation_id] where correlation_id != null
    active: [status] where status in [RUNNING, COMPENSATING]
  }
}
