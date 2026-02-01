# Complete Behavior
# Handles workflow completion and final state management

behavior CompleteWorkflow {
  description: "Mark a workflow as completed successfully"
  
  domain: Workflow
  
  input {
    workflow_id: WorkflowId {
      description: "The workflow to complete"
    }
    
    final_output: Map<String, Any>? {
      description: "Final output data from the workflow"
    }
  }
  
  output {
    success: Workflow {
      description: "The completed workflow"
    }
    
    errors {
      WORKFLOW_NOT_FOUND {
        when: "Workflow does not exist"
      }
      
      INVALID_STATE {
        when: "Workflow cannot be completed from current state"
        message: "Cannot complete workflow in {status} state"
      }
      
      INCOMPLETE_STEPS {
        when: "Not all required steps are completed"
        message: "Steps not completed: {step_ids}"
      }
    }
  }
  
  preconditions {
    # Workflow must be in completable state
    workflow.status in [WorkflowStatus.RUNNING, WorkflowStatus.PAUSED]
    
    # All non-skipped steps must be completed
    workflow.steps
      .filter(s => s.status != StepStatus.SKIPPED)
      .all(s => s.status == StepStatus.COMPLETED)
  }
  
  postconditions {
    success implies {
      result.status == WorkflowStatus.COMPLETED
      result.completed_at != null
      result.current_step == null
    }
  }
  
  effects {
    update Workflow {
      status: WorkflowStatus.COMPLETED
      current_step: null
      completed_at: now()
      context: workflow.context.merge(input.final_output ?? {})
    }
    
    emit WorkflowCompleted {
      workflow_id: workflow.id
      name: workflow.name
      duration_ms: now() - workflow.started_at
      steps_completed: workflow.steps.filter(s => s.status == StepStatus.COMPLETED).length
      steps_skipped: workflow.steps.filter(s => s.status == StepStatus.SKIPPED).length
      final_context: workflow.context
    }
  }
}

behavior CancelWorkflow {
  description: "Cancel a running or paused workflow"
  
  input {
    workflow_id: WorkflowId
    reason: String?
    skip_compensation: Boolean?
  }
  
  output {
    success: Workflow
    
    errors {
      WORKFLOW_NOT_FOUND { }
      INVALID_STATE {
        when: "Workflow is already completed or cancelled"
      }
    }
  }
  
  preconditions {
    workflow.status in [WorkflowStatus.PENDING, WorkflowStatus.RUNNING, WorkflowStatus.PAUSED]
  }
  
  postconditions {
    success implies {
      result.status in [WorkflowStatus.CANCELLED, WorkflowStatus.COMPENSATING]
    }
  }
  
  effects {
    # If compensation is needed and not skipped
    if workflow.compensation_stack.length > 0 and not input.skip_compensation {
      call Compensate {
        workflow_id: workflow.id
        reason: input.reason ?? "Workflow cancelled"
      }
    } else {
      update Workflow {
        status: WorkflowStatus.CANCELLED
        completed_at: now()
        error: input.reason != null ? {
          code: "CANCELLED"
          message: input.reason
          timestamp: now()
        } : null
      }
      
      emit WorkflowCancelled {
        workflow_id: workflow.id
        reason: input.reason
        had_compensation: workflow.compensation_stack.length > 0
        skipped_compensation: input.skip_compensation
      }
    }
  }
}

behavior PauseWorkflow {
  description: "Pause a running workflow"
  
  input {
    workflow_id: WorkflowId
    reason: String?
  }
  
  output {
    success: Workflow
    
    errors {
      WORKFLOW_NOT_FOUND { }
      INVALID_STATE {
        when: "Workflow is not running"
      }
    }
  }
  
  preconditions {
    workflow.status == WorkflowStatus.RUNNING
  }
  
  postconditions {
    success implies {
      result.status == WorkflowStatus.PAUSED
    }
  }
  
  effects {
    update Workflow {
      status: WorkflowStatus.PAUSED
    }
    
    emit WorkflowPaused {
      workflow_id: workflow.id
      reason: input.reason
      current_step: workflow.current_step
    }
  }
}

behavior GetWorkflowStatus {
  description: "Get current status and progress of a workflow"
  
  input {
    workflow_id: WorkflowId
  }
  
  output {
    success: {
      workflow: Workflow
      progress: {
        total_steps: Int
        completed_steps: Int
        failed_steps: Int
        skipped_steps: Int
        percentage: Float
      }
      current_step: Step?
      estimated_time_remaining: Duration?
    }
    
    errors {
      WORKFLOW_NOT_FOUND { }
    }
  }
  
  effects {
    let total = workflow.steps.length
    let completed = workflow.steps.filter(s => s.status == StepStatus.COMPLETED).length
    let failed = workflow.steps.filter(s => s.status == StepStatus.FAILED).length
    let skipped = workflow.steps.filter(s => s.status == StepStatus.SKIPPED).length
    
    return {
      workflow: workflow
      progress: {
        total_steps: total
        completed_steps: completed
        failed_steps: failed
        skipped_steps: skipped
        percentage: (completed + skipped) / total * 100
      }
      current_step: workflow.current_step != null ? 
        workflow.steps.find(s => s.id == workflow.current_step) : null
      estimated_time_remaining: estimate_remaining_time(workflow)
    }
  }
}

behavior ListWorkflows {
  description: "List workflows with optional filtering"
  
  input {
    status: WorkflowStatus?
    name: String?
    correlation_id: String?
    created_after: Timestamp?
    created_before: Timestamp?
    limit: Int? [default: 50, max: 100]
    offset: Int? [default: 0]
  }
  
  output {
    success: {
      workflows: List<Workflow>
      total: Int
      has_more: Boolean
    }
  }
  
  effects {
    let query = Workflow.query()
    
    if input.status != null {
      query = query.where(status == input.status)
    }
    
    if input.name != null {
      query = query.where(name.contains(input.name))
    }
    
    if input.correlation_id != null {
      query = query.where(correlation_id == input.correlation_id)
    }
    
    if input.created_after != null {
      query = query.where(created_at >= input.created_after)
    }
    
    if input.created_before != null {
      query = query.where(created_at <= input.created_before)
    }
    
    let total = query.count()
    let workflows = query
      .order_by(created_at.desc)
      .limit(input.limit)
      .offset(input.offset)
      .execute()
    
    return {
      workflows: workflows
      total: total
      has_more: total > input.offset + workflows.length
    }
  }
}
