# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createInferenceContext, registerEffect, enterScope, exitScope, isEffectHandled, getUnhandledEffects, inferPure, inferPerform, inferFlatMap, inferHandle, solveConstraints, isSubtype, unionRows, differenceRows, effectful, pureFunction, documentEffect, ExtractEffects, ExtractResult, InRow, EffectNames, InferenceContext, EffectScope, EffectConstraint, SolverResult, ConstraintError
# dependencies: 

domain Inference {
  version: "1.0.0"

  type ExtractEffects = String
  type ExtractResult = String
  type InRow = String
  type EffectNames = String
  type InferenceContext = String
  type EffectScope = String
  type EffectConstraint = String
  type SolverResult = String
  type ConstraintError = String

  invariants exports_present {
    - true
  }
}
