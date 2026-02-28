# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: FeatureFlag, Variant, TargetingRule, Condition, ConditionOperator, RolloutConfig, BehaviorOverride, BehaviorModification, EvaluationContext, EvaluationResult, EvaluationReasoning, EvaluationReason, FlagProviderConfig, FlagAuditEvent, BehaviorGate
# dependencies: 

domain Types {
  version: "1.0.0"

  type FeatureFlag = String
  type Variant = String
  type TargetingRule = String
  type Condition = String
  type ConditionOperator = String
  type RolloutConfig = String
  type BehaviorOverride = String
  type BehaviorModification = String
  type EvaluationContext = String
  type EvaluationResult = String
  type EvaluationReasoning = String
  type EvaluationReason = String
  type FlagProviderConfig = String
  type FlagAuditEvent = String
  type BehaviorGate = String

  invariants exports_present {
    - true
  }
}
