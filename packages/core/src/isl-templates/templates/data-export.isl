# Data Export (GDPR) Domain
# User data export and portability for GDPR compliance

domain DataExport {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  enum ExportFormat {
    JSON
    CSV
    XML
  }
  
  enum ExportStatus {
    PENDING
    PROCESSING
    COMPLETED
    FAILED
    EXPIRED
  }
  
  enum DataCategory {
    PROFILE
    ACTIVITY
    CONTENT
    COMMUNICATIONS
    PREFERENCES
    ANALYTICS
    ALL
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity DataExportRequest {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    categories: List<DataCategory>
    format: ExportFormat [default: JSON]
    status: ExportStatus [default: PENDING]
    file_path: String?
    file_size_bytes: Int?
    download_url: String?
    download_expires_at: Timestamp?
    error_message: String?
    requested_at: Timestamp [immutable]
    started_at: Timestamp?
    completed_at: Timestamp?
    downloaded_at: Timestamp?
    
    invariants {
      completed_at != null implies status in [COMPLETED, FAILED]
      download_url != null implies status == COMPLETED
    }
    
    lifecycle {
      PENDING -> PROCESSING
      PROCESSING -> COMPLETED
      PROCESSING -> FAILED
      COMPLETED -> EXPIRED
    }
  }
  
  entity DataRetentionPolicy {
    id: UUID [immutable, unique]
    data_category: DataCategory
    retention_days: Int
    archive_after_days: Int?
    delete_after_archive: Boolean [default: false]
    is_active: Boolean [default: true]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      retention_days > 0
      archive_after_days == null or archive_after_days < retention_days
    }
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior RequestExport {
    description: "Request an export of user data"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      categories: List<DataCategory> [default: [ALL]]
      format: ExportFormat [default: JSON]
    }
    
    output {
      success: DataExportRequest
      
      errors {
        EXPORT_IN_PROGRESS {
          when: "A data export is already in progress"
          retriable: false
        }
        TOO_SOON {
          when: "Please wait before requesting another export"
          retriable: true
          retry_after: remaining_cooldown
        }
      }
    }
    
    preconditions {
      not DataExportRequest.exists(
        user_id: actor.id,
        status: PROCESSING
      )
      // Rate limit: one export per 24 hours
      DataExportRequest.latest(user_id: actor.id).requested_at < now() - 24h
    }
    
    postconditions {
      success implies {
        DataExportRequest.exists(result.id)
        result.status == PENDING
      }
    }
    
    temporal {
      response within 200ms
      eventually within 24h: export_ready
    }
    
    effects {
      Email { send_export_started_notification }
    }
  }
  
  behavior ProcessExport {
    description: "Process a data export request"
    
    actors {
      System { }
    }
    
    input {
      request_id: UUID
    }
    
    output {
      success: DataExportRequest
      
      errors {
        REQUEST_NOT_FOUND {
          when: "Export request does not exist"
          retriable: false
        }
        ALREADY_PROCESSED {
          when: "Export was already processed"
          retriable: false
        }
        PROCESSING_FAILED {
          when: "Failed to generate export"
          retriable: true
        }
      }
    }
    
    postconditions {
      success implies {
        DataExportRequest.lookup(input.request_id).status == COMPLETED
        DataExportRequest.lookup(input.request_id).file_path != null
        DataExportRequest.lookup(input.request_id).download_url != null
      }
    }
    
    effects {
      Email { send_export_ready_notification }
    }
  }
  
  behavior DownloadExport {
    description: "Get download URL for completed export"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      request_id: UUID
    }
    
    output {
      success: {
        download_url: String
        expires_at: Timestamp
        file_size_bytes: Int
        format: ExportFormat
      }
      
      errors {
        REQUEST_NOT_FOUND {
          when: "Export request does not exist"
          retriable: false
        }
        NOT_READY {
          when: "Export is not yet ready"
          retriable: true
        }
        EXPORT_EXPIRED {
          when: "Export download has expired"
          retriable: false
        }
        NOT_OWNER {
          when: "Cannot access another user's export"
          retriable: false
        }
      }
    }
    
    preconditions {
      DataExportRequest.lookup(input.request_id).user_id == actor.id
      DataExportRequest.lookup(input.request_id).status == COMPLETED
      DataExportRequest.lookup(input.request_id).download_expires_at > now()
    }
    
    postconditions {
      success implies {
        DataExportRequest.lookup(input.request_id).downloaded_at == now()
      }
    }
    
    security {
      signed_url with 1h expiry
    }
  }
  
  behavior GetExportStatus {
    description: "Get status of a data export request"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      request_id: UUID
    }
    
    output {
      success: {
        status: ExportStatus
        progress_percentage: Int?
        estimated_completion: Timestamp?
        download_available: Boolean
        download_expires_at: Timestamp?
      }
    }
  }
  
  behavior ListExports {
    description: "List user's export requests"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      limit: Int [default: 10]
    }
    
    output {
      success: {
        exports: List<DataExportRequest>
      }
    }
  }
  
  behavior CancelExport {
    description: "Cancel a pending export request"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      request_id: UUID
    }
    
    output {
      success: Boolean
      
      errors {
        CANNOT_CANCEL {
          when: "Export is already processing or completed"
          retriable: false
        }
      }
    }
    
    preconditions {
      DataExportRequest.lookup(input.request_id).status == PENDING
    }
  }
  
  behavior SetRetentionPolicy {
    description: "Configure data retention policy"
    
    actors {
      Admin { must: authenticated }
    }
    
    input {
      data_category: DataCategory
      retention_days: Int
      archive_after_days: Int?
    }
    
    output {
      success: DataRetentionPolicy
    }
    
    compliance {
      gdpr {
        minimum_retention: as required by law
        maximum_retention: purpose limitation
      }
    }
  }
  
  behavior ApplyRetention {
    description: "Apply retention policies and purge old data"
    
    actors {
      System { }
    }
    
    output {
      success: {
        archived_count: Int
        deleted_count: Int
        by_category: Map<DataCategory, Int>
      }
    }
    
    temporal {
      runs daily at 02:00 UTC
    }
    
    effects {
      AuditLog { log_retention_applied }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios RequestExport {
    scenario "successful export request" {
      when {
        result = RequestExport(
          categories: [PROFILE, ACTIVITY, CONTENT],
          format: JSON
        )
      }
      
      then {
        result is success
        result.status == PENDING
      }
    }
    
    scenario "rate limited" {
      given {
        recent_export = DataExportRequest.create(
          user_id: user.id,
          requested_at: now() - 1h
        )
      }
      
      when {
        result = RequestExport(categories: [ALL])
      }
      
      then {
        result is TOO_SOON
      }
    }
  }
}
