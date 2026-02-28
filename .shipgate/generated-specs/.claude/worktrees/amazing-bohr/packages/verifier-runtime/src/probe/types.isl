# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: computeHash, generateId, TruthpackRoute, TruthpackEnvVar, TruthpackAuthRule, TruthpackMeta, Truthpack, ProbeStatus, RouteProbeResult, EnvCheckResult, SideEffectResult, ClaimType, RuntimeClaim, ClaimEvidence, RuntimeVerdict, RuntimeProbeReport, RuntimeProofArtifact, RuntimeProbeConfig
# dependencies: crypto

domain Types {
  version: "1.0.0"

  type TruthpackRoute = String
  type TruthpackEnvVar = String
  type TruthpackAuthRule = String
  type TruthpackMeta = String
  type Truthpack = String
  type ProbeStatus = String
  type RouteProbeResult = String
  type EnvCheckResult = String
  type SideEffectResult = String
  type ClaimType = String
  type RuntimeClaim = String
  type ClaimEvidence = String
  type RuntimeVerdict = String
  type RuntimeProbeReport = String
  type RuntimeProofArtifact = String
  type RuntimeProbeConfig = String

  invariants exports_present {
    - true
  }
}
