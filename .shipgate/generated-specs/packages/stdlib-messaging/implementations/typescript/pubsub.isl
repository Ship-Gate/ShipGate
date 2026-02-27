# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: publish, subscribe, unsubscribe, createTopic, deleteTopic, pubSubStore, SubscriptionId, FilterExpression, Topic, DeliveryPolicy, BackoffPolicy, Subscription, TopicStats, PublishResult, BatchPublishResult, PubSubError, PubSubStore
# dependencies: crypto

domain Pubsub {
  version: "1.0.0"

  type SubscriptionId = String
  type FilterExpression = String
  type Topic = String
  type DeliveryPolicy = String
  type BackoffPolicy = String
  type Subscription = String
  type TopicStats = String
  type PublishResult = String
  type BatchPublishResult = String
  type PubSubError = String
  type PubSubStore = String

  invariants exports_present {
    - true
  }
}
