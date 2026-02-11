/**
 * Patterns module exports
 */

// Types and interfaces
export type {
  RequestReplyPattern as IRequestReplyPattern,
  RequestOptions,
  RequestHandler,
  PendingRequest,
  FanOutPattern as IFanOutPattern,
  FanOutConfig,
  FanOutQueue,
  FanOutFilter,
  FanOutTransform,
  FanOutResult,
  FanOutQueueResult,
  RoutingPattern as IRoutingPattern,
  RoutingStrategy,
  RoutingResult,
  WorkflowPattern as IWorkflowPattern,
  WorkflowDefinition,
  WorkflowStep,
  StepHandler,
  StepContext,
  WorkflowInstance,
  WorkflowError,
  WorkflowFilter,
  RetryPolicy,
  ErrorHandlingStrategy,
  AggregatorPattern as IAggregatorPattern,
  AggregatorConfig,
  Aggregator,
  CompetingConsumersPattern as ICompetingConsumersPattern,
  ConsumerGroup,
} from './types.js';

export {
  CorrelationStrategy,
  HandlerResult,
  ErrorHandlingResult,
  DeadLetterAction,
  WorkflowState,
  ErrorHandlingType,
} from './types.js';

// Pattern implementations
export { 
  RequestReplyPattern,
  RequestReplyBuilder,
  RequestReplyFactory,
} from './request-reply.js';

export { 
  FanOutPattern,
  FanOutBuilder,
  FanOutFilters,
  FanOutTransforms,
} from './fan-out.js';

export {
  RoutingPattern,
  HeaderRoutingStrategy,
  PayloadRoutingStrategy,
  PriorityRoutingStrategy,
  RoundRobinRoutingStrategy,
  LeastLoadedRoutingStrategy,
  HashRoutingStrategy,
  RoutingBuilder,
} from './routing.js';
