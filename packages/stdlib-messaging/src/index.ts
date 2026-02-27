/**
 * @packageDocumentation
 * @isl-lang/stdlib-messaging
 * 
 * ISL Standard Library - Messaging
 * 
 * Provides comprehensive messaging abstractions including:
 * - Queue adapters and in-memory implementation
 * - Consumer and producer patterns
 * - Dead letter queue handling
 * - Serialization with schema registry
 * - Messaging patterns (request-reply, fan-out, routing)
 * - Middleware support (logging, metrics, retry, tracing)
 */

// ============================================================================
// CORE TYPES AND ERRORS
// ============================================================================

// Re-export from types.ts
export type {
  MessageEnvelope,
  MessageOptions,
  QueueConfig,
  QueueStats,
  ConsumerConfig,
  ProducerConfig,
  MessageHandler,
  ErrorHandler,
  ProduceContext,
  ConsumeContext,
  Serializer,
  Schema,
  DeadLetterPolicy,
  BackoffPolicy,
  DeadLetterHandler,
  Middleware,
  RequestReplyConfig,
  RoutingStrategy,
  FanOutConfig,
  MessagingEvent,
  HealthCheck,
  MessagingMetrics,
} from './types.js';

export {
  QueueType,
  AcknowledgeMode,
  HandlerResult,
  ErrorHandlingResult,
  BackoffType,
  SchemaCompatibility,
  CorrelationStrategy,
  EventType,
  HealthStatus,
} from './types.js';

// Re-export from errors.ts
export {
  MessagingError,
  QueueError,
  QueueNotFoundError,
  QueueAlreadyExistsError,
  QueueFullError,
  QueueNotEmptyError,
  InvalidQueueConfigurationError,
  InvalidDeadLetterQueueError,
  MessageError,
  MessageNotFoundError,
  MessageNotDeliveredError,
  MessageAlreadyAcknowledgedError,
  MessageAlreadyDeadLetteredError,
  VisibilityExpiredError,
  MessageTooLargeError,
  MessageExpiredError,
  MaxRetriesExceededError,
  DuplicateMessageError,
  SerializationError,
  DeserializationError,
  SchemaNotFoundError,
  SchemaValidationError,
  IncompatibleSchemaError,
  ConsumerError,
  ProducerError,
  ConsumerStoppedError,
  ProducerClosedError,
  HandlerTimeoutError,
  ConcurrencyLimitExceededError,
  DeadLetterError,
  NoDeadLetterQueueError,
  DeadLetterQueueFullError,
  NotADeadLetterQueueError,
  PatternError,
  RequestTimeoutError,
  NoReplyQueueError,
  RoutingError,
  FanOutError,
  MiddlewareError,
  ConfigurationError,
  InvalidConfigurationError,
  MissingConfigurationError,
  RateLimitError,
  HealthCheckError,
} from './errors.js';

export { ErrorCode } from './errors.js';

// ============================================================================
// QUEUE MODULE
// ============================================================================

export * from './queue/index.js';

// ============================================================================
// DEAD LETTER MODULE
// ============================================================================

export * from './dead-letter/index.js';

// ============================================================================
// SERIALIZATION MODULE
// ============================================================================

export * from './serialization/index.js';

// ============================================================================
// PATTERNS MODULE
// ============================================================================

export * from './patterns/index.js';

// ============================================================================
// MIDDLEWARE MODULE
// ============================================================================

export * from './middleware/index.js';

// ============================================================================
// LEGACY COMPATIBILITY (for existing implementations)
// ============================================================================

// Re-export from existing TypeScript implementations for backward compatibility
export {
  QueueStore,
  queueStore,
  createMessage,
  type Message as LegacyMessage,
  type Queue as LegacyQueue,
  type DeliveryStatus as LegacyDeliveryStatus,
  type QueueType as LegacyQueueType,
  QueueError as LegacyQueueError,
} from '../implementations/typescript/queue.js';

export {
  PubSubStore,
  pubSubStore,
  type Topic as LegacyTopic,
  type Subscription as LegacySubscription,
  type TopicStats as LegacyTopicStats,
  type PublishResult as LegacyPublishResult,
  type BatchPublishResult as LegacyBatchPublishResult,
  PubSubError as LegacyPubSubError,
} from '../implementations/typescript/pubsub.js';

// Exported behavior functions from legacy implementation
export {
  CreateQueue,
  DeleteQueue,
  Publish,
  PublishBatch,
  Subscribe,
  Unsubscribe,
  Consume,
  Acknowledge,
  AcknowledgeBatch,
  Reject,
  DeadLetter,
  ChangeMessageVisibility,
  Peek,
  PurgeQueue,
  GetQueueStats,
  CreateTopic,
  DeleteTopic,
  GetTopicStats,
} from '../implementations/typescript/index.js';

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an in-memory queue adapter
 */
export function createMemoryQueueAdapter(): import('./queue/index.js').MemoryQueueAdapter {
  const { MemoryQueueAdapter } = require('./queue/index.js');
  return new MemoryQueueAdapter();
}

/**
 * Create a message producer
 */
export function createProducer(
  adapter: import('./queue/index.js').QueueAdapter,
  config?: Partial<import('./types.js').ProducerConfig>
): import('./queue/index.js').MessageProducer {
  const { ProducerBuilder } = require('./queue/index.js');
  const builder = new ProducerBuilder(adapter);
  
  if (config?.defaultQueue) {
    builder.defaultQueue(config.defaultQueue);
  }
  
  if (config?.defaultOptions) {
    builder.defaultOptions(config.defaultOptions);
  }
  
  if (config?.middleware) {
    builder.middleware(...config.middleware);
  }
  
  if (config?.enableIdempotency) {
    builder.enableIdempotency(config.enableIdempotency);
  }
  
  if (config?.batchSettings) {
    builder.batchSettings(config.batchSettings);
  }
  
  return builder.build();
}

/**
 * Create a message consumer
 */
export function createConsumer(
  adapter: import('./queue/index.js').QueueAdapter,
  config: import('./types.js').ConsumerConfig
): import('./queue/index.js').MessageConsumer {
  const { ConsumerBuilder } = require('./queue/index.js');
  const builder = new ConsumerBuilder(adapter);
  
  builder
    .queue(config.queue)
    .maxMessages(config.maxMessages)
    .visibilityTimeout(config.visibilityTimeout)
    .waitTime(config.waitTime)
    .handler(config.handler);
  
  if (config.errorHandler) {
    builder.errorHandler(config.errorHandler);
  }
  
  if (config.middleware) {
    builder.middleware(...config.middleware);
  }
  
  if (config.concurrency) {
    builder.concurrency(config.concurrency);
  }
  
  return builder.build();
}

/**
 * Create a JSON serializer
 */
export function createJsonSerializer(): import('./serialization/index.js').JsonSerializer {
  const { JsonSerializer } = require('./serialization/index.js');
  return new JsonSerializer();
}

/**
 * Create a schema registry
 */
export function createSchemaRegistry(): import('./serialization/index.js').DefaultSchemaRegistry {
  const { DefaultSchemaRegistry, InMemorySchemaStore } = require('./serialization/index.js');
  const store = new InMemorySchemaStore();
  return new DefaultSchemaRegistry(store);
}

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = '1.0.0';
