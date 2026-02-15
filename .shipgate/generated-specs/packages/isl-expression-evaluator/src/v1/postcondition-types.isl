# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isIncreasedByPredicate, isNoneCreatedPredicate, isEntityCreatedPredicate, isIncrementedPredicate, isPostconditionPredicate, increasedBy, noneCreated, entityCreated, incremented, simplePath, methodCallField, literalDelta, variableDelta, PostconditionPredicate, IncreasedByPredicate, NoneCreatedPredicate, EntityCreatedPredicate, IncrementedPredicate, FieldReference, SimpleFieldPath, MethodCallField, ExpressionField, DeltaValue, PostconditionContext, StateSnapshot, EntityState, TraceEventData, PostconditionResult, PostconditionDetails
# dependencies: 

domain PostconditionTypes {
  version: "1.0.0"

  type PostconditionPredicate = String
  type IncreasedByPredicate = String
  type NoneCreatedPredicate = String
  type EntityCreatedPredicate = String
  type IncrementedPredicate = String
  type FieldReference = String
  type SimpleFieldPath = String
  type MethodCallField = String
  type ExpressionField = String
  type DeltaValue = String
  type PostconditionContext = String
  type StateSnapshot = String
  type EntityState = String
  type TraceEventData = String
  type PostconditionResult = String
  type PostconditionDetails = String

  invariants exports_present {
    - true
  }
}
