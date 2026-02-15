# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: levenshteinDistance, stringSimilarity, findClosestMatch, findSimilarMatches, findSimilarFiles, findISLFilesInDir, extractCodeContext, formatCodeSnippet, isTTY, isCI, formatDuration, plural, formatCount, CodeLocation
# dependencies: fs/promises, path

domain Utils {
  version: "1.0.0"

  type CodeLocation = String

  invariants exports_present {
    - true
  }
}
