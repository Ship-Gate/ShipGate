# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isRateLimitError, isRateLimitExceeded, isStorageError, isConfigError, getErrorContext, InvalidConfigError, MissingConfigError, ConflictingConfigError, AlgorithmError, UnsupportedAlgorithmError, StorageError, StorageConnectionError, StorageTimeoutError, BucketNotFoundError, PolicyError, PolicyEvaluationError, CircularPolicyReferenceError, MiddlewareError, KeyExtractionError, InvalidRequestError, RateLimitExceededError, RateLimitWarnedError, RateLimitThrottledError, RateLimitBlockedError, ValidationError, InvalidIdentifierError, InvalidWindowError, InvalidLimitError, ErrorFactory
# dependencies: 

domain Errors {
  version: "1.0.0"

  type InvalidConfigError = String
  type MissingConfigError = String
  type ConflictingConfigError = String
  type AlgorithmError = String
  type UnsupportedAlgorithmError = String
  type StorageError = String
  type StorageConnectionError = String
  type StorageTimeoutError = String
  type BucketNotFoundError = String
  type PolicyError = String
  type PolicyEvaluationError = String
  type CircularPolicyReferenceError = String
  type MiddlewareError = String
  type KeyExtractionError = String
  type InvalidRequestError = String
  type RateLimitExceededError = String
  type RateLimitWarnedError = String
  type RateLimitThrottledError = String
  type RateLimitBlockedError = String
  type ValidationError = String
  type InvalidIdentifierError = String
  type InvalidWindowError = String
  type InvalidLimitError = String
  type ErrorFactory = String

  invariants exports_present {
    - true
  }
}
