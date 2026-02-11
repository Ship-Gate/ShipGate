/**
 * Error classes for the messaging library
 */

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export class MessagingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retriable: boolean = false,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'MessagingError';
  }
}

// ============================================================================
// QUEUE ERRORS
// ============================================================================

export class QueueError extends MessagingError {
  constructor(code: string, message: string, retriable: boolean = false) {
    super(message, code, retriable);
    this.name = 'QueueError';
  }
}

export class QueueNotFoundError extends QueueError {
  constructor(queueName: string) {
    super('QUEUE_NOT_FOUND', `Queue '${queueName}' not found`, false);
  }
}

export class QueueAlreadyExistsError extends QueueError {
  constructor(queueName: string) {
    super('QUEUE_ALREADY_EXISTS', `Queue '${queueName}' already exists`, false);
  }
}

export class QueueFullError extends QueueError {
  constructor(queueName: string) {
    super('QUEUE_FULL', `Queue '${queueName}' is at capacity`, true);
  }
}

export class QueueNotEmptyError extends QueueError {
  constructor(queueName: string, messageCount: number) {
    super('QUEUE_NOT_EMPTY', `Queue '${queueName}' contains ${messageCount} messages`, false);
  }
}

export class InvalidQueueConfigurationError extends QueueError {
  constructor(message: string) {
    super('INVALID_CONFIGURATION', `Invalid queue configuration: ${message}`, false);
  }
}

export class InvalidDeadLetterQueueError extends QueueError {
  constructor(queueName: string) {
    super('INVALID_DEAD_LETTER_QUEUE', `Dead letter queue '${queueName}' does not exist`, false);
  }
}

// ============================================================================
// MESSAGE ERRORS
// ============================================================================

export class MessageError extends MessagingError {
  constructor(code: string, message: string, retriable: boolean = false) {
    super(message, code, retriable);
    this.name = 'MessageError';
  }
}

export class MessageNotFoundError extends MessageError {
  constructor(messageId: string) {
    super('MESSAGE_NOT_FOUND', `Message '${messageId}' not found`, false);
  }
}

export class MessageNotDeliveredError extends MessageError {
  constructor(messageId: string) {
    super('MESSAGE_NOT_DELIVERED', `Message '${messageId}' is not in delivered state`, false);
  }
}

export class MessageAlreadyAcknowledgedError extends MessageError {
  constructor(messageId: string) {
    super('ALREADY_ACKNOWLEDGED', `Message '${messageId}' already acknowledged`, false);
  }
}

export class MessageAlreadyDeadLetteredError extends MessageError {
  constructor(messageId: string) {
    super('ALREADY_DEAD_LETTERED', `Message '${messageId}' already dead-lettered`, false);
  }
}

export class VisibilityExpiredError extends MessageError {
  constructor(messageId: string) {
    super('VISIBILITY_EXPIRED', `Message '${messageId}' visibility timeout has expired`, false);
  }
}

export class MessageTooLargeError extends MessageError {
  constructor(size: number, maxSize: number) {
    super(
      'PAYLOAD_TOO_LARGE',
      `Message size ${size} exceeds maximum ${maxSize}`,
      false
    );
  }
}

export class MessageExpiredError extends MessageError {
  constructor(messageId: string) {
    super('MESSAGE_EXPIRED', `Message '${messageId}' has expired`, false);
  }
}

export class MaxRetriesExceededError extends MessageError {
  constructor(messageId: string, retryCount: number) {
    super(
      'MAX_RETRIES_EXCEEDED',
      `Message '${messageId}' exceeded maximum retries (${retryCount})`,
      false
    );
  }
}

export class DuplicateMessageError extends MessageError {
  constructor(idempotencyKey: string) {
    super(
      'DUPLICATE_MESSAGE',
      `Duplicate message detected with idempotency key '${idempotencyKey}'`,
      false
    );
  }
}

// ============================================================================
// SERIALIZATION ERRORS
// ============================================================================

export class SerializationError extends MessagingError {
  constructor(message: string) {
    super('SERIALIZATION_ERROR', message, false);
    this.name = 'SerializationError';
  }
}

export class DeserializationError extends MessagingError {
  constructor(message: string) {
    super('DESERIALIZATION_ERROR', message, false);
    this.name = 'DeserializationError';
  }
}

export class SchemaNotFoundError extends SerializationError {
  constructor(schemaId: string) {
    super(`Schema '${schemaId}' not found`);
  }
}

export class SchemaValidationError extends SerializationError {
  constructor(schemaId: string, errors: string[]) {
    super(`Schema validation failed for '${schemaId}': ${errors.join(', ')}`);
  }
}

export class IncompatibleSchemaError extends SerializationError {
  constructor(schemaId: string, version: string) {
    super(`Incompatible schema version '${version}' for '${schemaId}'`);
  }
}

// ============================================================================
// CONSUMER/PRODUCER ERRORS
// ============================================================================

export class ConsumerError extends MessagingError {
  constructor(code: string, message: string, retriable: boolean = false) {
    super(message, code, retriable);
    this.name = 'ConsumerError';
  }
}

export class ProducerError extends MessagingError {
  constructor(code: string, message: string, retriable: boolean = false) {
    super(message, code, retriable);
    this.name = 'ProducerError';
  }
}

export class ConsumerStoppedError extends ConsumerError {
  constructor() {
    super('CONSUMER_STOPPED', 'Consumer is stopped', false);
  }
}

export class ProducerClosedError extends ProducerError {
  constructor() {
    super('PRODUCER_CLOSED', 'Producer is closed', false);
  }
}

export class HandlerTimeoutError extends ConsumerError {
  constructor(timeout: number) {
    super(
      'HANDLER_TIMEOUT',
      `Message handler timed out after ${timeout}ms`,
      true
    );
  }
}

export class ConcurrencyLimitExceededError extends ConsumerError {
  constructor(limit: number) {
    super(
      'CONCURRENCY_LIMIT_EXCEEDED',
      `Concurrency limit exceeded (${limit})`,
      true
    );
  }
}

// ============================================================================
// DEAD LETTER ERRORS
// ============================================================================

export class DeadLetterError extends MessagingError {
  constructor(code: string, message: string, retriable: boolean = false) {
    super(message, code, retriable);
    this.name = 'DeadLetterError';
  }
}

export class NoDeadLetterQueueError extends DeadLetterError {
  constructor() {
    super('NO_DEAD_LETTER_QUEUE', 'No dead letter queue configured', false);
  }
}

export class DeadLetterQueueFullError extends DeadLetterError {
  constructor(queueName: string) {
    super(
      'DEAD_LETTER_QUEUE_FULL',
      `Dead letter queue '${queueName}' is at capacity`,
      true
    );
  }
}

export class NotADeadLetterQueueError extends DeadLetterError {
  constructor(queueName: string) {
    super(
      'NOT_A_DEAD_LETTER_QUEUE',
      `Queue '${queueName}' is not configured as a dead letter queue`,
      false
    );
  }
}

// ============================================================================
// PATTERN ERRORS
// ============================================================================

export class PatternError extends MessagingError {
  constructor(code: string, message: string, retriable: boolean = false) {
    super(message, code, retriable);
    this.name = 'PatternError';
  }
}

export class RequestTimeoutError extends PatternError {
  constructor(correlationId: string, timeout: number) {
    super(
      'REQUEST_TIMEOUT',
      `Request with correlation ID '${correlationId}' timed out after ${timeout}ms`,
      false
    );
  }
}

export class NoReplyQueueError extends PatternError {
  constructor() {
    super('NO_REPLY_QUEUE', 'No reply queue configured for request-reply pattern', false);
  }
}

export class RoutingError extends PatternError {
  constructor(message: string) {
    super('ROUTING_ERROR', message, false);
  }
}

export class FanOutError extends PatternError {
  constructor(message: string) {
    super('FANOUT_ERROR', message, false);
  }
}

// ============================================================================
// MIDDLEWARE ERRORS
// ============================================================================

export class MiddlewareError extends MessagingError {
  constructor(middlewareName: string, originalError: Error) {
    super(
      'MIDDLEWARE_ERROR',
      `Middleware '${middlewareName}' failed: ${originalError.message}`,
      false
    );
    this.name = 'MiddlewareError';
    this.cause = originalError;
  }
}

// ============================================================================
// CONFIGURATION ERRORS
// ============================================================================

export class ConfigurationError extends MessagingError {
  constructor(message: string) {
    super('CONFIGURATION_ERROR', message, false);
    this.name = 'ConfigurationError';
  }
}

export class InvalidConfigurationError extends ConfigurationError {
  constructor(field: string, value: any, reason: string) {
    super(
      `Invalid configuration for field '${field}': ${reason} (value: ${JSON.stringify(value)})`
    );
  }
}

export class MissingConfigurationError extends ConfigurationError {
  constructor(field: string) {
    super(`Missing required configuration field: '${field}'`);
  }
}

// ============================================================================
// RATE LIMIT ERRORS
// ============================================================================

export class RateLimitError extends MessagingError {
  constructor(limit: number, window: number, retryAfter?: number) {
    super(
      'RATE_LIMITED',
      `Rate limit exceeded: ${limit} requests per ${window}ms`,
      true,
      retryAfter
    );
    this.name = 'RateLimitError';
  }
}

// ============================================================================
// HEALTH ERRORS
// ============================================================================

export class HealthCheckError extends MessagingError {
  constructor(component: string, reason: string) {
    super(
      'HEALTH_CHECK_FAILED',
      `Health check failed for component '${component}': ${reason}`,
      false
    );
    this.name = 'HealthCheckError';
  }
}

// ============================================================================
// ERROR CODES
// ============================================================================

export enum ErrorCode {
  // Queue errors
  QUEUE_NOT_FOUND = 'QUEUE_NOT_FOUND',
  QUEUE_ALREADY_EXISTS = 'QUEUE_ALREADY_EXISTS',
  QUEUE_FULL = 'QUEUE_FULL',
  QUEUE_NOT_EMPTY = 'QUEUE_NOT_EMPTY',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  INVALID_DEAD_LETTER_QUEUE = 'INVALID_DEAD_LETTER_QUEUE',
  
  // Message errors
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
  MESSAGE_NOT_DELIVERED = 'MESSAGE_NOT_DELIVERED',
  ALREADY_ACKNOWLEDGED = 'ALREADY_ACKNOWLEDGED',
  ALREADY_DEAD_LETTERED = 'ALREADY_DEAD_LETTERED',
  VISIBILITY_EXPIRED = 'VISIBILITY_EXPIRED',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  MESSAGE_EXPIRED = 'MESSAGE_EXPIRED',
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  DUPLICATE_MESSAGE = 'DUPLICATE_MESSAGE',
  
  // Serialization errors
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  DESERIALIZATION_ERROR = 'DESERIALIZATION_ERROR',
  SCHEMA_NOT_FOUND = 'SCHEMA_NOT_FOUND',
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',
  INCOMPATIBLE_SCHEMA = 'INCOMPATIBLE_SCHEMA',
  
  // Consumer/Producer errors
  CONSUMER_STOPPED = 'CONSUMER_STOPPED',
  PRODUCER_CLOSED = 'PRODUCER_CLOSED',
  HANDLER_TIMEOUT = 'HANDLER_TIMEOUT',
  CONCURRENCY_LIMIT_EXCEEDED = 'CONCURRENCY_LIMIT_EXCEEDED',
  
  // Dead letter errors
  NO_DEAD_LETTER_QUEUE = 'NO_DEAD_LETTER_QUEUE',
  DEAD_LETTER_QUEUE_FULL = 'DEAD_LETTER_QUEUE_FULL',
  NOT_A_DEAD_LETTER_QUEUE = 'NOT_A_DEAD_LETTER_QUEUE',
  
  // Pattern errors
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
  NO_REPLY_QUEUE = 'NO_REPLY_QUEUE',
  ROUTING_ERROR = 'ROUTING_ERROR',
  FANOUT_ERROR = 'FANOUT_ERROR',
  
  // Middleware errors
  MIDDLEWARE_ERROR = 'MIDDLEWARE_ERROR',
  
  // Configuration errors
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  MISSING_CONFIGURATION = 'MISSING_CONFIGURATION',
  
  // Rate limit errors
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Health errors
  HEALTH_CHECK_FAILED = 'HEALTH_CHECK_FAILED',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
