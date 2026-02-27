# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createCompleter, KEYWORDS, META_COMMANDS, ISL_COMMANDS, COMMANDS, GEN_TARGETS, CompletionItem, CompletionProvider
# dependencies: fs, path

domain Completions {
  version: "1.0.0"

  type CompletionItem = String
  type CompletionProvider = String

  invariants exports_present {
    - true
  }
}
