// ============================================================================
// ISL Standard Library - Idempotency Check Behavior
// @stdlib/idempotency/behaviors/check
// ============================================================================

import "../domain.isl"

/**
 * Check if a request has been processed before
 * 
 * This is the first step in idempotency handling:
 * 1. Check if the key exists
 * 2. If found and completed, return the cached response
 * 3. If found and processing, wait or reject
 * 4. If found but request hash differs, reject with mismatch error
 * 5. If not found, proceed with processing
 */
behavior Check {
  domain: Idempotency
  description: "Check if request is idempotent replay"
  
  // ============================================================================
  // INPUT
  // ============================================================================
  
  input {
    key: IdempotencyKey
    request_hash: RequestHash
    
    // Optional context for better diagnostics
    endpoint: String?
    method: String?
    client_id: String?
  }
  
  // ============================================================================
  // OUTPUT
  // ============================================================================
  
  output {
    success: CheckResult
    error: OperationError
  }
  
  // ============================================================================
  // PRECONDITIONS
  // ============================================================================
  
  preconditions {
    input.key.length > 0
    input.key.length <= 256
    input.request_hash.length > 0
    input.request_hash.length <= 64
  }
  
  // ============================================================================
  // POSTCONDITIONS
  // ============================================================================
  
  postconditions {
    success implies {
      // Result accurately reflects storage state
      output.success.found == IdempotencyRecord.exists(key: input.key)
      
      // If found, status matches stored record
      output.success.found implies {
        output.success.status == IdempotencyRecord.lookup(input.key).status
      }
      
      // Request mismatch detection
      output.success.found and output.success.request_mismatch implies {
        IdempotencyRecord.lookup(input.key).request_hash != input.request_hash
      }
      
      // Completed records include response
      output.success.found and output.success.status == COMPLETED implies {
        output.success.response != null
      }
    }
    
    error implies {
      error.code in [KEY_TOO_LONG, INVALID_KEY_FORMAT, STORAGE_ERROR]
    }
  }
  
  // ============================================================================
  // TEMPORAL CONSTRAINTS
  // ============================================================================
  
  temporal {
    // P99 latency target for check operation
    response within 5.ms (p99)
    
    // Must complete within reasonable time
    timeout: 1.second
  }
  
  // ============================================================================
  // EXAMPLES
  // ============================================================================
  
  examples {
    // New request - key not found
    example "new_request" {
      input: {
        key: "payment-123-abc",
        request_hash: "sha256:abc123..."
      }
      output: {
        success: {
          found: false,
          status: null,
          response: null,
          request_mismatch: false
        }
      }
    }
    
    // Replay - completed request
    example "replay_completed" {
      given: {
        IdempotencyRecord: {
          key: "payment-123-abc",
          request_hash: "sha256:abc123...",
          status: COMPLETED,
          response: "{\"id\": \"pay_123\", \"status\": \"success\"}"
        }
      }
      input: {
        key: "payment-123-abc",
        request_hash: "sha256:abc123..."
      }
      output: {
        success: {
          found: true,
          status: COMPLETED,
          response: "{\"id\": \"pay_123\", \"status\": \"success\"}",
          request_mismatch: false
        }
      }
    }
    
    // Request mismatch - same key, different payload
    example "request_mismatch" {
      given: {
        IdempotencyRecord: {
          key: "payment-123-abc",
          request_hash: "sha256:abc123...",
          status: COMPLETED,
          response: "{\"id\": \"pay_123\"}"
        }
      }
      input: {
        key: "payment-123-abc",
        request_hash: "sha256:different..."  // Different hash!
      }
      output: {
        success: {
          found: true,
          status: COMPLETED,
          response: null,  // Don't return response on mismatch
          request_mismatch: true
        }
      }
    }
    
    // In-progress request
    example "in_progress" {
      given: {
        IdempotencyRecord: {
          key: "payment-123-abc",
          request_hash: "sha256:abc123...",
          status: PROCESSING
        }
      }
      input: {
        key: "payment-123-abc",
        request_hash: "sha256:abc123..."
      }
      output: {
        success: {
          found: true,
          status: PROCESSING,
          response: null,
          request_mismatch: false
        }
      }
    }
  }
}
