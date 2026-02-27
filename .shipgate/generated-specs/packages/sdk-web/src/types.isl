# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_CONFIG, CacheConfig, Interceptors, RequestConfig, ValidationError, Domain, Behavior, Entity, PropertyDef, ErrorDef, ISLWebClientConfig, Result, QueryOptions, MutationOptions, SubscriptionOptions, WebSocketMessage, ApiError, DEFAULT_RETRY, DEFAULT_CACHE, DEFAULT_HEADERS, DEFAULT_TIMEOUT
# dependencies: @isl-lang/generator-sdk/runtime

domain Types {
  version: "1.0.0"

  type CacheConfig = String
  type Interceptors = String
  type RequestConfig = String
  type ValidationError = String
  type Domain = String
  type Behavior = String
  type Entity = String
  type PropertyDef = String
  type ErrorDef = String
  type ISLWebClientConfig = String
  type Result = String
  type QueryOptions = String
  type MutationOptions = String
  type SubscriptionOptions = String
  type WebSocketMessage = String

  invariants exports_present {
    - true
  }
}
