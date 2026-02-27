# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: truthpackRoutesToClaims, truthpackEnvVarsToClaims, RouteClaim, EnvVarClaim
# dependencies: 

domain ClaimIntegration {
  version: "1.0.0"

  type RouteClaim = String
  type EnvVarClaim = String

  invariants exports_present {
    - true
  }
}
