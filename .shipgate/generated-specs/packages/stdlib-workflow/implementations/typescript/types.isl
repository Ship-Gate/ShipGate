# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: WorkflowId, StepId, HandlerName, RetryConfig, StepDefinition, WorkflowError, StepError, Step, Workflow, WorkflowContext, HandlerContext, HandlerFn, CompensationFn, WorkflowEventType, WorkflowEvent, Result, StartWorkflowInput, TransitionInput, CompensateInput, WorkflowEngineConfig, PersistenceAdapter, WorkflowFilter, WorkflowEventEmitter
# dependencies: 

domain Types {
  version: "1.0.0"

  type WorkflowId = String
  type StepId = String
  type HandlerName = String
  type RetryConfig = String
  type StepDefinition = String
  type WorkflowError = String
  type StepError = String
  type Step = String
  type Workflow = String
  type WorkflowContext = String
  type HandlerContext = String
  type HandlerFn = String
  type CompensationFn = String
  type WorkflowEventType = String
  type WorkflowEvent = String
  type Result = String
  type StartWorkflowInput = String
  type TransitionInput = String
  type CompensateInput = String
  type WorkflowEngineConfig = String
  type PersistenceAdapter = String
  type WorkflowFilter = String
  type WorkflowEventEmitter = String

  invariants exports_present {
    - true
  }
}
