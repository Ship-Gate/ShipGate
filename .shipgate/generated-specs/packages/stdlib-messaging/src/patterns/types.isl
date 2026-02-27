# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RequestReplyPattern, RequestOptions, RequestHandler, PendingRequest, FanOutPattern, FanOutConfig, FanOutQueue, FanOutFilter, FanOutTransform, FanOutResult, FanOutQueueResult, RoutingPattern, RoutingStrategy, RoutingResult, WorkflowPattern, WorkflowDefinition, WorkflowStep, StepHandler, StepContext, WorkflowInstance, WorkflowError, WorkflowFilter, RetryPolicy, ErrorHandlingStrategy, AggregatorPattern, AggregatorConfig, Aggregator, CompetingConsumersPattern, ConsumerGroup
# dependencies: 

domain Types {
  version: "1.0.0"

  type RequestReplyPattern = String
  type RequestOptions = String
  type RequestHandler = String
  type PendingRequest = String
  type FanOutPattern = String
  type FanOutConfig = String
  type FanOutQueue = String
  type FanOutFilter = String
  type FanOutTransform = String
  type FanOutResult = String
  type FanOutQueueResult = String
  type RoutingPattern = String
  type RoutingStrategy = String
  type RoutingResult = String
  type WorkflowPattern = String
  type WorkflowDefinition = String
  type WorkflowStep = String
  type StepHandler = String
  type StepContext = String
  type WorkflowInstance = String
  type WorkflowError = String
  type WorkflowFilter = String
  type RetryPolicy = String
  type ErrorHandlingStrategy = String
  type AggregatorPattern = String
  type AggregatorConfig = String
  type Aggregator = String
  type CompetingConsumersPattern = String
  type ConsumerGroup = String

  invariants exports_present {
    - true
  }
}
