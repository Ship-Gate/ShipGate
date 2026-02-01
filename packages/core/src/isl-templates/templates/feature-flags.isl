# Feature Flags Domain
# Feature flag management with targeting and gradual rollouts

domain FeatureFlags {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type FlagKey = String { max_length: 100, pattern: "^[a-z0-9-_]+$" }
  
  enum FlagType {
    BOOLEAN
    STRING
    NUMBER
    JSON
  }
  
  enum RolloutStrategy {
    ALL
    PERCENTAGE
    USER_LIST
    SEGMENT
    RULE_BASED
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity FeatureFlag {
    id: UUID [immutable, unique]
    key: FlagKey [unique, indexed]
    name: String
    description: String?
    type: FlagType [default: BOOLEAN]
    default_value: Any
    enabled: Boolean [default: false]
    environments: Map<String, {
      enabled: Boolean
      value: Any?
      rollout_percentage: Int?
    }>
    tags: List<String>
    owner: String?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    archived_at: Timestamp?
    
    invariants {
      key.length > 0
    }
  }
  
  entity FlagRule {
    id: UUID [immutable, unique]
    flag_id: UUID [indexed]
    name: String
    priority: Int
    conditions: List<{
      attribute: String
      operator: String
      value: Any
    }>
    value: Any
    rollout_percentage: Int?
    enabled: Boolean [default: true]
    created_at: Timestamp [immutable]
    
    invariants {
      priority >= 0
      rollout_percentage == null or (rollout_percentage >= 0 and rollout_percentage <= 100)
    }
  }
  
  entity UserSegment {
    id: UUID [immutable, unique]
    key: String [unique, indexed]
    name: String
    description: String?
    rules: List<{
      attribute: String
      operator: String
      value: Any
    }>
    included_users: List<UUID>?
    excluded_users: List<UUID>?
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  entity FlagEvaluation {
    id: UUID [immutable, unique]
    flag_key: FlagKey [indexed]
    user_id: UUID? [indexed]
    context: Map<String, Any>?
    result: Any
    rule_matched: String?
    environment: String
    evaluated_at: Timestamp [immutable, indexed]
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior EvaluateFlag {
    description: "Evaluate a feature flag for a user/context"
    
    actors {
      System { }
    }
    
    input {
      flag_key: FlagKey
      user_id: UUID?
      context: Map<String, Any>?
      environment: String [default: "production"]
    }
    
    output {
      success: {
        key: FlagKey
        enabled: Boolean
        value: Any
        rule_matched: String?
        reason: String
      }
      
      errors {
        FLAG_NOT_FOUND {
          when: "Feature flag does not exist"
          retriable: false
        }
      }
    }
    
    temporal {
      response within 5ms (p50)
      response within 20ms (p99)
    }
  }
  
  behavior EvaluateAllFlags {
    description: "Evaluate all flags for a user"
    
    actors {
      System { }
    }
    
    input {
      user_id: UUID?
      context: Map<String, Any>?
      environment: String [default: "production"]
      include_archived: Boolean [default: false]
    }
    
    output {
      success: {
        flags: Map<FlagKey, {
          enabled: Boolean
          value: Any
        }>
      }
    }
    
    temporal {
      response within 50ms (p99)
    }
  }
  
  behavior CreateFlag {
    description: "Create a new feature flag"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      key: FlagKey
      name: String
      description: String?
      type: FlagType [default: BOOLEAN]
      default_value: Any
      tags: List<String>?
    }
    
    output {
      success: FeatureFlag
      
      errors {
        KEY_ALREADY_EXISTS {
          when: "Flag key already exists"
          retriable: false
        }
        INVALID_DEFAULT_VALUE {
          when: "Default value doesn't match type"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        FeatureFlag.exists(key: input.key)
      }
    }
    
    effects {
      AuditLog { log_flag_created }
    }
  }
  
  behavior UpdateFlag {
    description: "Update a feature flag"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      key: FlagKey
      name: String?
      description: String?
      default_value: Any?
      enabled: Boolean?
      tags: List<String>?
    }
    
    output {
      success: FeatureFlag
      
      errors {
        FLAG_NOT_FOUND {
          when: "Feature flag does not exist"
          retriable: false
        }
      }
    }
    
    effects {
      AuditLog { log_flag_updated }
      Cache { invalidate_flag }
    }
  }
  
  behavior ToggleFlag {
    description: "Enable or disable a feature flag"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      key: FlagKey
      enabled: Boolean
      environment: String?
    }
    
    output {
      success: FeatureFlag
    }
    
    postconditions {
      success implies {
        input.environment == null implies 
          FeatureFlag.lookup(input.key).enabled == input.enabled
      }
    }
    
    effects {
      AuditLog { log_flag_toggled }
    }
  }
  
  behavior AddRule {
    description: "Add a targeting rule to a flag"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      flag_key: FlagKey
      name: String
      conditions: List<{
        attribute: String
        operator: String
        value: Any
      }>
      value: Any
      rollout_percentage: Int?
      priority: Int?
    }
    
    output {
      success: FlagRule
      
      errors {
        FLAG_NOT_FOUND {
          when: "Feature flag does not exist"
          retriable: false
        }
        INVALID_CONDITIONS {
          when: "Rule conditions are invalid"
          retriable: false
        }
      }
    }
  }
  
  behavior SetRolloutPercentage {
    description: "Set gradual rollout percentage"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      key: FlagKey
      percentage: Int
      environment: String?
    }
    
    output {
      success: FeatureFlag
      
      errors {
        INVALID_PERCENTAGE {
          when: "Percentage must be 0-100"
          retriable: false
        }
      }
    }
    
    preconditions {
      input.percentage >= 0
      input.percentage <= 100
    }
  }
  
  behavior CreateSegment {
    description: "Create a user segment for targeting"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      key: String
      name: String
      description: String?
      rules: List<{
        attribute: String
        operator: String
        value: Any
      }>
    }
    
    output {
      success: UserSegment
    }
  }
  
  behavior ArchiveFlag {
    description: "Archive a feature flag"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      key: FlagKey
    }
    
    output {
      success: FeatureFlag
    }
    
    postconditions {
      success implies {
        FeatureFlag.lookup(input.key).archived_at != null
      }
    }
  }
  
  behavior GetFlagHistory {
    description: "Get change history for a flag"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      key: FlagKey
      limit: Int [default: 50]
    }
    
    output {
      success: {
        changes: List<{
          timestamp: Timestamp
          user: String
          action: String
          old_value: Any?
          new_value: Any?
        }>
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios EvaluateFlag {
    scenario "flag enabled for percentage" {
      given {
        flag = FeatureFlag.create(
          key: "new-feature",
          enabled: true,
          environments: {
            "production": { rollout_percentage: 50 }
          }
        )
      }
      
      when {
        result = EvaluateFlag(
          flag_key: "new-feature",
          user_id: user.id,
          environment: "production"
        )
      }
      
      then {
        result is success
        // Result depends on user hash
        result.reason == "percentage_rollout"
      }
    }
    
    scenario "flag with rule match" {
      given {
        flag = FeatureFlag.create(key: "premium-feature", enabled: true)
        rule = FlagRule.create(
          flag_id: flag.id,
          conditions: [{ attribute: "plan", operator: "equals", value: "premium" }],
          value: true
        )
      }
      
      when {
        result = EvaluateFlag(
          flag_key: "premium-feature",
          context: { plan: "premium" }
        )
      }
      
      then {
        result is success
        result.enabled == true
        result.rule_matched == rule.name
      }
    }
  }
}
