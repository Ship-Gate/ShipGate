# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: FixMode, FixEngineOptions, FixEngineResult, FileSummary, FixEngine, PromptChoice
# dependencies: fs/promises, path

domain FixEngine {
  version: "1.0.0"

  type FixMode = String
  type FixEngineOptions = String
  type FixEngineResult = String
  type FileSummary = String
  type FixEngine = String
  type PromptChoice = String

  invariants exports_present {
    - true
  }
}
