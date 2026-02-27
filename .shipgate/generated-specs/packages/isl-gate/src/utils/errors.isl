# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isISLGateError, wrapError, ErrorCode, ErrorContext, ISLGateError, ValidationError, GateBlockedError, TimeoutError, ConfigError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type ErrorCode = String
  type ErrorContext = String
  type ISLGateError = String
  type ValidationError = String
  type GateBlockedError = String
  type TimeoutError = String
  type ConfigError = String

  invariants exports_present {
    - true
  }
}
