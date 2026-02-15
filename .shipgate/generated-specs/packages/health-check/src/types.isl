# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: HealthStatus, CheckResult, HealthCheckConfig, HealthCheckResponse, DependencyType, DependencyInfo, DependencySource, DependencyConfig, DatabaseCheckConfig, DatabaseConnection, CacheCheckConfig, CacheConnection, QueueCheckConfig, QueueConnection, ExternalApiCheckConfig, CustomCheckConfig, GeneratorConfig, KubernetesProbeConfig, ExpressMiddlewareConfig, AggregatorConfig, AggregatedResult, HealthEventType, HealthEvent, HealthEventHandler
# dependencies: 

domain Types {
  version: "1.0.0"

  type HealthStatus = String
  type CheckResult = String
  type HealthCheckConfig = String
  type HealthCheckResponse = String
  type DependencyType = String
  type DependencyInfo = String
  type DependencySource = String
  type DependencyConfig = String
  type DatabaseCheckConfig = String
  type DatabaseConnection = String
  type CacheCheckConfig = String
  type CacheConnection = String
  type QueueCheckConfig = String
  type QueueConnection = String
  type ExternalApiCheckConfig = String
  type CustomCheckConfig = String
  type GeneratorConfig = String
  type KubernetesProbeConfig = String
  type ExpressMiddlewareConfig = String
  type AggregatorConfig = String
  type AggregatedResult = String
  type HealthEventType = String
  type HealthEvent = String
  type HealthEventHandler = String

  invariants exports_present {
    - true
  }
}
