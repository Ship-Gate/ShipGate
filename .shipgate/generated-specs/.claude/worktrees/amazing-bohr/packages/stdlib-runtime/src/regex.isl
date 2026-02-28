# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: test, match, matchAll, exec, groups, captures, replace, replaceAll, replaceWithFunction, split, escape, isValidPattern, validatePattern, getPatternInfo, joinPatterns, wrapGroup, quantify, matchEmail, matchUrl, matchPhone, matchUuid, matchIpAddress, extractAll, extractNamed, PATTERN_EMAIL, PATTERN_URL, PATTERN_UUID, PATTERN_UUID_V4, PATTERN_IPV4, PATTERN_PHONE_E164, PATTERN_HEX, PATTERN_ALPHA, PATTERN_ALPHANUMERIC, PATTERN_DIGITS, PATTERN_WHITESPACE, PATTERN_WORD, PATTERN_SLUG, Regex, Match, MatchAllResult, ReplaceResult, SplitResult, PatternInfo, ValidationError
# dependencies: 

domain Regex {
  version: "1.0.0"

  type Match = String
  type MatchAllResult = String
  type ReplaceResult = String
  type SplitResult = String
  type PatternInfo = String
  type ValidationError = String

  invariants exports_present {
    - true
  }
}
