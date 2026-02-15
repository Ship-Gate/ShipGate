# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_CONFIG, IdempotencyKey, RequestHash, LockToken, IdempotencyRecord, CheckInput, CheckResult, RecordInput, StartProcessingInput, LockResult, CleanupInput, CleanupResult, ReleaseLockInput, ReleaseResult, ExtendLockInput, ExtendResult, IdempotencyError, IdempotencyException, CheckResultType, RecordResultType, LockResultType, CleanupResultType, ReleaseResultType, ExtendResultType, IdempotencyConfig, IdempotencyStore, IdempotencyMiddlewareOptions, KeyExtractor, HashFunction, ResponseSerializer, SerializedResponse
# dependencies: 

domain Types {
  version: "1.0.0"

  type IdempotencyKey = String
  type RequestHash = String
  type LockToken = String
  type IdempotencyRecord = String
  type CheckInput = String
  type CheckResult = String
  type RecordInput = String
  type StartProcessingInput = String
  type LockResult = String
  type CleanupInput = String
  type CleanupResult = String
  type ReleaseLockInput = String
  type ReleaseResult = String
  type ExtendLockInput = String
  type ExtendResult = String
  type IdempotencyError = String
  type IdempotencyException = String
  type CheckResultType = String
  type RecordResultType = String
  type LockResultType = String
  type CleanupResultType = String
  type ReleaseResultType = String
  type ExtendResultType = String
  type IdempotencyConfig = String
  type IdempotencyStore = String
  type IdempotencyMiddlewareOptions = String
  type KeyExtractor = String
  type HashFunction = String
  type ResponseSerializer = String
  type SerializedResponse = String

  invariants exports_present {
    - true
  }
}
