# Transition Behavior
# Handles step completion and workflow state transitions

behavior Transition {
  description: "Transition workflow to the next step after current step completes"
  
  domain: Workflow
  
  input {
    workflow_id: WorkflowId {
      description: "The workflow to transition"
    }
    
    step_output: Map<String, Any>? {
      description: "Output from the completed step"
    }
  }
  
  output {
    success: Workflow {
      description: "Updated workflow with new current step"
    }
    
    errors {
      WORKFLOW_NOT_FOUND {
        when: "Workflow does not exist"
      }
      
      INVALID_STATE {
        when: "Workflow is not in RUNNING state"
        message: "Cannot transition workflow in {status} state"
      }
      
      STEP_FAILED {
        when: "Step execution failed"
        message: "Step {step_id} failed: {error}"
      }
      
      TRANSITION_ERROR {
        when: "Could not determine next step"
        message: "Failed to transition: {reason}"
      }
    }
  }
  
  preconditions {
    # Workflow must be running
    Workflow.find(input.workflow_id).status == WorkflowStatus.RUNNING
    
    # Must have a current step
    Workflow.find(input.workflow_id).current_step != null
  }
  
  postconditions {
    success implies {
      # Either moved to new step or completed
      result.current_step != old(result.current_step) or
      result.status == WorkflowStatus.COMPLETED
      
      # Previous step is marked complete
      old_step.status == StepStatus.COMPLETED
      
      # Step output is stored
      input.step_output != null implies old_step.output == input.step_output
    }
  }
  
  effects {
    # Update completed step
    update Step[current_step] {
      status: StepStatus.COMPLETED
      output: input.step_output
      completed_at: now()
      duration_ms: now() - started_at
    }
    
    # Add to compensation stack if compensatable
    if step.compensation_handler != null {
      workflow.compensation_stack.push(step.id)
    }
    
    # Merge step output into context
    if input.step_output != null {
      workflow.context.merge(input.step_output)
    }
    
    # Determine next step
    let next = find_next_step(workflow)
    
    if next != null {
      # Transition to next step
      update Workflow {
        current_step: next.id
      }
      
      # Schedule next step execution
      schedule ExecuteStep {
        workflow_id: workflow.id
        step_id: next.id
      }
      
      emit StepTransitioned {
        workflow_id: workflow.id
        from_step: old_step.id
        to_step: next.id
      }
    } else {
      # Workflow complete
      update Workflow {
        status: WorkflowStatus.COMPLETED
        current_step: null
        completed_at: now()
      }
      
      emit WorkflowCompleted {
        workflow_id: workflow.id
        duration_ms: now() - workflow.started_at
      }
    }
  }
}

behavior ExecuteStep {
  description: "Execute a single workflow step"
  
  input {
    workflow_id: WorkflowId
    step_id: StepId
    retry_attempt: Int?
  }
  
  output {
    success: {
      step: Step
      output: Map<String, Any>?
    }
    
    errors {
      HANDLER_NOT_FOUND {
        when: "Step handler not registered"
      }
      
      TIMEOUT {
        when: "Step execution exceeded timeout"
      }
      
      EXECUTION_ERROR {
        when: "Handler threw an error"
        message: "Step execution failed: {error}"
      }
    }
  }
  
  preconditions {
    step.status in [StepStatus.PENDING, StepStatus.FAILED]
  }
  
  postconditions {
    success implies {
      result.step.status == StepStatus.COMPLETED
      result.step.completed_at != null
    }
  }
  
  effects {
    # Mark step as running
    update Step {
      status: StepStatus.RUNNING
      started_at: now()
      attempt: (input.retry_attempt ?? 0) + 1
    }
    
    # Invoke handler
    let result = invoke_handler(step.handler, {
      workflow_id: workflow.id
      step_id: step.id
      context: workflow.context
      input: step.input
    })
    
    if result.success {
      # Trigger transition
      call Transition {
        workflow_id: workflow.id
        step_output: result.output
      }
    } else {
      # Handle failure
      call HandleStepFailure {
        workflow_id: workflow.id
        step_id: step.id
        error: result.error
      }
    }
  }
  
  temporal {
    # Step should complete within timeout
    if step.timeout != null {
      within step.timeout: step.status != StepStatus.RUNNING
    }
  }
}

behavior HandleStepFailure {
  description: "Handle a failed step - retry or trigger compensation"
  
  input {
    workflow_id: WorkflowId
    step_id: StepId
    error: StepError
  }
  
  output {
    success: {
      action: FailureAction
      workflow: Workflow
    }
  }
  
  effects {
    # Update step with error
    update Step {
      status: StepStatus.FAILED
      error: input.error
    }
    
    # Check if retry is possible
    if step.attempt < step.max_retries and input.error.recoverable {
      # Schedule retry with backoff
      let delay = calculate_retry_delay(step)
      
      update Step {
        next_retry_at: now() + delay
      }
      
      schedule ExecuteStep {
        workflow_id: workflow.id
        step_id: step.id
        retry_attempt: step.attempt
        delay: delay
      }
      
      emit StepRetryScheduled {
        workflow_id: workflow.id
        step_id: step.id
        attempt: step.attempt + 1
        delay_ms: delay
      }
    } else {
      # Determine failure action
      let action = step.on_failure ?? FailureAction.COMPENSATE
      
      match action {
        FAIL_WORKFLOW => {
          update Workflow {
            status: WorkflowStatus.FAILED
            error: {
              code: "STEP_FAILED"
              message: input.error.message
              step_id: step.id
              timestamp: now()
            }
          }
          
          emit WorkflowFailed {
            workflow_id: workflow.id
            step_id: step.id
            error: input.error
          }
        }
        
        COMPENSATE => {
          call Compensate {
            workflow_id: workflow.id
            reason: "Step {step.id} failed: {input.error.message}"
          }
        }
        
        SKIP => {
          update Step {
            status: StepStatus.SKIPPED
          }
          
          call Transition {
            workflow_id: workflow.id
          }
        }
        
        PAUSE => {
          update Workflow {
            status: WorkflowStatus.PAUSED
          }
          
          emit WorkflowPausedForIntervention {
            workflow_id: workflow.id
            step_id: step.id
            error: input.error
          }
        }
      }
    }
  }
}
