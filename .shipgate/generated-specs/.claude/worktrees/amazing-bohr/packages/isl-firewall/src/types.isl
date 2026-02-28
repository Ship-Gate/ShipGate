# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_FIREWALL_CONFIG, FirewallMode, ConfidenceTier, ClaimType, Claim, EvidenceSource, Evidence, Policy, PolicyViolation, QuickFix, PolicyDecision, FirewallResult, FirewallRequest, FirewallAllowlist, FirewallConfig
# dependencies: 

domain Types {
  version: "1.0.0"

  type FirewallMode = String
  type ConfidenceTier = String
  type ClaimType = String
  type Claim = String
  type EvidenceSource = String
  type Evidence = String
  type Policy = String
  type PolicyViolation = String
  type QuickFix = String
  type PolicyDecision = String
  type FirewallResult = String
  type FirewallRequest = String
  type FirewallAllowlist = String
  type FirewallConfig = String

  invariants exports_present {
    - true
  }
}
