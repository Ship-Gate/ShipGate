# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateUnifiedDiff, generateInlineDiff, generatePatchFile, generatePatchFromSuggestions, formatDiffBlock, PatchEntry
# dependencies: diff

domain DiffGenerator {
  version: "1.0.0"

  type PatchEntry = String

  invariants exports_present {
    - true
  }
}
