# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runIntentBuild, IntentPhase, IntentBuilderState, IntentBuildCallbacks
# dependencies: vscode, child_process, fs, fs/promises, path

domain IntentBuild {
  version: "1.0.0"

  type IntentPhase = String
  type IntentBuilderState = String
  type IntentBuildCallbacks = String

  invariants exports_present {
    - true
  }
}
