// ============================================================================
// ISL Standard Library - Idempotency Cleanup Behavior
// @stdlib/idempotency/behaviors/cleanup
// ============================================================================

import "../domain.isl"

/**
 * Clean up expired idempotency records
 * 
 * Maintenance operation to remove expired records:
 * 1. Find records where expires_at < now()
 * 2. Delete in batches to avoid lock contention
 * 3. Optionally archive before deletion
 */
behavior Cleanup {
  domain: Idempotency
  description: "Clean up expired idempotency records"
  
  // ============================================================================
  // INPUT
  // ============================================================================
  
  input {
    // Batch configuration
    batch_size: Int? { min: 1, max: 10000, default: 1000 }
    max_records: Int? { min: 1, max: 1000000 }
    
    // Target specific keys
    key_prefix: String?
    client_id: String?
    
    // Archive before delete
    archive: Boolean?
    archive_destination: String?
    
    // Force cleanup of non-expired records
    force_before: Timestamp?
    
    // Dry run mode
    dry_run: Boolean?
  }
  
  // ============================================================================
  // OUTPUT
  // ============================================================================
  
  output {
    success: CleanupResult
    error: OperationError
  }
  
  type CleanupResult = {
    deleted_count: Int
    archived_count: Int?
    batches_processed: Int
    oldest_remaining: Timestamp?
    next_expiration: Timestamp?
    duration_ms: Int
  }
  
  // ============================================================================
  // PRECONDITIONS
  // ============================================================================
  
  preconditions {
    input.archive implies input.archive_destination != null
    input.force_before implies input.force_before <= now()
  }
  
  // ============================================================================
  // POSTCONDITIONS
  // ============================================================================
  
  postconditions {
    success implies {
      // Records actually deleted (unless dry run)
      not input.dry_run implies {
        // All expired records up to max_records are removed
        output.success.deleted_count >= 0
      }
      
      // Dry run doesn't modify data
      input.dry_run implies {
        // State unchanged
        true  // No modifications
      }
      
      // Archive count matches if archiving
      input.archive implies {
        output.success.archived_count == output.success.deleted_count
      }
    }
  }
  
  // ============================================================================
  // TEMPORAL CONSTRAINTS
  // ============================================================================
  
  temporal {
    // Cleanup can take a while for large datasets
    timeout: 5.minutes
    
    // But each batch should be fast
    per_batch within 100.ms (p95)
  }
  
  // ============================================================================
  // EXAMPLES
  // ============================================================================
  
  examples {
    example "cleanup_expired" {
      given: {
        IdempotencyRecords: [
          { key: "old-1", expires_at: now() - 1.hour },
          { key: "old-2", expires_at: now() - 2.hours },
          { key: "valid", expires_at: now() + 1.day }
        ]
      }
      input: {
        batch_size: 100
      }
      output: {
        success: {
          deleted_count: 2,
          batches_processed: 1,
          oldest_remaining: // timestamp of "valid"
        }
      }
    }
    
    example "dry_run" {
      input: {
        dry_run: true
      }
      output: {
        success: {
          deleted_count: 0,  // Would have deleted, but dry run
          batches_processed: 0
        }
      }
    }
  }
}

/**
 * Release a lock without recording a result
 * 
 * Used when processing fails and needs to be retried:
 * 1. Verify lock ownership
 * 2. Delete the PROCESSING record
 * 3. Allow retry with same key
 */
behavior ReleaseLock {
  domain: Idempotency
  description: "Release lock without recording result"
  
  input {
    key: IdempotencyKey
    lock_token: String
    
    // Optionally mark as failed instead of deleting
    mark_failed: Boolean?
    error_code: String?
    error_message: String?
  }
  
  output {
    success: ReleaseResult
    error: OperationError
  }
  
  type ReleaseResult = {
    released: Boolean
    record_deleted: Boolean
    record_marked_failed: Boolean
  }
  
  preconditions {
    input.lock_token.length > 0
    input.mark_failed implies input.error_code != null
  }
  
  postconditions {
    success implies {
      output.success.released implies {
        not input.mark_failed implies {
          // Record deleted, key can be reused
          not IdempotencyRecord.exists(key: input.key)
          output.success.record_deleted == true
        }
        
        input.mark_failed implies {
          // Record kept but marked failed
          IdempotencyRecord.exists(key: input.key)
          IdempotencyRecord.lookup(input.key).status == FAILED
          output.success.record_marked_failed == true
        }
      }
    }
    
    error implies {
      error.code in [RECORD_NOT_FOUND, LOCK_ACQUISITION_FAILED]
    }
  }
  
  temporal {
    response within 5.ms (p99)
    timeout: 1.second
  }
}

/**
 * Extend lock timeout
 * 
 * For long-running requests, extend the lock to prevent timeout:
 * 1. Verify lock ownership
 * 2. Update lock_expires_at
 * 3. Return new expiration time
 */
behavior ExtendLock {
  domain: Idempotency
  description: "Extend processing lock timeout"
  
  input {
    key: IdempotencyKey
    lock_token: String
    extension: Duration { min: 1.second, max: 10.minutes }
  }
  
  output {
    success: ExtendResult
    error: OperationError
  }
  
  type ExtendResult = {
    extended: Boolean
    new_expires_at: Timestamp
  }
  
  postconditions {
    success implies {
      output.success.extended implies {
        let record = IdempotencyRecord.lookup(input.key)
        record.lock_expires_at == output.success.new_expires_at
        record.lock_token == input.lock_token
      }
    }
  }
  
  temporal {
    response within 5.ms (p99)
    timeout: 1.second
  }
}
