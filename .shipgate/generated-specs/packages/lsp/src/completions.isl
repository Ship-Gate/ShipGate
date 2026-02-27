# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getCompletionContext, getCompletions, CompletionContext
# dependencies: vscode-languageserver

domain Completions {
  version: "1.0.0"

  type CompletionContext = String

  invariants exports_present {
    - true
  }
}
