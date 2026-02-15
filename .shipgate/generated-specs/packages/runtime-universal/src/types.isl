# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ExecutionContext, Actor, StateSnapshot, EntityState, ExecutionMetadata, BehaviorDefinition, ParameterDefinition, TypeDefinition, ConditionDefinition, EffectDefinition, ConstraintDefinition, RetryPolicy, ExecutionResult, ExecutionError, AppliedEffect, VerificationResult, ConditionResult, StateChange, RuntimeConfig, RuntimeEvent, RuntimeEventType, RuntimePlugin, RuntimeAPI, EffectHandler, Validator
# dependencies: 

domain Types {
  version: "1.0.0"

  type ExecutionContext = String
  type Actor = String
  type StateSnapshot = String
  type EntityState = String
  type ExecutionMetadata = String
  type BehaviorDefinition = String
  type ParameterDefinition = String
  type TypeDefinition = String
  type ConditionDefinition = String
  type EffectDefinition = String
  type ConstraintDefinition = String
  type RetryPolicy = String
  type ExecutionResult = String
  type ExecutionError = String
  type AppliedEffect = String
  type VerificationResult = String
  type ConditionResult = String
  type StateChange = String
  type RuntimeConfig = String
  type RuntimeEvent = String
  type RuntimeEventType = String
  type RuntimePlugin = String
  type RuntimeAPI = String
  type EffectHandler = String
  type Validator = String

  invariants exports_present {
    - true
  }
}
