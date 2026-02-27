# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ActionInputs, ActionOutputs, GitHubContext, PRComment, CheckStatus, CheckConclusion
# dependencies: 

domain Types {
  version: "1.0.0"

  type ActionInputs = String
  type ActionOutputs = String
  type GitHubContext = String
  type PRComment = String
  type CheckStatus = String
  type CheckConclusion = String

  invariants exports_present {
    - true
  }
}
