# Compensate Behavior
# Saga pattern compensation - rollback completed steps in reverse order

behavior Compensate {
  description: "Trigger compensation (rollback) for a workflow"
  
  domain: Workflow
  
  input {
    workflow_id: WorkflowId {
      description: "The workflow to compensate"
    }
    
    reason: String? {
      description: "Reason for triggering compensation"
    }
    
    from_step: StepId? {
      description: "Start compensation from this step (defaults to last completed)"
    }
  }
  
  output {
    success: Workflow {
      description: "Workflow in COMPENSATING or COMPENSATED state"
    }
    
    errors {
      WORKFLOW_NOT_FOUND {
        when: "Workflow does not exist"
      }
      
      INVALID_STATE {
        when: "Workflow cannot be compensated from current state"
        message: "Cannot compensate workflow in {status} state"
      }
      
      NO_COMPENSATION_NEEDED {
        when: "No steps have compensation handlers"
        message: "No compensatable steps found"
      }
    }
  }
  
  preconditions {
    # Workflow must be in compensatable state
    workflow.status in [WorkflowStatus.RUNNING, WorkflowStatus.FAILED, WorkflowStatus.PAUSED]
    
    # Must have compensation stack
    workflow.compensation_stack.length > 0
  }
  
  postconditions {
    success implies {
      result.status in [WorkflowStatus.COMPENSATING, WorkflowStatus.COMPENSATED]
    }
  }
  
  effects {
    update Workflow {
      status: WorkflowStatus.COMPENSATING
      error: {
        code: "COMPENSATION_TRIGGERED"
        message: input.reason ?? "Compensation triggered"
        timestamp: now()
      }
    }
    
    emit CompensationStarted {
      workflow_id: workflow.id
      reason: input.reason
      steps_to_compensate: workflow.compensation_stack.length
    }
    
    # Start compensation from the last completed step
    call ExecuteCompensation {
      workflow_id: workflow.id
      step_index: 0  # Start from top of stack (last completed)
    }
  }
  
  temporal {
    # Compensation should complete within reasonable time
    eventually within 1.hour: 
      workflow.status == WorkflowStatus.COMPENSATED
  }
}

behavior ExecuteCompensation {
  description: "Execute compensation handler for a single step"
  
  input {
    workflow_id: WorkflowId
    step_index: Int {
      description: "Index in compensation stack (0 = most recent)"
    }
  }
  
  output {
    success: {
      step: Step
      remaining: Int
    }
    
    errors {
      COMPENSATION_FAILED {
        when: "Compensation handler failed"
        message: "Compensation for step {step_id} failed: {error}"
      }
    }
  }
  
  preconditions {
    workflow.status == WorkflowStatus.COMPENSATING
    input.step_index < workflow.compensation_stack.length
  }
  
  effects {
    let step_id = workflow.compensation_stack[input.step_index]
    let step = workflow.steps.find(s => s.id == step_id)
    
    # Mark step as compensating
    update Step[step_id] {
      status: StepStatus.COMPENSATING
    }
    
    emit CompensationStepStarted {
      workflow_id: workflow.id
      step_id: step_id
      index: input.step_index
      remaining: workflow.compensation_stack.length - input.step_index - 1
    }
    
    # Invoke compensation handler
    let result = invoke_handler(step.compensation_handler, {
      workflow_id: workflow.id
      step_id: step_id
      context: workflow.context
      original_input: step.input
      original_output: step.output
    })
    
    if result.success {
      # Mark step as compensated
      update Step[step_id] {
        status: StepStatus.COMPENSATED
      }
      
      emit CompensationStepCompleted {
        workflow_id: workflow.id
        step_id: step_id
      }
      
      # Continue to next step in stack
      if input.step_index + 1 < workflow.compensation_stack.length {
        call ExecuteCompensation {
          workflow_id: workflow.id
          step_index: input.step_index + 1
        }
      } else {
        # All compensations complete
        call CompleteCompensation {
          workflow_id: workflow.id
        }
      }
    } else {
      # Compensation failed - this is serious
      update Step[step_id] {
        error: result.error
      }
      
      emit CompensationStepFailed {
        workflow_id: workflow.id
        step_id: step_id
        error: result.error
      }
      
      # Depending on configuration, may continue or halt
      call HandleCompensationFailure {
        workflow_id: workflow.id
        step_id: step_id
        error: result.error
      }
    }
  }
}

behavior CompleteCompensation {
  description: "Mark compensation as complete"
  
  input {
    workflow_id: WorkflowId
  }
  
  output {
    success: Workflow
  }
  
  preconditions {
    workflow.status == WorkflowStatus.COMPENSATING
    
    # All compensatable steps are compensated
    workflow.compensation_stack.all(id =>
      workflow.steps.find(s => s.id == id).status == StepStatus.COMPENSATED
    )
  }
  
  postconditions {
    success implies {
      result.status == WorkflowStatus.COMPENSATED
      result.completed_at != null
    }
  }
  
  effects {
    update Workflow {
      status: WorkflowStatus.COMPENSATED
      completed_at: now()
    }
    
    emit CompensationCompleted {
      workflow_id: workflow.id
      steps_compensated: workflow.compensation_stack.length
      duration_ms: now() - workflow.error.timestamp
    }
  }
}

behavior HandleCompensationFailure {
  description: "Handle failure during compensation"
  
  input {
    workflow_id: WorkflowId
    step_id: StepId
    error: StepError
  }
  
  output {
    success: {
      action: CompensationFailureAction
      workflow: Workflow
    }
  }
  
  effects {
    # Log critical error - compensation failures need attention
    emit CompensationFailureCritical {
      workflow_id: workflow.id
      step_id: input.step_id
      error: input.error
      severity: "CRITICAL"
    }
    
    # Options:
    # 1. Continue with remaining compensations
    # 2. Halt and require manual intervention
    # 3. Retry compensation
    
    # Default: Continue but mark for review
    update Workflow {
      metadata: workflow.metadata.set(
        "compensation_failure_step", 
        input.step_id
      )
    }
    
    # Continue with remaining compensations
    let current_index = workflow.compensation_stack.indexOf(input.step_id)
    
    if current_index + 1 < workflow.compensation_stack.length {
      call ExecuteCompensation {
        workflow_id: workflow.id
        step_index: current_index + 1
      }
    } else {
      # All done, but with failures
      update Workflow {
        status: WorkflowStatus.COMPENSATED
        completed_at: now()
        metadata: workflow.metadata.set(
          "compensation_partial", 
          "true"
        )
      }
      
      emit CompensationCompletedWithFailures {
        workflow_id: workflow.id
        failed_steps: [input.step_id]
      }
    }
  }
}

behavior RetryCompensation {
  description: "Retry a failed compensation step"
  
  input {
    workflow_id: WorkflowId
    step_id: StepId
  }
  
  output {
    success: Step
    
    errors {
      STEP_NOT_FAILED {
        when: "Step is not in failed compensation state"
      }
    }
  }
  
  preconditions {
    workflow.status == WorkflowStatus.COMPENSATING
    step.status == StepStatus.COMPENSATING
    step.error != null
  }
  
  effects {
    # Reset step for retry
    update Step[step_id] {
      error: null
    }
    
    # Re-execute compensation
    let index = workflow.compensation_stack.indexOf(input.step_id)
    
    call ExecuteCompensation {
      workflow_id: workflow.id
      step_index: index
    }
  }
}

# ============================================
# Saga-specific behaviors
# ============================================

behavior DefineSaga {
  description: "Define a saga with steps and compensations"
  
  input {
    name: String
    steps: List<SagaStep>
  }
  
  output {
    success: SagaDefinition
    
    errors {
      INVALID_SAGA {
        when: "Saga definition is invalid"
      }
    }
  }
  
  preconditions {
    # Each step with side effects must have compensation
    input.steps
      .filter(s => s.has_side_effects)
      .all(s => s.compensation_handler != null)
  }
}

type SagaStep = {
  id: StepId
  name: String
  handler: HandlerName
  compensation_handler: HandlerName?
  has_side_effects: Boolean
  idempotent: Boolean
  timeout: Duration?
}

type SagaDefinition = {
  id: UUID
  name: String
  steps: List<SagaStep>
  version: String
  created_at: Timestamp
}
