# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Channel, ChannelSubscription, PublishOptions, SubscribeOptions, UnsubscribeOptions, ChannelStore, ChannelSubscriptionStore, MessageHistoryStore, AuthorizationContext, AuthorizationRequest, AuthorizationResult, ChannelAuthorizer, ChannelEventMap, ChannelEvent, ChannelEventHandler, ChannelEventEmitter, RateLimitConfig, RateLimitResult, RateLimiter, ChannelStats, ChannelManagerStats, MessageFilter, SubscriptionFilter
# dependencies: 

domain Types {
  version: "1.0.0"

  type Channel = String
  type ChannelSubscription = String
  type PublishOptions = String
  type SubscribeOptions = String
  type UnsubscribeOptions = String
  type ChannelStore = String
  type ChannelSubscriptionStore = String
  type MessageHistoryStore = String
  type AuthorizationContext = String
  type AuthorizationRequest = String
  type AuthorizationResult = String
  type ChannelAuthorizer = String
  type ChannelEventMap = String
  type ChannelEvent = String
  type ChannelEventHandler = String
  type ChannelEventEmitter = String
  type RateLimitConfig = String
  type RateLimitResult = String
  type RateLimiter = String
  type ChannelStats = String
  type ChannelManagerStats = String
  type MessageFilter = String
  type SubscriptionFilter = String

  invariants exports_present {
    - true
  }
}
