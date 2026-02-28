# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: formatVerdict, formatViolationMessage, formatVerdictCompact, Verdict, ViolationSeverity, VerdictViolation, VerdictResult, VerdictFormatOptions
# dependencies: chalk

domain Verdict {
  version: "1.0.0"

  type Verdict = String
  type ViolationSeverity = String
  type VerdictViolation = String
  type VerdictResult = String
  type VerdictFormatOptions = String

  invariants exports_present {
    - true
  }
}
