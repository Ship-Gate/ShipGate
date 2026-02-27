/**
 * Messaging pattern types
 */

import type { MessageEnvelope, CorrelationStrategy } from '../types.js';
import type { QueueAdapter } from '../queue/types.js';

// ============================================================================
// REQUEST-REPLY PATTERN
// ============================================================================

export interface RequestReplyPattern {
  /**
   * Send a request and wait for a reply
   */
  request<TRequest, TResponse>(
    request: TRequest,
    options?: RequestOptions
  ): Promise<TResponse>;
  
  /**
   * Register a reply handler
   */
  reply<TRequest, TResponse>(
    handler: RequestHandler<TRequest, TResponse>
  ): Promise<void>;
  
  /**
   * Close the pattern
   */
  close(): Promise<void>;
}

export interface RequestOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  
  /** Correlation ID strategy */
  correlationStrategy?: CorrelationStrategy;
  
  /** Additional headers */
  headers?: Record<string, string>;
  
  /** Priority */
  priority?: number;
}

export type RequestHandler<TRequest, TResponse> = (
  request: MessageEnvelope<TRequest>
) => Promise<TResponse>;

export interface PendingRequest {
  /** Request ID */
  id: string;
  
  /** Resolve function */
  resolve: (value: any) => void;
  
  /** Reject function */
  reject: (error: Error) => void;
  
  /** Timeout timer */
  timer: any;
  
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// FAN-OUT PATTERN
// ============================================================================

export interface FanOutPattern {
  /**
   * Publish a message to multiple queues
   */
  fanOut<T>(message: T, config: FanOutConfig): Promise<FanOutResult>;
  
  /**
   * Add a queue to the fan-out list
   */
  addQueue(queueName: string, filter?: FanOutFilter): void;
  
  /**
   * Remove a queue from the fan-out list
   */
  removeQueue(queueName: string): void;
  
  /**
   * List all queues in the fan-out
   */
  listQueues(): string[];
}

export interface FanOutConfig {
  /** Queue pattern or specific queues */
  queues: string | string[] | FanOutQueue[];
  
  /** Filter function */
  filter?: FanOutFilter;
  
  /** Transform function */
  transform?: FanOutTransform;
  
  /** Parallel processing */
  parallel?: boolean;
  
  /** Fail fast on first error */
  failFast?: boolean;
}

export interface FanOutQueue {
  /** Queue name */
  name: string;
  
  /** Queue-specific filter */
  filter?: FanOutFilter;
  
  /** Queue-specific transform */
  transform?: FanOutTransform;
}

export type FanOutFilter = (message: MessageEnvelope) => boolean;

export type FanOutTransform = (message: MessageEnvelope, queue: string) => MessageEnvelope;

export interface FanOutResult {
  /** Results per queue */
  results: Map<string, FanOutQueueResult>;
  
  /** Overall success */
  success: boolean;
  
  /** Number of successful deliveries */
  successCount: number;
  
  /** Number of failed deliveries */
  failureCount: number;
}

export interface FanOutQueueResult {
  /** Whether delivery was successful */
  success: boolean;
  
  /** Error if delivery failed */
  error?: Error;
  
  /** Delivery timestamp */
  timestamp: number;
}

// ============================================================================
// ROUTING PATTERN
// ============================================================================

export interface RoutingPattern {
  /**
   * Route a message to the appropriate queue
   */
  route<T>(message: T, strategies?: RoutingStrategy[]): Promise<RoutingResult>;
  
  /**
   * Register a routing strategy
   */
  registerStrategy(strategy: RoutingStrategy): void;
  
  /**
   * Unregister a routing strategy
   */
  unregisterStrategy(strategyName: string): void;
  
  /**
   * Get all registered strategies
   */
  getStrategies(): RoutingStrategy[];
}

export interface RoutingStrategy {
  /** Strategy name */
  name: string;
  
  /** Strategy priority (higher = tried first) */
  priority: number;
  
  /** Select queue for message */
  selectQueue(message: MessageEnvelope, availableQueues: string[]): string | null;
  
  /** Whether to continue to next strategy if null is returned */
  continueOnNull?: boolean;
}

export interface RoutingResult {
  /** Selected queue */
  queue: string;
  
  /** Strategy that selected the queue */
  strategy: string;
  
  /** Routing metadata */
  metadata: Record<string, any>;
}

// ============================================================================
// WORKFLOW PATTERN
// ============================================================================

export interface WorkflowPattern {
  /**
   * Start a workflow
   */
  start<T>(workflow: WorkflowDefinition<T>, initialData: T): Promise<WorkflowInstance>;
  
  /**
   * Get a workflow instance
   */
  getInstance(instanceId: string): Promise<WorkflowInstance | null>;
  
  /**
   * List workflow instances
   */
  listInstances(filter?: WorkflowFilter): Promise<WorkflowInstance[]>;
  
  /**
   * Cancel a workflow instance
   */
  cancel(instanceId: string, reason?: string): Promise<void>;
}

export interface WorkflowDefinition<T> {
  /** Workflow name */
  name: string;
  
  /** Workflow version */
  version: string;
  
  /** Workflow steps */
  steps: WorkflowStep<T>[];
  
  /** Error handling strategy */
  errorHandling?: ErrorHandlingStrategy;
}

export interface WorkflowStep<T> {
  /** Step name */
  name: string;
  
  /** Step handler */
  handler: StepHandler<T>;
  
  /** Step dependencies */
  dependsOn?: string[];
  
  /** Retry policy */
  retryPolicy?: RetryPolicy;
  
  /** Timeout in milliseconds */
  timeout?: number;
  
  /** Optional step */
  optional?: boolean;
}

export type StepHandler<T> = (data: T, context: StepContext) => Promise<Partial<T>>;

export interface StepContext {
  /** Step name */
  stepName: string;
  
  /** Workflow instance ID */
  instanceId: string;
  
  /** Attempt number */
  attempt: number;
  
  /** Additional metadata */
  metadata: Record<string, any>;
}

export interface WorkflowInstance {
  /** Instance ID */
  id: string;
  
  /** Workflow definition */
  workflow: string;
  
  /** Current state */
  state: WorkflowState;
  
  /** Workflow data */
  data: any;
  
  /** Completed steps */
  completedSteps: string[];
  
  /** Failed steps */
  failedSteps: string[];
  
  /** Current step */
  currentStep?: string;
  
  /** Start timestamp */
  startedAt: number;
  
  /** End timestamp */
  endedAt?: number;
  
  /** Error information */
  error?: WorkflowError;
}

export enum WorkflowState {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface WorkflowError {
  /** Error message */
  message: string;
  
  /** Step where error occurred */
  step: string;
  
  /** Error timestamp */
  timestamp: number;
  
  /** Stack trace */
  stack?: string;
}

export interface WorkflowFilter {
  /** Workflow name */
  workflow?: string;
  
  /** Workflow state */
  state?: WorkflowState;
  
  /** Time range */
  timeRange?: {
    start: number;
    end: number;
  };
}

export interface RetryPolicy {
  /** Maximum number of retries */
  maxRetries: number;
  
  /** Initial delay in milliseconds */
  initialDelay: number;
  
  /** Maximum delay in milliseconds */
  maxDelay: number;
  
  /** Backoff multiplier */
  multiplier?: number;
}

export interface ErrorHandlingStrategy {
  /** Strategy type */
  type: ErrorHandlingType;
  
  /** Dead letter queue */
  deadLetterQueue?: string;
  
  /** Retry policy */
  retryPolicy?: RetryPolicy;
}

export enum ErrorHandlingType {
  /** Retry on error */
  RETRY = 'RETRY',
  
  /** Dead letter on error */
  DEAD_LETTER = 'DEAD_LETTER',
  
  /** Continue workflow */
  CONTINUE = 'CONTINUE',
  
  /** Cancel workflow */
  CANCEL = 'CANCEL',
}

// ============================================================================
// AGGREGATOR PATTERN
// ============================================================================

export interface AggregatorPattern {
  /**
   * Create an aggregator
   */
  create<T>(
    config: AggregatorConfig<T>
  ): Aggregator<T>;
  
  /**
   * Get an existing aggregator
   */
  get<T>(id: string): Aggregator<T> | null;
  
  /**
   * Delete an aggregator
   */
  delete(id: string): Promise<void>;
}

export interface AggregatorConfig<T> {
  /** Aggregator ID */
  id: string;
  
  /** Correlation ID extractor */
  correlationIdExtractor: (message: MessageEnvelope) => string;
  
  /** Aggregation function */
  aggregator: (messages: MessageEnvelope[]) => T;
  
  /** Completion condition */
  completionCondition: (messages: MessageEnvelope[]) => boolean;
  
  /** Timeout in milliseconds */
  timeout: number;
  
  /** Maximum number of messages */
  maxMessages?: number;
  
  /** Result handler */
  onResult: (result: T, correlationId: string) => Promise<void>;
  
  /** Timeout handler */
  onTimeout?: (correlationId: string, messages: MessageEnvelope[]) => Promise<void>;
}

export interface Aggregator<T> {
  /** Aggregator ID */
  id: string;
  
  /** Add a message to the aggregator */
  add(message: MessageEnvelope): Promise<void>;
  
  /** Get current messages */
  getMessages(): MessageEnvelope[];
  
  /** Get message count */
  getCount(): number;
  
  /** Check if aggregation is complete */
  isComplete(): boolean;
  
  /** Force completion */
  complete(): Promise<T>;
}

// ============================================================================
// COMPETING CONSUMERS PATTERN
// ============================================================================

export interface CompetingConsumersPattern {
  /**
   * Register a consumer group
   */
  registerGroup(
    groupName: string,
    queueName: string,
    consumerCount: number
  ): Promise<void>;
  
  /**
   * Unregister a consumer group
   */
  unregisterGroup(groupName: string): Promise<void>;
  
  /**
   * Get consumer group info
   */
  getGroup(groupName: string): Promise<ConsumerGroup | null>;
  
  /**
   * List all consumer groups
   */
  listGroups(): Promise<ConsumerGroup[]>;
  
  /**
   * Scale a consumer group
   */
  scaleGroup(groupName: string, newConsumerCount: number): Promise<void>;
}

export interface ConsumerGroup {
  /** Group name */
  name: string;
  
  /** Queue name */
  queue: string;
  
  /** Number of consumers */
  consumerCount: number;
  
  /** Active consumers */
  activeConsumers: string[];
  
  /** Messages processed */
  messagesProcessed: number;
  
  /** Last activity timestamp */
  lastActivity: number;
}
