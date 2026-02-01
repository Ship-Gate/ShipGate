// ============================================================================
// ISL Standard Library - Audit Log Export Behavior
// @stdlib/audit/export
// ============================================================================

import { 
  AuditEvent, 
  AuditFilters, 
  ExportFormat, 
  ExportResult 
} from "../domain.isl"

/**
 * Export audit events for compliance reporting
 */
behavior Export {
  description: "Export audit events for compliance and reporting"
  
  actors {
    User { must: authenticated }
    Service { must: authenticated }
  }
  
  input {
    filters: AuditFilters
    format: ExportFormat
    
    // PII handling
    include_pii: Boolean
    mask_pii: Boolean?  // If true, mask PII instead of excluding
    
    // Export options
    compression: CompressionType?
    max_events: Int? { max: 10000000 }
    
    // Delivery
    delivery: DeliveryOptions?
  }
  
  output {
    success: ExportResult
    
    errors {
      TOO_MANY_EVENTS {
        when: "Export would exceed maximum event limit"
        returns: { event_count: Int, max_allowed: Int }
      }
      DATE_RANGE_TOO_WIDE {
        when: "Date range exceeds maximum for export"
        returns: { max_days: Int }
      }
      EXPORT_IN_PROGRESS {
        when: "Another export is already running for this user"
        returns: { existing_export_id: String }
      }
      STORAGE_ERROR {
        when: "Failed to generate export"
        retriable: true
      }
      DELIVERY_ERROR {
        when: "Failed to deliver export"
        retriable: true
      }
    }
  }
  
  preconditions {
    input.filters.timestamp_start != null
    input.filters.timestamp_end != null
    input.filters.timestamp_start <= input.filters.timestamp_end
    
    // Max date range: 1 year
    input.filters.timestamp_end - input.filters.timestamp_start <= 365.days
  }
  
  postconditions {
    success implies {
      result.event_count >= 0
      result.file_size_bytes > 0
      result.expires_at > now()
    }
  }
  
  temporal {
    response within 30.seconds (p50)  // For small exports
    response within 5.minutes (p99)   // For large exports
  }
  
  security {
    requires authentication
    requires permission "audit:export"
    
    // PII export requires additional permission
    input.include_pii implies requires permission "audit:export_pii"
    
    rate_limit 10/hour per actor.id
  }
  
  compliance {
    gdpr {
      // PII export requires data processing agreement
      input.include_pii implies requires data_processing_agreement
      
      // Log all exports containing PII
      input.include_pii implies audit_access_logged
    }
    
    sox {
      // Audit exports must be logged
      always audit_export_logged
    }
  }
  
  observability {
    metrics {
      audit_exports_total (counter) by [format, include_pii]
      audit_export_size_bytes (histogram) by [format]
      audit_export_event_count (histogram)
      audit_export_duration_ms (histogram) by [format]
    }
    
    logs {
      on success: level INFO, include [actor_id, format, event_count, include_pii]
      on error: level ERROR, include [actor_id, format, error_code]
    }
  }
}

enum CompressionType {
  NONE
  GZIP
  ZSTD
}

type DeliveryOptions = {
  method: DeliveryMethod
  destination: String  // URL, email, or bucket path
  notify_on_complete: Boolean?
}

enum DeliveryMethod {
  DOWNLOAD    // Generate download URL
  EMAIL       // Send via email
  S3          // Upload to S3 bucket
  WEBHOOK     // POST to webhook URL
}

/**
 * Get status of an ongoing export
 */
behavior GetExportStatus {
  description: "Check status of an export job"
  
  input {
    export_id: String
  }
  
  output {
    success: ExportStatus
    
    errors {
      NOT_FOUND {
        when: "Export job not found"
      }
      UNAUTHORIZED {
        when: "Not authorized to view this export"
      }
    }
  }
  
  security {
    requires authentication
  }
}

type ExportStatus = {
  export_id: String
  status: ExportJobStatus
  progress_percent: Int?
  events_processed: Int?
  total_events: Int?
  started_at: Timestamp
  completed_at: Timestamp?
  error_message: String?
  result: ExportResult?
}

enum ExportJobStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
  CANCELLED
}

/**
 * Cancel an ongoing export
 */
behavior CancelExport {
  description: "Cancel an export job"
  
  input {
    export_id: String
  }
  
  output {
    success: Boolean
    
    errors {
      NOT_FOUND {
        when: "Export job not found"
      }
      ALREADY_COMPLETED {
        when: "Export has already completed"
      }
      UNAUTHORIZED {
        when: "Not authorized to cancel this export"
      }
    }
  }
  
  security {
    requires authentication
  }
}

/**
 * Schedule recurring exports for compliance
 */
behavior ScheduleExport {
  description: "Schedule recurring audit exports"
  
  input {
    name: String
    filters: AuditFilters
    format: ExportFormat
    schedule: ExportSchedule
    delivery: DeliveryOptions
    include_pii: Boolean
  }
  
  output {
    success: ScheduledExport
    
    errors {
      INVALID_SCHEDULE {
        when: "Schedule configuration is invalid"
      }
      SCHEDULE_LIMIT_REACHED {
        when: "Maximum number of scheduled exports reached"
      }
    }
  }
  
  security {
    requires authentication
    requires permission "audit:schedule_export"
    input.include_pii implies requires permission "audit:export_pii"
  }
}

type ExportSchedule = {
  frequency: ScheduleFrequency
  day_of_week: Int?    // 1-7 for weekly
  day_of_month: Int?   // 1-31 for monthly
  hour: Int { min: 0, max: 23 }
  timezone: String
}

enum ScheduleFrequency {
  DAILY
  WEEKLY
  MONTHLY
}

type ScheduledExport = {
  id: String
  name: String
  filters: AuditFilters
  format: ExportFormat
  schedule: ExportSchedule
  delivery: DeliveryOptions
  next_run: Timestamp
  last_run: Timestamp?
  created_at: Timestamp
  created_by: String
}
