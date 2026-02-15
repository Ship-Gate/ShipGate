# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: saga, success, failure, compensated, skipped, exponentialBackoff, Saga, SagaStep, SagaContext, SagaStepResult, CompensationResult, CompensationPolicy, RetryPolicy, BackoffStrategy, SagaStatus, SagaExecution, SagaResult, SagaBuilder, SagaExecutor
# dependencies: 

domain Saga {
  version: "1.0.0"

  type Saga = String
  type SagaStep = String
  type SagaContext = String
  type SagaStepResult = String
  type CompensationResult = String
  type CompensationPolicy = String
  type RetryPolicy = String
  type BackoffStrategy = String
  type SagaStatus = String
  type SagaExecution = String
  type SagaResult = String
  type SagaBuilder = String
  type SagaExecutor = String

  invariants exports_present {
    - true
  }
}
