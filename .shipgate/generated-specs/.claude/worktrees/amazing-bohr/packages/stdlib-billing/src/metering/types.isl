# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: UsageRecord, UsageSummary, MeterTier, OverageResult, RecordUsageInput
# dependencies: 

domain Types {
  version: "1.0.0"

  type UsageRecord = String
  type UsageSummary = String
  type MeterTier = String
  type OverageResult = String
  type RecordUsageInput = String

  invariants exports_present {
    - true
  }
}
