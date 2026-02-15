# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: MessagingError, QueueError, QueueNotFoundError, QueueAlreadyExistsError, QueueFullError, QueueNotEmptyError, InvalidQueueConfigurationError, InvalidDeadLetterQueueError, MessageError, MessageNotFoundError, MessageNotDeliveredError, MessageAlreadyAcknowledgedError, MessageAlreadyDeadLetteredError, VisibilityExpiredError, MessageTooLargeError, MessageExpiredError, MaxRetriesExceededError, DuplicateMessageError, SerializationError, DeserializationError, SchemaNotFoundError, SchemaValidationError, IncompatibleSchemaError, ConsumerError, ProducerError, ConsumerStoppedError, ProducerClosedError, HandlerTimeoutError, ConcurrencyLimitExceededError, DeadLetterError, NoDeadLetterQueueError, DeadLetterQueueFullError, NotADeadLetterQueueError, PatternError, RequestTimeoutError, NoReplyQueueError, RoutingError, FanOutError, MiddlewareError, ConfigurationError, InvalidConfigurationError, MissingConfigurationError, RateLimitError, HealthCheckError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type MessagingError = String
  type QueueError = String
  type QueueNotFoundError = String
  type QueueAlreadyExistsError = String
  type QueueFullError = String
  type QueueNotEmptyError = String
  type InvalidQueueConfigurationError = String
  type InvalidDeadLetterQueueError = String
  type MessageError = String
  type MessageNotFoundError = String
  type MessageNotDeliveredError = String
  type MessageAlreadyAcknowledgedError = String
  type MessageAlreadyDeadLetteredError = String
  type VisibilityExpiredError = String
  type MessageTooLargeError = String
  type MessageExpiredError = String
  type MaxRetriesExceededError = String
  type DuplicateMessageError = String
  type SerializationError = String
  type DeserializationError = String
  type SchemaNotFoundError = String
  type SchemaValidationError = String
  type IncompatibleSchemaError = String
  type ConsumerError = String
  type ProducerError = String
  type ConsumerStoppedError = String
  type ProducerClosedError = String
  type HandlerTimeoutError = String
  type ConcurrencyLimitExceededError = String
  type DeadLetterError = String
  type NoDeadLetterQueueError = String
  type DeadLetterQueueFullError = String
  type NotADeadLetterQueueError = String
  type PatternError = String
  type RequestTimeoutError = String
  type NoReplyQueueError = String
  type RoutingError = String
  type FanOutError = String
  type MiddlewareError = String
  type ConfigurationError = String
  type InvalidConfigurationError = String
  type MissingConfigurationError = String
  type RateLimitError = String
  type HealthCheckError = String

  invariants exports_present {
    - true
  }
}
