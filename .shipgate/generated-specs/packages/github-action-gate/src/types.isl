# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ActionInputs, ActionOutputs, GateReport, Finding, GitHubContext, CheckRunAnnotation, CommentOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type ActionInputs = String
  type ActionOutputs = String
  type GateReport = String
  type Finding = String
  type GitHubContext = String
  type CheckRunAnnotation = String
  type CommentOptions = String

  invariants exports_present {
    - true
  }
}
