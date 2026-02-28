# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: healthMiddleware, healthRouter, createHealthHandler, attachHealthChecks, pingMiddleware, versionMiddleware, HealthMiddleware, HealthRouterFactory, ExpressHealthGenerator
# dependencies: express

domain Express {
  version: "1.0.0"

  type HealthMiddleware = String
  type HealthRouterFactory = String
  type ExpressHealthGenerator = String

  invariants exports_present {
    - true
  }
}
