# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: levenshteinDistance, damerauLevenshteinDistance, findSimilar, formatDidYouMean, formatDidYouMeanMultiple, suggestKeyword, suggestType, suggestField, suggestEntity, suggestBehavior, getContextualHelp, ISL_KEYWORDS, ISL_BUILTIN_TYPES, ERROR_PATTERNS, SuggestionOptions, Suggestion, ErrorPattern
# dependencies: 

domain Suggestions {
  version: "1.0.0"

  type SuggestionOptions = String
  type Suggestion = String
  type ErrorPattern = String

  invariants exports_present {
    - true
  }
}
