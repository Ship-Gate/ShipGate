# Start Workflow Behavior
# Initializes and begins workflow execution

behavior StartWorkflow {
  description: "Create and start a new workflow instance"
  
  domain: Workflow
  
  input {
    name: String {
      description: "Unique name for this workflow type"
      validation: non_empty
    }
    
    description: String? {
      description: "Human-readable description"
    }
    
    steps: List<StepDefinition> {
      description: "Ordered list of steps to execute"
      validation: {
        min_length: 1
        max_length: 100
      }
    }
    
    initial_context: Map<String, Any>? {
      description: "Initial data available to all steps"
    }
    
    correlation_id: String? {
      description: "External correlation ID for tracing"
    }
    
    metadata: Map<String, String>? {
      description: "Additional metadata"
    }
  }
  
  output {
    success: Workflow {
      description: "The created and started workflow"
    }
    
    errors {
      INVALID_WORKFLOW {
        when: "Workflow definition is invalid"
        message: "Workflow validation failed: {reason}"
      }
      
      DUPLICATE_STEP_IDS {
        when: "Two or more steps have the same ID"
        message: "Duplicate step ID: {step_id}"
      }
      
      INVALID_HANDLER {
        when: "A step references a non-existent handler"
        message: "Unknown handler: {handler_name}"
      }
      
      CYCLE_DETECTED {
        when: "Step dependencies form a cycle"
        message: "Circular dependency detected in workflow steps"
      }
    }
  }
  
  preconditions {
    # Steps must have unique IDs
    steps.map(s => s.id).unique()
    
    # At least one step required
    steps.length > 0
  }
  
  postconditions {
    success implies {
      # Workflow was created
      Workflow.exists(result.id)
      
      # Status is RUNNING
      result.status == WorkflowStatus.RUNNING
      
      # First step is current
      result.current_step == result.steps[0].id
      
      # All steps are initialized
      result.steps.all(s => s.status == StepStatus.PENDING or s.status == StepStatus.RUNNING)
      
      # Started timestamp is set
      result.started_at != null
      
      # Context is initialized
      result.context != null
    }
  }
  
  effects {
    # Create workflow entity
    create Workflow {
      id: generate_uuid()
      name: input.name
      description: input.description
      status: WorkflowStatus.RUNNING
      current_step: input.steps[0].id
      context: input.initial_context ?? {}
      steps: input.steps.map(def => create_step(def))
      compensation_stack: []
      created_at: now()
      started_at: now()
      correlation_id: input.correlation_id
      metadata: input.metadata
    }
    
    # Emit workflow started event
    emit WorkflowStarted {
      workflow_id: result.id
      name: input.name
      step_count: input.steps.length
    }
    
    # Schedule first step execution
    schedule ExecuteStep {
      workflow_id: result.id
      step_id: input.steps[0].id
      delay: 0
    }
  }
  
  temporal {
    # Workflow should complete or fail within reasonable time
    eventually within 24.hours: 
      result.status in [COMPLETED, FAILED, COMPENSATED, CANCELLED]
  }
}

behavior StartWorkflowAsync {
  description: "Create workflow without immediately starting execution"
  
  input {
    name: String
    steps: List<StepDefinition>
    initial_context: Map<String, Any>?
    scheduled_start: Timestamp?
  }
  
  output {
    success: Workflow
    errors {
      INVALID_WORKFLOW { }
    }
  }
  
  postconditions {
    success implies {
      result.status == WorkflowStatus.PENDING
      result.started_at == null
    }
  }
}

behavior ResumeWorkflow {
  description: "Resume a paused workflow"
  
  input {
    workflow_id: WorkflowId
    updated_context: Map<String, Any>?
  }
  
  output {
    success: Workflow
    errors {
      WORKFLOW_NOT_FOUND { }
      INVALID_STATE {
        when: "Workflow is not paused"
        message: "Cannot resume workflow in {status} state"
      }
    }
  }
  
  preconditions {
    workflow.status == WorkflowStatus.PAUSED
  }
  
  postconditions {
    success implies {
      result.status == WorkflowStatus.RUNNING
    }
  }
}
