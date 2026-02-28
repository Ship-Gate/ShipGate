# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseSuppressions, isExpired, isSuppressed, getExpiredSuppressions, validateSuppressions, Suppression
# dependencies: 

domain Suppressions {
  version: "1.0.0"

  type Suppression = String

  invariants exports_present {
    - true
  }
}
