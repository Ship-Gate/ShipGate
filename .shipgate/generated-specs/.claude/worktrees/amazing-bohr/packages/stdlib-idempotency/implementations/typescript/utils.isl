# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: validateKey, prefixKey, unprefixKey, computeRequestHash, computeHttpRequestHash, canonicalize, generateLockToken, isValidLockToken, calculateExpiration, isExpired, remainingTtl, serializeResponse, deserializeResponse, parseResponseBody, byteSize, validateResponseSize, calculateBackoff, sleep, generateIdempotencyKey, generateDeterministicKey, wrapError, isRetriableError
# dependencies: crypto

domain Utils {
  version: "1.0.0"

  invariants exports_present {
    - true
  }
}
