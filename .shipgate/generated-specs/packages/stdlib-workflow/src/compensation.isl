# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: idempotentCompensation, logOnlyCompensation, apiCompensation, composeCompensations, withRetry, createCompensationExecutor, createCompensationPlan, CompensationAction, CompensationPlan, CompensationExecutionResult, CompensationFailure, CompensationExecutor, CompensationPlanBuilder
# dependencies: 

domain Compensation {
  version: "1.0.0"

  type CompensationAction = String
  type CompensationPlan = String
  type CompensationExecutionResult = String
  type CompensationFailure = String
  type CompensationExecutor = String
  type CompensationPlanBuilder = String

  invariants exports_present {
    - true
  }
}
