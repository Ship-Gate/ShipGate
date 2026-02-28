# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createHttpHealthCheck, createTcpHealthCheck, createCustomHealthCheck, getDefaultHealthRegistry, setDefaultHealthRegistry, HealthCheckFunction, HealthCheckRegistry, ProbeRegistry, HealthCheckType, HealthStatus
# dependencies: 

domain Health {
  version: "1.0.0"

  type HealthCheckFunction = String
  type HealthCheckRegistry = String
  type ProbeRegistry = String

  invariants exports_present {
    - true
  }
}
