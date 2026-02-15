# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: saga, createSagaOrchestrator, SagaState, SagaStep, SagaContext, SagaBuilder, SagaOrchestrator
# dependencies: 

domain Saga {
  version: "1.0.0"

  type SagaState = String
  type SagaStep = String
  type SagaContext = String
  type SagaBuilder = String
  type SagaOrchestrator = String

  invariants exports_present {
    - true
  }
}
