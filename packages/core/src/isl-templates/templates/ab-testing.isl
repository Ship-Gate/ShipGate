# A/B Testing Domain
# Complete A/B testing with experiments, variants, and statistical analysis

domain ABTesting {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type ExperimentKey = String { max_length: 100, pattern: "^[a-z0-9-_]+$" }
  type VariantKey = String { max_length: 50 }
  
  enum ExperimentStatus {
    DRAFT
    RUNNING
    PAUSED
    COMPLETED
    ARCHIVED
  }
  
  enum ExperimentType {
    AB_TEST
    MULTIVARIATE
    FEATURE_TEST
    HOLDOUT
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity Experiment {
    id: UUID [immutable, unique]
    key: ExperimentKey [unique, indexed]
    name: String
    description: String?
    hypothesis: String?
    type: ExperimentType [default: AB_TEST]
    status: ExperimentStatus [default: DRAFT]
    variants: List<{
      key: VariantKey
      name: String
      weight: Int
      is_control: Boolean
      config: Map<String, Any>?
    }>
    targeting: {
      percentage: Int
      segments: List<String>?
      rules: List<Map<String, Any>>?
    }?
    metrics: List<{
      key: String
      name: String
      type: String
      is_primary: Boolean
    }>
    start_date: Timestamp?
    end_date: Timestamp?
    owner: String?
    tags: List<String>
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      variants.length >= 2
      variants.sum(v => v.weight) == 100
      variants.filter(v => v.is_control).length == 1
      end_date == null or end_date > start_date
    }
    
    lifecycle {
      DRAFT -> RUNNING
      RUNNING -> PAUSED
      PAUSED -> RUNNING
      RUNNING -> COMPLETED
      COMPLETED -> ARCHIVED
    }
  }
  
  entity ExperimentAssignment {
    id: UUID [immutable, unique]
    experiment_id: UUID [indexed]
    user_id: UUID [indexed]
    variant_key: VariantKey
    context: Map<String, Any>?
    assigned_at: Timestamp [immutable, indexed]
    
    invariants {
      (experiment_id, user_id) is unique
    }
  }
  
  entity ExperimentEvent {
    id: UUID [immutable, unique]
    experiment_id: UUID [indexed]
    user_id: UUID [indexed]
    variant_key: VariantKey
    event_type: String [indexed]
    metric_key: String?
    value: Decimal?
    metadata: Map<String, Any>?
    created_at: Timestamp [immutable, indexed]
  }
  
  entity ExperimentResults {
    id: UUID [immutable, unique]
    experiment_id: UUID [unique, indexed]
    computed_at: Timestamp
    sample_size: Int
    duration_days: Int
    variants: Map<VariantKey, {
      sample_size: Int
      conversion_rate: Decimal?
      mean_value: Decimal?
      confidence_interval: { lower: Decimal, upper: Decimal }?
    }>
    primary_metric: {
      control_value: Decimal
      treatment_value: Decimal
      lift: Decimal
      p_value: Decimal
      is_significant: Boolean
      confidence_level: Int
    }?
    secondary_metrics: List<{
      key: String
      lift: Decimal
      p_value: Decimal
      is_significant: Boolean
    }>?
    recommendation: String?
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior GetVariant {
    description: "Get experiment variant for a user"
    
    actors {
      System { }
    }
    
    input {
      experiment_key: ExperimentKey
      user_id: UUID
      context: Map<String, Any>?
    }
    
    output {
      success: {
        experiment_key: ExperimentKey
        variant_key: VariantKey
        variant_config: Map<String, Any>?
        is_control: Boolean
        in_experiment: Boolean
      }
      
      errors {
        EXPERIMENT_NOT_FOUND {
          when: "Experiment does not exist"
          retriable: false
        }
        EXPERIMENT_NOT_RUNNING {
          when: "Experiment is not currently running"
          retriable: false
        }
      }
    }
    
    postconditions {
      success and result.in_experiment implies {
        ExperimentAssignment.exists(
          experiment_id: experiment.id,
          user_id: input.user_id
        )
      }
    }
    
    temporal {
      response within 10ms (p99)
    }
  }
  
  behavior TrackEvent {
    description: "Track an event for experiment analysis"
    
    actors {
      System { }
    }
    
    input {
      experiment_key: ExperimentKey
      user_id: UUID
      event_type: String
      metric_key: String?
      value: Decimal?
      metadata: Map<String, Any>?
    }
    
    output {
      success: Boolean
      
      errors {
        NOT_IN_EXPERIMENT {
          when: "User not assigned to experiment"
          retriable: false
        }
      }
    }
    
    preconditions {
      ExperimentAssignment.exists(user_id: input.user_id, experiment_key: input.experiment_key)
    }
  }
  
  behavior CreateExperiment {
    description: "Create a new experiment"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      key: ExperimentKey
      name: String
      description: String?
      hypothesis: String?
      type: ExperimentType?
      variants: List<{
        key: VariantKey
        name: String
        weight: Int
        is_control: Boolean
        config: Map<String, Any>?
      }>
      metrics: List<{
        key: String
        name: String
        type: String
        is_primary: Boolean
      }>
      targeting: {
        percentage: Int
        segments: List<String>?
      }?
    }
    
    output {
      success: Experiment
      
      errors {
        KEY_EXISTS {
          when: "Experiment key already exists"
          retriable: false
        }
        INVALID_VARIANTS {
          when: "Variant weights must sum to 100"
          retriable: false
        }
        NO_CONTROL {
          when: "Must have exactly one control variant"
          retriable: false
        }
        NO_PRIMARY_METRIC {
          when: "Must have at least one primary metric"
          retriable: false
        }
      }
    }
  }
  
  behavior StartExperiment {
    description: "Start running an experiment"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      experiment_key: ExperimentKey
      end_date: Timestamp?
    }
    
    output {
      success: Experiment
      
      errors {
        EXPERIMENT_NOT_FOUND {
          when: "Experiment does not exist"
          retriable: false
        }
        ALREADY_RUNNING {
          when: "Experiment is already running"
          retriable: false
        }
        INVALID_CONFIGURATION {
          when: "Experiment configuration is incomplete"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        Experiment.lookup(input.experiment_key).status == RUNNING
        Experiment.lookup(input.experiment_key).start_date == now()
      }
    }
  }
  
  behavior StopExperiment {
    description: "Stop a running experiment"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      experiment_key: ExperimentKey
      winner_variant: VariantKey?
    }
    
    output {
      success: Experiment
    }
    
    postconditions {
      success implies {
        Experiment.lookup(input.experiment_key).status == COMPLETED
        Experiment.lookup(input.experiment_key).end_date == now()
      }
    }
  }
  
  behavior CalculateResults {
    description: "Calculate statistical results for an experiment"
    
    actors {
      System { }
      Admin { must: authenticated }
    }
    
    input {
      experiment_key: ExperimentKey
      confidence_level: Int [default: 95]
    }
    
    output {
      success: ExperimentResults
      
      errors {
        INSUFFICIENT_DATA {
          when: "Not enough data for statistical significance"
          retriable: true
        }
      }
    }
  }
  
  behavior GetExperimentAnalytics {
    description: "Get detailed analytics for an experiment"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      experiment_key: ExperimentKey
    }
    
    output {
      success: {
        experiment: Experiment
        results: ExperimentResults?
        timeline: List<{
          date: Timestamp
          variant: VariantKey
          conversions: Int
          total: Int
        }>
        current_sample_size: Int
        estimated_days_remaining: Int?
      }
    }
  }
  
  behavior OverrideVariant {
    description: "Force a specific variant for a user"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      experiment_key: ExperimentKey
      user_id: UUID
      variant_key: VariantKey
    }
    
    output {
      success: ExperimentAssignment
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios GetVariant {
    scenario "user gets consistent variant" {
      given {
        experiment = Experiment.create(
          key: "checkout-button-color",
          status: RUNNING,
          variants: [
            { key: "control", weight: 50, is_control: true },
            { key: "blue", weight: 50, is_control: false }
          ]
        )
      }
      
      when {
        result1 = GetVariant(experiment_key: "checkout-button-color", user_id: user.id)
        result2 = GetVariant(experiment_key: "checkout-button-color", user_id: user.id)
      }
      
      then {
        result1 is success
        result2 is success
        result1.variant_key == result2.variant_key
      }
    }
    
    scenario "user not in targeting" {
      given {
        experiment = Experiment.create(
          key: "premium-feature",
          targeting: { percentage: 10 }
        )
      }
      
      when {
        result = GetVariant(
          experiment_key: "premium-feature",
          user_id: user.id
        )
      }
      
      then {
        result is success
        // 90% chance user is not in experiment
        result.in_experiment == false implies result.variant_key == "control"
      }
    }
  }
}
