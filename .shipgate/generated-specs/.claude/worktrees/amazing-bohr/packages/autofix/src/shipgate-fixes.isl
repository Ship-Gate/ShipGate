# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: registerFixer, getFixer, listFixers, suggestFixes, readFileSafe, writeFileSafe, generatePatchDiff, FixContext, ShipgateFixSuggestion, SuggestFixesResult, Fixer
# dependencies: @isl-lang/autofix/shipgate-fixes, fs/promises, fs, path

domain ShipgateFixes {
  version: "1.0.0"

  type FixContext = String
  type ShipgateFixSuggestion = String
  type SuggestFixesResult = String
  type Fixer = String

  invariants exports_present {
    - true
  }
}
