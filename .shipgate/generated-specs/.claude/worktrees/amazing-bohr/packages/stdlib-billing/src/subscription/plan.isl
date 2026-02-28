# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: planDailyRate, intervalToDays, UsageType, Plan
# dependencies: 

domain Plan {
  version: "1.0.0"

  type UsageType = String
  type Plan = String

  invariants exports_present {
    - true
  }
}
