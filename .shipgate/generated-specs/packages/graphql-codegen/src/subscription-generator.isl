# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateSubscriptions, pubsub, SubscriptionOptions, SubscriptionGenerator
# dependencies: graphql-redis-subscriptions, ioredis, graphql-kafka-subscriptions, graphql-rabbitmq-subscriptions, graphql-subscriptions

domain SubscriptionGenerator {
  version: "1.0.0"

  type SubscriptionOptions = String
  type SubscriptionGenerator = String

  invariants exports_present {
    - true
  }
}
