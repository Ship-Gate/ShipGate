# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_ALLOWED_DIRS, DEFAULT_SENSITIVE_PATTERNS, DANGEROUS_EXTENSIONS, INVALID_PATH_CHARS, UNC_PATH_PATTERN, PATH_TRAVERSAL_PATTERN, PathErrorCode, PathValidationResult, SafePathConfig, WriteGuardConfig, WriteGuardResult, WriteOptions, WriteGuardStats
# dependencies: 

domain GuardTypes {
  version: "1.0.0"

  type PathErrorCode = String
  type PathValidationResult = String
  type SafePathConfig = String
  type WriteGuardConfig = String
  type WriteGuardResult = String
  type WriteOptions = String
  type WriteGuardStats = String

  invariants exports_present {
    - true
  }
}
