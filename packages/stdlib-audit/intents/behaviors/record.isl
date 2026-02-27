// ============================================================================
// ISL Standard Library - Audit Log Record Behavior
// @stdlib/audit/record
// ============================================================================

import { AuditEvent, Actor, Resource, Source, Change, EventCategory, EventOutcome } from "../domain.isl"

/**
 * Record an audit event
 * 
 * This is the primary behavior for logging audit events. It's designed for
 * high-throughput, low-latency operation while ensuring compliance requirements.
 */
behavior Record {
  description: "Record an audit event with compliance guarantees"
  
  actors {
    Service { must: authenticated }
    System { }
  }
  
  input {
    // Required fields
    action: String { max_length: 255 }
    category: EventCategory
    outcome: EventOutcome
    actor: Actor
    source: Source
    
    // Optional fields
    description: String? { max_length: 1000 }
    resource: Resource?
    metadata: Map<String, Any>?
    tags: List<String>?
    changes: List<Change>?
    
    // Error details
    error_code: String?
    error_message: String?
    
    // Timing
    duration_ms: Int?
    
    // Override timestamp (for replay/sync)
    timestamp: Timestamp?
    
    // Idempotency
    idempotency_key: String?
  }
  
  output {
    success: AuditEvent
    
    errors {
      INVALID_ACTOR {
        when: "Actor information is incomplete or invalid"
        returns: { field: String, reason: String }
      }
      INVALID_RESOURCE {
        when: "Resource information is invalid"
        returns: { field: String, reason: String }
      }
      INVALID_TIMESTAMP {
        when: "Timestamp is in the future"
      }
      DUPLICATE_EVENT {
        when: "Event with idempotency key already exists"
        returns: existing_event
      }
      STORAGE_ERROR {
        when: "Failed to persist event"
        retriable: true
        retry_after: 100.ms
      }
      RATE_LIMITED {
        when: "Too many audit events"
        retriable: true
        retry_after: 1.second
      }
    }
  }
  
  preconditions {
    input.action.length > 0
    input.actor.id.length > 0
    input.source.service.length > 0
    input.timestamp == null or input.timestamp <= now()
  }
  
  postconditions {
    success implies {
      AuditEvent.exists(result.id)
      result.timestamp <= now()
      result.action == input.action
      result.category == input.category
      result.outcome == input.outcome
      result.actor.id == input.actor.id
    }
    
    DUPLICATE_EVENT implies {
      AuditEvent.count == old(AuditEvent.count)
    }
    
    any_error implies {
      AuditEvent.count == old(AuditEvent.count)
    }
  }
  
  invariants {
    // Audit logs are append-only
    AuditEvent.immutable
    
    // No PII in logs unless explicitly marked
    input.actor.email appears_only_in marked_pii_fields
    input.actor.ip_address appears_only_in marked_pii_fields
  }
  
  temporal {
    response within 10.ms (p50)
    response within 50.ms (p99)
    eventually within 1.second: event_persisted
    eventually within 5.seconds: event_indexed
  }
  
  security {
    rate_limit 10000/second per source.service
    rate_limit 1000/second per actor.id
  }
  
  // Audit logs themselves are NOT audited (prevents infinite recursion)
  // But we do emit metrics
  observability {
    metrics {
      audit_events_total (counter) by [category, outcome]
      audit_event_size_bytes (histogram) by [category]
      audit_record_latency_ms (histogram) by [category]
    }
    
    traces {
      span "validate_input"
      span "generate_hash"
      span "persist_event"
      span "index_event"
    }
  }
}

/**
 * Record multiple audit events in batch
 */
behavior RecordBatch {
  description: "Record multiple audit events atomically"
  
  input {
    events: List<RecordInput> { min_length: 1, max_length: 1000 }
    
    // Batch options
    all_or_nothing: Boolean  // If true, fail entire batch on any error
  }
  
  output {
    success: BatchResult
    
    errors {
      BATCH_TOO_LARGE {
        when: "Batch exceeds maximum size"
        returns: { max_size: Int }
      }
      PARTIAL_FAILURE {
        when: "Some events failed (only if all_or_nothing is false)"
        returns: { succeeded: List<AuditEvent>, failed: List<BatchError> }
      }
      STORAGE_ERROR {
        retriable: true
      }
    }
  }
  
  temporal {
    response within 500.ms (p99)
  }
}

type RecordInput = {
  action: String
  category: EventCategory
  outcome: EventOutcome
  actor: Actor
  source: Source
  description: String?
  resource: Resource?
  metadata: Map<String, Any>?
  changes: List<Change>?
  duration_ms: Int?
}

type BatchResult = {
  events: List<AuditEvent>
  count: Int
}

type BatchError = {
  index: Int
  error_code: String
  error_message: String
}
