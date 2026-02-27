# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: MessageEnvelope, MessageOptions, QueueConfig, QueueStats, ConsumerConfig, ProducerConfig, MessageHandler, ErrorHandler, Serializer, Schema, DeadLetterPolicy, BackoffPolicy, DeadLetterHandler, Middleware, ProduceContext, ConsumeContext, RequestReplyConfig, RoutingStrategy, FanOutConfig, MessagingEvent, HealthCheck, MessagingMetrics
# dependencies: 

domain Types {
  version: "1.0.0"

  type MessageEnvelope = String
  type MessageOptions = String
  type QueueConfig = String
  type QueueStats = String
  type ConsumerConfig = String
  type ProducerConfig = String
  type MessageHandler = String
  type ErrorHandler = String
  type Serializer = String
  type Schema = String
  type DeadLetterPolicy = String
  type BackoffPolicy = String
  type DeadLetterHandler = String
  type Middleware = String
  type ProduceContext = String
  type ConsumeContext = String
  type RequestReplyConfig = String
  type RoutingStrategy = String
  type FanOutConfig = String
  type MessagingEvent = String
  type HealthCheck = String
  type MessagingMetrics = String

  invariants exports_present {
    - true
  }
}
