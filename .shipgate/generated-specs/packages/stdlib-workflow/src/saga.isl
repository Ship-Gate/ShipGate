# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createTransactionalStep, createSagaOrchestrator, SagaStep, SagaDefinition, SagaExecutionResult, SagaBuilder, SagaOrchestrator
# dependencies: uuid

domain Saga {
  version: "1.0.0"

  type SagaStep = String
  type SagaDefinition = String
  type SagaExecutionResult = String
  type SagaBuilder = String
  type SagaOrchestrator = String

  invariants exports_present {
    - true
  }
}
