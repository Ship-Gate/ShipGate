# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RuntimeEvidence, RuntimeVerificationResult, AppLaunchConfig, TestDatabaseConfig, EndpointSpec, TypeShape, TypeConstraint, RuntimeVerifierOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type RuntimeEvidence = String
  type RuntimeVerificationResult = String
  type AppLaunchConfig = String
  type TestDatabaseConfig = String
  type EndpointSpec = String
  type TypeShape = String
  type TypeConstraint = String
  type RuntimeVerifierOptions = String

  invariants exports_present {
    - true
  }
}
