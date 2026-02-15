# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: FederatedService, ServiceMetadata, ServiceSLA, SchemaVersion, ServiceRegistration, ServiceStatus, CrossServiceReference, ReferenceKind, ResolvedReference, CompositionResult, ComposedSchema, FederatedBehavior, RoutingRule, CircuitBreakerConfig, SchemaConflict, ConflictType, GatewaySpec, GatewayService, GatewayRoute, MiddlewareConfig, RateLimitConfig, CorsConfig, AuthConfig, CacheConfig, FederatedEvent, EventSubscriber, EventContract
# dependencies: 

domain Types {
  version: "1.0.0"

  type FederatedService = String
  type ServiceMetadata = String
  type ServiceSLA = String
  type SchemaVersion = String
  type ServiceRegistration = String
  type ServiceStatus = String
  type CrossServiceReference = String
  type ReferenceKind = String
  type ResolvedReference = String
  type CompositionResult = String
  type ComposedSchema = String
  type FederatedBehavior = String
  type RoutingRule = String
  type CircuitBreakerConfig = String
  type SchemaConflict = String
  type ConflictType = String
  type GatewaySpec = String
  type GatewayService = String
  type GatewayRoute = String
  type MiddlewareConfig = String
  type RateLimitConfig = String
  type CorsConfig = String
  type AuthConfig = String
  type CacheConfig = String
  type FederatedEvent = String
  type EventSubscriber = String
  type EventContract = String

  invariants exports_present {
    - true
  }
}
