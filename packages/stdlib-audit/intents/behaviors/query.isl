// ============================================================================
// ISL Standard Library - Audit Log Query Behavior
// @stdlib/audit/query
// ============================================================================

import { 
  AuditEvent, 
  AuditFilters, 
  AuditQueryResult, 
  Pagination, 
  SortOrder,
  EventCategory,
  EventOutcome,
  ActorType
} from "../domain.isl"

/**
 * Query audit events with filtering and pagination
 */
behavior Query {
  description: "Query audit events with comprehensive filtering"
  
  actors {
    User { must: authenticated }
    Service { must: authenticated }
  }
  
  input {
    filters: AuditFilters?
    pagination: Pagination
    sort: SortOrder?
    
    // Projection (select specific fields)
    fields: List<String>?
    
    // Include related data
    include_changes: Boolean?
    include_metadata: Boolean?
  }
  
  output {
    success: AuditQueryResult
    
    errors {
      INVALID_QUERY {
        when: "Query parameters are invalid"
        returns: { field: String, reason: String }
      }
      INVALID_DATE_RANGE {
        when: "Date range is invalid or too wide"
        returns: { max_range_days: Int }
      }
      QUERY_TIMEOUT {
        when: "Query took too long"
        retriable: true
      }
      UNAUTHORIZED {
        when: "Insufficient permissions for this query"
      }
    }
  }
  
  preconditions {
    input.pagination.page >= 1
    input.pagination.page_size >= 1
    input.pagination.page_size <= 1000
    
    // Date range validation
    input.filters == null or 
    input.filters.timestamp_start == null or 
    input.filters.timestamp_end == null or
    input.filters.timestamp_start <= input.filters.timestamp_end
  }
  
  postconditions {
    success implies {
      result.events.length <= input.pagination.page_size
      result.page == input.pagination.page
      result.has_more == (result.total_count > result.page * result.page_size)
    }
  }
  
  temporal {
    response within 500.ms (p50)
    response within 5.seconds (p99)
  }
  
  security {
    requires authentication
    requires permission "audit:read"
    
    // PII access requires additional permission
    input.filters.actor_email != null implies requires permission "audit:read_pii"
    
    rate_limit 100/minute per actor.id
    rate_limit 1000/minute per source.service
  }
  
  compliance {
    gdpr {
      // Log access to audit logs containing PII
      any_result_contains_pii implies audit_access_logged
    }
  }
  
  observability {
    metrics {
      audit_queries_total (counter) by [has_filters, has_sort]
      audit_query_result_count (histogram)
      audit_query_latency_ms (histogram)
    }
    
    logs {
      on success: level INFO, include [actor_id, filters, result_count]
      on error: level WARN, include [actor_id, filters, error_code]
    }
  }
}

/**
 * Get a single audit event by ID
 */
behavior GetById {
  description: "Retrieve a single audit event by ID"
  
  input {
    id: UUID
    include_changes: Boolean?
    include_metadata: Boolean?
  }
  
  output {
    success: AuditEvent
    
    errors {
      NOT_FOUND {
        when: "Audit event not found"
      }
      UNAUTHORIZED {
        when: "No permission to view this event"
      }
    }
  }
  
  security {
    requires authentication
    requires permission "audit:read"
  }
}

/**
 * Get audit statistics and aggregations
 */
behavior GetStats {
  description: "Get aggregated statistics for audit events"
  
  input {
    filters: AuditFilters?
    
    // Aggregation options
    group_by: List<String>?  // category, outcome, actor_type, service, etc.
    time_bucket: TimeBucket?
  }
  
  output {
    success: AuditStats
    
    errors {
      INVALID_AGGREGATION {
        when: "Invalid grouping or time bucket"
      }
      QUERY_TIMEOUT {
        retriable: true
      }
    }
  }
  
  temporal {
    response within 10.seconds (p99)
  }
  
  security {
    requires authentication
    requires permission "audit:read"
    requires permission "audit:stats"
  }
}

enum TimeBucket {
  MINUTE
  HOUR
  DAY
  WEEK
  MONTH
}

type AuditStats = {
  total_events: Int
  by_category: Map<EventCategory, Int>?
  by_outcome: Map<EventOutcome, Int>?
  by_actor_type: Map<ActorType, Int>?
  by_service: Map<String, Int>?
  time_series: List<TimeSeriesPoint>?
}

type TimeSeriesPoint = {
  timestamp: Timestamp
  count: Int
  by_category: Map<EventCategory, Int>?
  by_outcome: Map<EventOutcome, Int>?
}

/**
 * Search audit events using full-text search
 */
behavior Search {
  description: "Full-text search across audit events"
  
  input {
    query: String { min_length: 2, max_length: 500 }
    filters: AuditFilters?
    pagination: Pagination
    
    // Search options
    highlight: Boolean?
    fuzzy: Boolean?
  }
  
  output {
    success: SearchResult
    
    errors {
      INVALID_QUERY {
        when: "Search query is invalid"
      }
      SEARCH_TIMEOUT {
        retriable: true
      }
    }
  }
  
  temporal {
    response within 2.seconds (p99)
  }
  
  security {
    requires authentication
    requires permission "audit:read"
    requires permission "audit:search"
  }
}

type SearchResult = {
  events: List<SearchHit>
  total_count: Int
  page: Int
  page_size: Int
  has_more: Boolean
}

type SearchHit = {
  event: AuditEvent
  score: Decimal
  highlights: Map<String, List<String>>?
}
