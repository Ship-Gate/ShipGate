# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createSaga, withRetry, SagaStep, SagaDefinition, SagaInstance, SagaBuilder, SagaOrchestrator
# dependencies: 

domain Saga {
  version: "1.0.0"

  type SagaStep = String
  type SagaDefinition = String
  type SagaInstance = String
  type SagaBuilder = String
  type SagaOrchestrator = String

  invariants exports_present {
    - true
  }
}
