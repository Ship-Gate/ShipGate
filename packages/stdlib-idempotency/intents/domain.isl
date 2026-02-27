// ============================================================================
// ISL Standard Library - Idempotency Key Management
// @stdlib/idempotency
// ============================================================================

domain Idempotency {
  version: "1.0.0"
  owner: "platform-team@company.com"
  
  // ============================================================================
  // CORE TYPES
  // ============================================================================
  
  /**
   * Unique identifier for idempotent requests
   * Should be client-generated (e.g., UUID, or deterministic hash)
   */
  type IdempotencyKey = String {
    max_length: 256
    min_length: 1
    format: /^[a-zA-Z0-9_\-:.]+$/
  }
  
  /**
   * Hash of the request payload for detecting request mismatches
   */
  type RequestHash = String {
    max_length: 64
    description: "SHA-256 hash of canonical request representation"
  }
  
  /**
   * Serialized response stored for replay
   */
  type SerializedResponse = String {
    max_length: 1048576  // 1MB max
    description: "JSON-serialized response payload"
  }
  
  // ============================================================================
  // ENUMS
  // ============================================================================
  
  /**
   * Status of an idempotency record
   */
  enum RecordStatus {
    PROCESSING   // Request is currently being processed
    COMPLETED    // Request completed successfully, response cached
    FAILED       // Request failed, may be retried with same key
  }
  
  // ============================================================================
  // MAIN ENTITY
  // ============================================================================
  
  /**
   * Stores idempotency information for a request
   */
  entity IdempotencyRecord {
    key: IdempotencyKey [unique, indexed]
    request_hash: RequestHash
    response: SerializedResponse?
    status: RecordStatus
    
    // HTTP-specific metadata
    http_status_code: Int? { min: 100, max: 599 }
    content_type: String?
    
    // Error information
    error_code: String?
    error_message: String?
    
    // Timing
    created_at: Timestamp [immutable, indexed]
    updated_at: Timestamp
    expires_at: Timestamp [indexed]
    completed_at: Timestamp?
    
    // Context
    client_id: String?
    endpoint: String?
    method: String?
    
    // Locking
    lock_token: String?
    lock_expires_at: Timestamp?
    
    invariants {
      expires_at > created_at
      updated_at >= created_at
      completed_at >= created_at or completed_at == null
      status == COMPLETED implies response != null
      status == PROCESSING implies response == null
      lock_expires_at > now() or lock_expires_at == null
    }
  }
  
  // ============================================================================
  // RESULT TYPES
  // ============================================================================
  
  /**
   * Result of checking an idempotency key
   */
  type CheckResult = {
    found: Boolean
    status: RecordStatus?
    response: SerializedResponse?
    http_status_code: Int?
    content_type: String?
    request_mismatch: Boolean  // Same key, different request hash
    created_at: Timestamp?
    completed_at: Timestamp?
  }
  
  /**
   * Result of acquiring a lock for processing
   */
  type LockResult = {
    acquired: Boolean
    lock_token: String?
    existing_status: RecordStatus?
    existing_response: SerializedResponse?
    lock_expires_at: Timestamp?
  }
  
  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  /**
   * Configuration for idempotency behavior
   */
  type IdempotencyConfig = {
    default_ttl: Duration { min: 1.minute, max: 30.days }
    lock_timeout: Duration { min: 1.second, max: 10.minutes }
    max_request_hash_size: Int { min: 1024, max: 10485760 }
    fingerprint_headers: List<String>?
    key_prefix: String?
  }
  
  // ============================================================================
  // ERROR TYPES
  // ============================================================================
  
  /**
   * Possible errors during idempotency operations
   */
  enum IdempotencyError {
    KEY_TOO_LONG
    INVALID_KEY_FORMAT
    REQUEST_MISMATCH
    LOCK_ACQUISITION_FAILED
    RECORD_NOT_FOUND
    STORAGE_ERROR
    SERIALIZATION_ERROR
    TTL_EXCEEDED
    CONCURRENT_REQUEST
  }
  
  type OperationError = {
    code: IdempotencyError
    message: String
    retriable: Boolean
    retry_after_ms: Int?
    details: Map<String, Any>?
  }
}
