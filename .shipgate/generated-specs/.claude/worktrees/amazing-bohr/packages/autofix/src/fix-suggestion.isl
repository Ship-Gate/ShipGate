# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createFixSuggestion, formatFixSuggestion, fixSuggestionsToJSON, FixSuggestion, FixLocation, FixTag, SecurityPatternId, FixSuggestionInit
# dependencies: 

domain FixSuggestion {
  version: "1.0.0"

  type FixSuggestion = String
  type FixLocation = String
  type FixTag = String
  type SecurityPatternId = String
  type FixSuggestionInit = String

  invariants exports_present {
    - true
  }
}
