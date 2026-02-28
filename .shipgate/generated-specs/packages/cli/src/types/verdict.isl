# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getExitCode, normalizeDecision, EXIT_CODE, VerdictDecision, GateDecision, ExitCode, CheckStatus, Severity, ClauseResult, ResultSummary, Blocker, VerdictManifest, Verdict, GateVerdict
# dependencies: 

domain Verdict {
  version: "1.0.0"

  type VerdictDecision = String
  type GateDecision = String
  type ExitCode = String
  type CheckStatus = String
  type Severity = String
  type ClauseResult = String
  type ResultSummary = String
  type Blocker = String
  type VerdictManifest = String
  type Verdict = String
  type GateVerdict = String

  invariants exports_present {
    - true
  }
}
