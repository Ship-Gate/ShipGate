# User Onboarding Domain
# Progressive onboarding flow with step tracking and personalization

domain Onboarding {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type StepId = String { max_length: 50 }
  
  enum OnboardingStatus {
    NOT_STARTED
    IN_PROGRESS
    COMPLETED
    SKIPPED
  }
  
  enum StepType {
    FORM
    ACTION
    TUTORIAL
    VERIFICATION
    OPTIONAL
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity OnboardingFlow {
    id: UUID [immutable, unique]
    slug: String [unique, indexed]
    name: String
    description: String?
    steps: List<{
      id: StepId
      name: String
      type: StepType
      order: Int
      required: Boolean
      dependencies: List<StepId>?
      config: Map<String, Any>?
    }>
    is_active: Boolean [default: true]
    target_audience: Map<String, Any>?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  entity UserOnboarding {
    id: UUID [immutable, unique]
    user_id: UUID [unique, indexed]
    flow_id: UUID [indexed]
    status: OnboardingStatus [default: NOT_STARTED]
    current_step: StepId?
    completed_steps: List<StepId>
    skipped_steps: List<StepId>
    step_data: Map<StepId, Map<String, Any>>
    progress_percentage: Int [default: 0]
    started_at: Timestamp?
    completed_at: Timestamp?
    last_activity_at: Timestamp?
    created_at: Timestamp [immutable]
    
    invariants {
      progress_percentage >= 0
      progress_percentage <= 100
      completed_at != null implies status == COMPLETED
    }
  }
  
  entity OnboardingEvent {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    step_id: StepId [indexed]
    event_type: String [values: ["started", "completed", "skipped", "failed"]]
    data: Map<String, Any>?
    duration_ms: Int?
    created_at: Timestamp [immutable, indexed]
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior StartOnboarding {
    description: "Start or resume onboarding for a user"
    
    actors {
      User { must: authenticated }
      System { }
    }
    
    input {
      flow_slug: String?
    }
    
    output {
      success: {
        onboarding: UserOnboarding
        current_step: {
          id: StepId
          name: String
          type: StepType
          config: Map<String, Any>?
        }
        total_steps: Int
        completed_steps: Int
      }
      
      errors {
        FLOW_NOT_FOUND {
          when: "Onboarding flow does not exist"
          retriable: false
        }
        ALREADY_COMPLETED {
          when: "Onboarding was already completed"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        UserOnboarding.exists(user_id: actor.id)
        UserOnboarding.lookup(actor.id).status == IN_PROGRESS
      }
    }
  }
  
  behavior CompleteStep {
    description: "Mark an onboarding step as complete"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      step_id: StepId
      data: Map<String, Any>?
    }
    
    output {
      success: {
        onboarding: UserOnboarding
        next_step: {
          id: StepId
          name: String
          type: StepType
          config: Map<String, Any>?
        }?
        is_complete: Boolean
      }
      
      errors {
        STEP_NOT_FOUND {
          when: "Step does not exist in flow"
          retriable: false
        }
        DEPENDENCIES_NOT_MET {
          when: "Required steps not completed"
          retriable: false
        }
        INVALID_STEP_DATA {
          when: "Step data validation failed"
          retriable: true
        }
      }
    }
    
    postconditions {
      success implies {
        input.step_id in UserOnboarding.lookup(actor.id).completed_steps
        result.is_complete implies UserOnboarding.lookup(actor.id).status == COMPLETED
      }
    }
    
    effects {
      Analytics { track_step_completion }
    }
  }
  
  behavior SkipStep {
    description: "Skip an optional onboarding step"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      step_id: StepId
    }
    
    output {
      success: {
        onboarding: UserOnboarding
        next_step: {
          id: StepId
          name: String
          type: StepType
        }?
      }
      
      errors {
        STEP_NOT_FOUND {
          when: "Step does not exist"
          retriable: false
        }
        STEP_REQUIRED {
          when: "Cannot skip required step"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        input.step_id in UserOnboarding.lookup(actor.id).skipped_steps
      }
    }
  }
  
  behavior GetProgress {
    description: "Get user's onboarding progress"
    
    actors {
      User { must: authenticated }
    }
    
    output {
      success: {
        status: OnboardingStatus
        progress_percentage: Int
        current_step: StepId?
        completed_steps: List<{
          id: StepId
          name: String
          completed_at: Timestamp
        }>
        remaining_steps: List<{
          id: StepId
          name: String
          type: StepType
          required: Boolean
        }>
      }
    }
  }
  
  behavior ResetOnboarding {
    description: "Reset onboarding progress (admin/support use)"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      user_id: UUID
      keep_data: Boolean [default: false]
    }
    
    output {
      success: UserOnboarding
    }
    
    postconditions {
      success implies {
        UserOnboarding.lookup(input.user_id).status == NOT_STARTED
        UserOnboarding.lookup(input.user_id).completed_steps.length == 0
      }
    }
  }
  
  behavior UpdateStepData {
    description: "Save progress data for a step"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      step_id: StepId
      data: Map<String, Any>
    }
    
    output {
      success: Boolean
    }
  }
  
  behavior GetOnboardingAnalytics {
    description: "Get analytics for onboarding flows"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      flow_id: UUID?
      from_date: Timestamp?
      to_date: Timestamp?
    }
    
    output {
      success: {
        total_started: Int
        total_completed: Int
        completion_rate: Decimal
        average_duration_hours: Decimal
        drop_off_by_step: Map<StepId, Int>
        step_completion_rates: Map<StepId, Decimal>
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios CompleteStep {
    scenario "complete step and advance" {
      given {
        onboarding = UserOnboarding.create(
          user_id: user.id,
          status: IN_PROGRESS,
          current_step: "profile",
          completed_steps: []
        )
      }
      
      when {
        result = CompleteStep(
          step_id: "profile",
          data: { name: "John Doe", bio: "Developer" }
        )
      }
      
      then {
        result is success
        "profile" in result.onboarding.completed_steps
        result.next_step != null
      }
    }
    
    scenario "complete final step" {
      given {
        onboarding = UserOnboarding.create(
          user_id: user.id,
          current_step: "preferences",
          completed_steps: ["profile", "team"]
        )
      }
      
      when {
        result = CompleteStep(step_id: "preferences")
      }
      
      then {
        result is success
        result.is_complete == true
        result.next_step == null
      }
    }
  }
}
