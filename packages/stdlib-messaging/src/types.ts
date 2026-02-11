/**
 * Core types for the messaging library
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface MessageEnvelope<T = any> {
  /** Unique message identifier */
  id: string;
  
  /** Message payload */
  payload: T;
  
  /** Message metadata */
  headers: Record<string, string>;
  
  /** Content type for serialization */
  contentType: string;
  
  /** Schema identifier for validation */
  schemaId?: string;
  
  /** Schema version for compatibility */
  schemaVersion?: string;
  
  /** Correlation ID for tracing related messages */
  correlationId?: string;
  
  /** Causation ID for message lineage */
  causationId?: string;
  
  /** Partition key for routing */
  partitionKey?: string;
  
  /** Message priority (0-9, higher = more priority) */
  priority?: number;
  
  /** Timestamps */
  timestamp: number;
  scheduledAt?: number;
  expiresAt?: number;
  
  /** Delivery tracking */
  deliveryCount: number;
  maxDeliveries: number;
  
  /** Visibility timeout in milliseconds */
  visibilityTimeout?: number;
  
  /** When the message becomes visible */
  visibleAt?: number;
  
  /** Dead letter information */
  deadLetterReason?: string;
  originalQueue?: string;
}

export interface MessageOptions {
  /** Schema identifier for validation */
  schemaId?: string;
  
  /** Schema version for compatibility */
  schemaVersion?: string;
  
  /** Correlation ID for tracing related messages */
  correlationId?: string;
  
  /** Causation ID for message lineage */
  causationId?: string;
  
  /** Partition key for routing */
  partitionKey?: string;
  
  /** Message priority (0-9, higher = more priority) */
  priority?: number;
  
  /** Delay delivery in milliseconds */
  delay?: number;
  
  /** Schedule delivery at specific time */
  scheduledAt?: Date;
  
  /** Message expiration time */
  expiresAt?: Date;
  
  /** Maximum number of delivery attempts */
  maxDeliveries?: number;
  
  /** Initial visibility timeout in milliseconds */
  visibilityTimeout?: number;
}

// ============================================================================
// QUEUE TYPES
// ============================================================================

export interface QueueConfig {
  /** Queue name */
  name: string;
  
  /** Queue type */
  type: QueueType;
  
  /** Acknowledgment mode */
  acknowledgeMode: AcknowledgeMode;
  
  /** Default visibility timeout in milliseconds */
  defaultVisibilityTimeout: number;
  
  /** Message retention period in milliseconds */
  messageRetention: number;
  
  /** Default delay for messages in milliseconds */
  delaySeconds: number;
  
  /** Maximum queue size */
  maxSize?: number;
  
  /** Maximum message size in bytes */
  maxMessageSize: number;
  
  /** Dead letter configuration */
  deadLetterQueue?: string;
  maxReceiveCount: number;
  
  /** Queue tags */
  tags: Record<string, string>;
}

export enum QueueType {
  /** Standard queue (at-least-once delivery) */
  STANDARD = 'STANDARD',
  
  /** FIFO queue (exactly-once, ordered delivery) */
  FIFO = 'FIFO',
  
  /** Priority queue (priority-based ordering) */
  PRIORITY = 'PRIORITY',
  
  /** Delay queue (delayed delivery) */
  DELAY = 'DELAY',
}

export enum AcknowledgeMode {
  /** Automatic acknowledgment on receipt */
  AUTO = 'AUTO',
  
  /** Manual acknowledgment required */
  MANUAL = 'MANUAL',
  
  /** Acknowledgment within transaction */
  TRANSACTIONAL = 'TRANSACTIONAL',
}

export interface QueueStats {
  /** Number of messages in queue */
  messageCount: number;
  
  /** Number of in-flight messages */
  inFlightCount: number;
  
  /** Age of oldest message in milliseconds */
  oldestMessageAge?: number;
  
  /** Approximate delay for delayed messages */
  approximateDelay?: number;
  
  /** Number of dead-lettered messages */
  deadLetterCount?: number;
}

// ============================================================================
// CONSUMER/PRODUCER TYPES
// ============================================================================

export interface ConsumerConfig {
  /** Queue name to consume from */
  queue: string;
  
  /** Maximum messages to fetch in one batch */
  maxMessages: number;
  
  /** Visibility timeout for consumed messages */
  visibilityTimeout: number;
  
  /** Wait time for long polling */
  waitTime: number;
  
  /** Message handler */
  handler: MessageHandler;
  
  /** Error handler */
  errorHandler?: ErrorHandler;
  
  /** Middleware chain */
  middleware?: Middleware[];
  
  /** Auto-start consumer */
  autoStart?: boolean;
  
  /** Concurrency level */
  concurrency?: number;
}

export interface ProducerConfig {
  /** Default queue name */
  defaultQueue?: string;
  
  /** Default message options */
  defaultOptions?: Partial<MessageOptions>;
  
  /** Middleware chain */
  middleware?: Middleware[];
  
  /** Enable idempotency */
  enableIdempotency?: boolean;
  
  /** Batch publish settings */
  batchSettings?: {
    maxBatchSize: number;
    maxWaitTime: number;
  };
}

export type MessageHandler<T = any> = (message: MessageEnvelope<T>) => Promise<HandlerResult>;
export type ErrorHandler = (error: Error, message: MessageEnvelope) => Promise<ErrorHandlingResult>;

export enum HandlerResult {
  /** Message processed successfully */
  ACK = 'ACK',
  
  /** Message processing failed, retry */
  NACK = 'NACK',
  
  /** Message should be dead-lettered */
  DEAD_LETTER = 'DEAD_LETTER',
}

export enum ErrorHandlingResult {
  /** Retry the message */
  RETRY = 'RETRY',
  
  /** Dead-letter the message */
  DEAD_LETTER = 'DEAD_LETTER',
  
  /** Discard the message */
  DISCARD = 'DISCARD',
}

// ============================================================================
// SERIALIZATION TYPES
// ============================================================================

export interface Serializer {
  /** Serialize a value to a string */
  serialize<T>(value: T): string;
  
  /** Deserialize a string to a value */
  deserialize<T>(data: string, schemaId?: string): T;
  
  /** Get content type */
  getContentType(): string;
}

export interface Schema {
  /** Schema identifier */
  id: string;
  
  /** Schema version */
  version: string;
  
  /** Schema definition */
  definition: any;
  
  /** Compatibility mode */
  compatibility: SchemaCompatibility;
}

export enum SchemaCompatibility {
  /** No compatibility checking */
  NONE = 'NONE',
  
  /** Backward compatible (new readers can read old data) */
  BACKWARD = 'BACKWARD',
  
  /** Forward compatible (old readers can read new data) */
  FORWARD = 'FORWARD',
  
  /** Full compatibility (both backward and forward) */
  FULL = 'FULL',
}

// ============================================================================
// DEAD LETTER TYPES
// ============================================================================

export interface DeadLetterPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  
  /** Backoff policy for retries */
  backoffPolicy: BackoffPolicy;
  
  /** Dead letter queue name */
  deadLetterQueue: string;
  
  /** Custom dead letter handler */
  handler?: DeadLetterHandler;
}

export interface BackoffPolicy {
  /** Type of backoff */
  type: BackoffType;
  
  /** Initial delay in milliseconds */
  initialDelay: number;
  
  /** Maximum delay in milliseconds */
  maxDelay: number;
  
  /** Multiplier for exponential backoff */
  multiplier?: number;
  
  /** Jitter factor */
  jitter?: number;
}

export enum BackoffType {
  /** Linear backoff */
  LINEAR = 'LINEAR',
  
  /** Exponential backoff */
  EXPONENTIAL = 'EXPONENTIAL',
  
  /** Fixed delay */
  FIXED = 'FIXED',
}

export type DeadLetterHandler = (message: MessageEnvelope, reason: string, retries: number) => Promise<void>;

// ============================================================================
// MIDDLEWARE TYPES
// ============================================================================

export interface Middleware {
  /** Middleware name */
  name: string;
  
  /** Process outgoing messages */
  produce?(context: ProduceContext, next: () => Promise<void>): Promise<void>;
  
  /** Process incoming messages */
  consume?(context: ConsumeContext, next: () => Promise<HandlerResult>): Promise<HandlerResult>;
}

export interface ProduceContext {
  /** Message being produced */
  message: MessageEnvelope;
  
  /** Queue name */
  queue: string;
  
  /** Producer configuration */
  config: ProducerConfig;
  
  /** Additional metadata */
  metadata: Record<string, any>;
}

export interface ConsumeContext {
  /** Message being consumed */
  message: MessageEnvelope;
  
  /** Queue name */
  queue: string;
  
  /** Consumer configuration */
  config: ConsumerConfig;
  
  /** Additional metadata */
  metadata: Record<string, any>;
}

// ============================================================================
// PATTERN TYPES
// ============================================================================

export interface RequestReplyConfig {
  /** Reply queue name */
  replyQueue: string;
  
  /** Timeout for waiting for reply */
  timeout: number;
  
  /** Correlation ID strategy */
  correlationStrategy?: CorrelationStrategy;
}

export enum CorrelationStrategy {
  /** Use message ID as correlation ID */
  MESSAGE_ID = 'MESSAGE_ID',
  
  /** Generate new correlation ID */
  GENERATE = 'GENERATE',
  
  /** Use existing correlation ID if present */
  PRESERVE = 'PRESERVE',
}

export interface RoutingStrategy {
  /** Strategy name */
  name: string;
  
  /** Select queue for message */
  selectQueue(message: MessageEnvelope, availableQueues: string[]): string | null;
}

export interface FanOutConfig {
  /** Pattern for matching queues */
  pattern: string;
  
  /** Filter function */
  filter?: (message: MessageEnvelope) => boolean;
  
  /** Transform function */
  transform?: (message: MessageEnvelope, queue: string) => MessageEnvelope;
}

// ============================================================================
// EVENTS
// ============================================================================

export interface MessagingEvent {
  /** Event type */
  type: EventType;
  
  /** Timestamp */
  timestamp: number;
  
  /** Event data */
  data: any;
  
  /** Source component */
  source: string;
}

export enum EventType {
  /** Message produced */
  MESSAGE_PRODUCED = 'MESSAGE_PRODUCED',
  
  /** Message consumed */
  MESSAGE_CONSUMED = 'MESSAGE_CONSUMED',
  
  /** Message acknowledged */
  MESSAGE_ACKNOWLEDGED = 'MESSAGE_ACKNOWLEDGED',
  
  /** Message rejected */
  MESSAGE_REJECTED = 'MESSAGE_REJECTED',
  
  /** Message dead-lettered */
  MESSAGE_DEAD_LETTERED = 'MESSAGE_DEAD_LETTERED',
  
  /** Queue created */
  QUEUE_CREATED = 'QUEUE_CREATED',
  
  /** Queue deleted */
  QUEUE_DELETED = 'QUEUE_DELETED',
  
  /** Error occurred */
  ERROR_OCCURRED = 'ERROR_OCCURRED',
}

// ============================================================================
// HEALTH CHECK TYPES
// ============================================================================

export interface HealthCheck {
  /** Component name */
  name: string;
  
  /** Health status */
  status: HealthStatus;
  
  /** Last check timestamp */
  lastCheck: number;
  
  /** Additional details */
  details?: Record<string, any>;
}

export enum HealthStatus {
  /** Component is healthy */
  HEALTHY = 'HEALTHY',
  
  /** Component is degraded */
  DEGRADED = 'DEGRADED',
  
  /** Component is unhealthy */
  UNHEALTHY = 'UNHEALTHY',
}

// ============================================================================
// METRICS TYPES
// ============================================================================

export interface MessagingMetrics {
  /** Number of messages produced */
  messagesProduced: number;
  
  /** Number of messages consumed */
  messagesConsumed: number;
  
  /** Number of messages acknowledged */
  messagesAcknowledged: number;
  
  /** Number of messages rejected */
  messagesRejected: number;
  
  /** Number of messages dead-lettered */
  messagesDeadLettered: number;
  
  /** Average processing time */
  averageProcessingTime: number;
  
  /** Error rate */
  errorRate: number;
  
  /** Queue depths */
  queueDepths: Record<string, number>;
}
