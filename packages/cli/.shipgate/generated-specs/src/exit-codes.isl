# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: exitSuccess, exitISLError, exitUsageError, exitInternalError, getExitCode, classifyError, exitWithError, ExitCode, ExitCodeValue, ErrorType
# dependencies: 

domain ExitCodes {
  version: "1.0.0"

  type ExitCodeValue = String
  type ErrorType = String

  invariants exports_present {
    - true
  }
}
