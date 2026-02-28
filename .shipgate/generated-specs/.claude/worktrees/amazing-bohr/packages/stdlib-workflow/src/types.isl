# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: WorkflowId, StepId, HandlerName, RetryConfig, StepDefinition, WorkflowError, StepError, Step, Workflow, StepExecutionContext, CompensationContext, StepHandler, CompensationHandler, StepHandlerResult, CompensationResult, WorkflowEvent, WorkflowStartedEvent, WorkflowCompletedEvent, WorkflowFailedEvent, StepTransitionedEvent, CompensationStartedEvent, CompensationCompletedEvent, WorkflowEventType, WorkflowEngineConfig, Logger, WorkflowResult, WorkflowProgress, WorkflowStatusInfo, ListWorkflowsQuery, ListWorkflowsResult
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
  type StepExecutionContext = String
  type CompensationContext = String
  type StepHandler = String
  type CompensationHandler = String
  type StepHandlerResult = String
  type CompensationResult = String
  type WorkflowEvent = String
  type WorkflowStartedEvent = String
  type WorkflowCompletedEvent = String
  type WorkflowFailedEvent = String
  type StepTransitionedEvent = String
  type CompensationStartedEvent = String
  type CompensationCompletedEvent = String
  type WorkflowEventType = String
  type WorkflowEngineConfig = String
  type Logger = String
  type WorkflowResult = String
  type WorkflowProgress = String
  type WorkflowStatusInfo = String
  type ListWorkflowsQuery = String
  type ListWorkflowsResult = String

  invariants exports_present {
    - true
  }
}
