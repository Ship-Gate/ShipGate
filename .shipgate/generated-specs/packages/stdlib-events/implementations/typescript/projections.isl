# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: calculateRetryDelay, createProjection, DEFAULT_RETRY_POLICY, ProjectionConfig, ProjectionState, ProjectionHandler, IProjection, InMemoryProjection, ProjectionBuilder
# dependencies: 

domain Projections {
  version: "1.0.0"

  type ProjectionConfig = String
  type ProjectionState = String
  type ProjectionHandler = String
  type IProjection = String
  type InMemoryProjection = String
  type ProjectionBuilder = String

  invariants exports_present {
    - true
  }
}
