# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createViolationRecorder, createInvariantRegistry, createCustomInvariant, serializeViolation, serializeViolations, STATE_CONSISTENCY_INVARIANTS, DATA_INTEGRITY_INVARIANTS, IDEMPOTENCY_INVARIANTS, TIMING_INVARIANTS, ATOMICITY_INVARIANTS, InvariantCategory, InvariantSeverity, InvariantDef, InvariantContext, InvariantCheckResult, ViolationRecord, ViolationRecorder, ViolationReport, ViolationSummary, InvariantRegistry, SerializedViolationRecord
# dependencies: 

domain Violations {
  version: "1.0.0"

  type InvariantCategory = String
  type InvariantSeverity = String
  type InvariantDef = String
  type InvariantContext = String
  type InvariantCheckResult = String
  type ViolationRecord = String
  type ViolationRecorder = String
  type ViolationReport = String
  type ViolationSummary = String
  type InvariantRegistry = String
  type SerializedViolationRecord = String

  invariants exports_present {
    - true
  }
}
