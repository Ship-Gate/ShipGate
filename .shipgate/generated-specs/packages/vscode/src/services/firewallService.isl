# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: violationsToDiagnostics, FirewallState, FirewallService
# dependencies: @isl-lang/firewall

domain FirewallService {
  version: "1.0.0"

  type FirewallState = String
  type FirewallService = String

  invariants exports_present {
    - true
  }
}
