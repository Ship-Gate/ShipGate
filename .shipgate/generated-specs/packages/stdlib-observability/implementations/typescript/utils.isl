# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateUUID, generateTraceId, generateSpanId, setDefaultClock, getDefaultClock, now, epochMillis, duration, isValidTraceId, isValidSpanId, isValidUUID, serializeError, sanitizeAttributes, Clock, SystemClock, MockClock
# dependencies: 

domain Utils {
  version: "1.0.0"

  type Clock = String
  type SystemClock = String
  type MockClock = String

  invariants exports_present {
    - true
  }
}
