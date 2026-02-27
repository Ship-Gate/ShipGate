// ============================================================================
// ISL Standard Library - Idempotency Record Behavior
// @stdlib/idempotency/behaviors/record
// ============================================================================

import "../domain.isl"

/**
 * Record the result of a completed request
 * 
 * Called after request processing to store the response for future replays:
 * 1. Update existing PROCESSING record to COMPLETED
 * 2. Store serialized response
 * 3. Set TTL for automatic cleanup
 */
behavior Record {
  domain: Idempotency
  description: "Record completed request result"
  
  // ============================================================================
  // INPUT
  // ============================================================================
  
  input {
    key: IdempotencyKey
    request_hash: RequestHash
    response: SerializedResponse
    
    // HTTP metadata
    http_status_code: Int? { min: 100, max: 599 }
    content_type: String?
    
    // TTL override
    ttl: Duration? { min: 1.minute, max: 30.days }
    
    // Lock verification
    lock_token: String?
    
    // Error recording (for failed requests)
    error_code: String?
    error_message: String?
    mark_as_failed: Boolean?
  }
  
  // ============================================================================
  // OUTPUT
  // ============================================================================
  
  output {
    success: IdempotencyRecord
    error: OperationError
  }
  
  // ============================================================================
  // PRECONDITIONS
  // ============================================================================
  
  preconditions {
    input.key.length > 0
    input.request_hash.length > 0
    input.response.length > 0
    input.response.length <= 1048576  // 1MB max
  }
  
  // ============================================================================
  // POSTCONDITIONS
  // ============================================================================
  
  postconditions {
    success implies {
      // Record exists after successful recording
      IdempotencyRecord.exists(key: input.key)
      
      // Status is set correctly
      let record = IdempotencyRecord.lookup(input.key)
      
      input.mark_as_failed implies record.status == FAILED
      not input.mark_as_failed implies record.status == COMPLETED
      
      // Response is stored
      record.response == input.response
      
      // HTTP metadata stored if provided
      input.http_status_code != null implies {
        record.http_status_code == input.http_status_code
      }
      
      // TTL is set
      record.expires_at > now()
      
      // Completed timestamp is set
      record.completed_at != null
      record.completed_at <= now()
    }
    
    error implies {
      error.code in [
        RECORD_NOT_FOUND,
        REQUEST_MISMATCH,
        LOCK_ACQUISITION_FAILED,
        STORAGE_ERROR,
        SERIALIZATION_ERROR,
        TTL_EXCEEDED
      ]
    }
  }
  
  // ============================================================================
  // TEMPORAL CONSTRAINTS
  // ============================================================================
  
  temporal {
    // Recording should be fast
    response within 10.ms (p99)
    
    // Must complete within timeout
    timeout: 5.seconds
  }
  
  // ============================================================================
  // EXAMPLES
  // ============================================================================
  
  examples {
    // Record successful completion
    example "record_success" {
      given: {
        IdempotencyRecord: {
          key: "payment-123",
          request_hash: "sha256:abc...",
          status: PROCESSING,
          lock_token: "lock-xyz"
        }
      }
      input: {
        key: "payment-123",
        request_hash: "sha256:abc...",
        response: "{\"id\": \"pay_123\", \"status\": \"success\"}",
        http_status_code: 201,
        content_type: "application/json",
        lock_token: "lock-xyz"
      }
      output: {
        success: {
          key: "payment-123",
          status: COMPLETED,
          response: "{\"id\": \"pay_123\", \"status\": \"success\"}",
          http_status_code: 201
        }
      }
    }
    
    // Record with custom TTL
    example "record_with_ttl" {
      input: {
        key: "order-456",
        request_hash: "sha256:def...",
        response: "{\"order_id\": \"ord_456\"}",
        ttl: 7.days
      }
      postcondition: {
        let record = IdempotencyRecord.lookup("order-456")
        record.expires_at >= now() + 6.days
        record.expires_at <= now() + 8.days
      }
    }
    
    // Record failed request
    example "record_failure" {
      input: {
        key: "transfer-789",
        request_hash: "sha256:ghi...",
        response: "{\"error\": \"insufficient_funds\"}",
        http_status_code: 400,
        mark_as_failed: true,
        error_code: "INSUFFICIENT_FUNDS",
        error_message: "Account balance too low"
      }
      output: {
        success: {
          key: "transfer-789",
          status: FAILED,
          error_code: "INSUFFICIENT_FUNDS"
        }
      }
    }
  }
}

/**
 * Start processing a new request
 * 
 * Creates a PROCESSING record and acquires a lock:
 * 1. Check if key already exists
 * 2. Create new record with PROCESSING status
 * 3. Acquire distributed lock
 * 4. Return lock token for later verification
 */
behavior StartProcessing {
  domain: Idempotency
  description: "Start processing a new idempotent request"
  
  input {
    key: IdempotencyKey
    request_hash: RequestHash
    
    // Optional metadata
    endpoint: String?
    method: String?
    client_id: String?
    
    // Lock configuration
    lock_timeout: Duration? { min: 1.second, max: 10.minutes }
  }
  
  output {
    success: LockResult
    error: OperationError
  }
  
  preconditions {
    input.key.length > 0
    input.request_hash.length > 0
  }
  
  postconditions {
    success implies {
      output.success.acquired implies {
        // Record created with PROCESSING status
        IdempotencyRecord.exists(key: input.key)
        IdempotencyRecord.lookup(input.key).status == PROCESSING
        
        // Lock token returned
        output.success.lock_token != null
        
        // Lock expiration set
        output.success.lock_expires_at > now()
      }
      
      not output.success.acquired implies {
        // Existing record found
        output.success.existing_status != null
      }
    }
  }
  
  temporal {
    response within 10.ms (p99)
    timeout: 5.seconds
  }
  
  examples {
    example "acquire_lock_new_request" {
      input: {
        key: "payment-new",
        request_hash: "sha256:new...",
        lock_timeout: 30.seconds
      }
      output: {
        success: {
          acquired: true,
          lock_token: "lock-abc123",
          lock_expires_at: now() + 30.seconds
        }
      }
    }
    
    example "existing_completed_request" {
      given: {
        IdempotencyRecord: {
          key: "payment-existing",
          request_hash: "sha256:existing...",
          status: COMPLETED,
          response: "{\"done\": true}"
        }
      }
      input: {
        key: "payment-existing",
        request_hash: "sha256:existing..."
      }
      output: {
        success: {
          acquired: false,
          existing_status: COMPLETED,
          existing_response: "{\"done\": true}"
        }
      }
    }
  }
}
