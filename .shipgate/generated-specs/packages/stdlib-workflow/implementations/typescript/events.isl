# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createEvent, createEventLogger, WorkflowCreatedEvent, WorkflowStartedEvent, WorkflowCompletedEvent, WorkflowFailedEvent, StepCompletedEvent, StepFailedEvent, WorkflowEventHandler, WorkflowEventBus
# dependencies: 

domain Events {
  version: "1.0.0"

  type WorkflowCreatedEvent = String
  type WorkflowStartedEvent = String
  type WorkflowCompletedEvent = String
  type WorkflowFailedEvent = String
  type StepCompletedEvent = String
  type StepFailedEvent = String
  type WorkflowEventHandler = String
  type WorkflowEventBus = String

  invariants exports_present {
    - true
  }
}
