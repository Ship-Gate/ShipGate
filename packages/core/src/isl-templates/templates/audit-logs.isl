# Audit Logs Domain
# Complete audit logging with retention, search, and compliance

domain AuditLogs {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type EventType = String { max_length: 100 }
  type ResourceType = String { max_length: 100 }
  type IpAddress = String { max_length: 45 }
  
  enum Severity {
    DEBUG
    INFO
    WARNING
    ERROR
    CRITICAL
  }
  
  enum ActionResult {
    SUCCESS
    FAILURE
    PARTIAL
    DENIED
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity AuditEvent {
    id: UUID [immutable, unique]
    timestamp: Timestamp [immutable, indexed]
    event_type: EventType [indexed]
    severity: Severity [indexed]
    
    actor_id: UUID? [indexed]
    actor_type: String?
    actor_email: String?
    actor_ip: IpAddress?
    actor_user_agent: String?
    
    resource_type: ResourceType? [indexed]
    resource_id: UUID? [indexed]
    resource_name: String?
    
    action: String [indexed]
    result: ActionResult [indexed]
    
    request_id: UUID? [indexed]
    session_id: UUID?
    
    old_values: Map<String, Any>?
    new_values: Map<String, Any>?
    changes: List<{
      field: String
      old_value: Any?
      new_value: Any?
    }>?
    
    metadata: Map<String, String>
    tags: List<String>
    
    geo_location: {
      country: String?
      region: String?
      city: String?
    }?
    
    retention_expires_at: Timestamp? [indexed]
    
    invariants {
      timestamp <= now()
      event_type.length > 0
      action.length > 0
    }
  }
  
  entity AuditRetentionPolicy {
    id: UUID [immutable, unique]
    name: String [unique]
    description: String?
    event_types: List<EventType>?
    severity_levels: List<Severity>?
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
  
  entity AuditExport {
    id: UUID [immutable, unique]
    requested_by: UUID
    query_params: Map<String, Any>
    format: String [values: ["json", "csv", "parquet"]]
    status: String [values: ["pending", "processing", "completed", "failed"]]
    file_path: String?
    file_size: Int?
    record_count: Int?
    started_at: Timestamp?
    completed_at: Timestamp?
    expires_at: Timestamp?
    error_message: String?
    created_at: Timestamp [immutable]
    
    invariants {
      status == "completed" implies file_path != null
      status == "completed" implies record_count != null
    }
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior LogEvent {
    description: "Record an audit event"
    
    actors {
      System { }
    }
    
    input {
      event_type: EventType
      severity: Severity [default: INFO]
      actor_id: UUID?
      actor_type: String?
      actor_ip: IpAddress?
      resource_type: ResourceType?
      resource_id: UUID?
      action: String
      result: ActionResult
      old_values: Map<String, Any>?
      new_values: Map<String, Any>?
      metadata: Map<String, String>?
      tags: List<String>?
    }
    
    output {
      success: AuditEvent
    }
    
    postconditions {
      success implies {
        AuditEvent.exists(result.id)
        AuditEvent.lookup(result.id).timestamp <= now()
      }
    }
    
    temporal {
      response within 10ms (p99)
    }
    
    invariants {
      event stored durably
      event immutable after creation
    }
  }
  
  behavior SearchEvents {
    description: "Search audit events with filters"
    
    actors {
      Admin { must: authenticated, permission: "audit:read" }
      Auditor { must: authenticated, permission: "audit:read" }
    }
    
    input {
      event_types: List<EventType>?
      severity_levels: List<Severity>?
      actor_id: UUID?
      resource_type: ResourceType?
      resource_id: UUID?
      action: String?
      result: ActionResult?
      from_date: Timestamp?
      to_date: Timestamp?
      tags: List<String>?
      search_query: String?
      limit: Int [default: 100, max: 1000]
      cursor: String?
      sort_order: String [default: "desc"]
    }
    
    output {
      success: {
        events: List<AuditEvent>
        total_count: Int
        next_cursor: String?
        aggregations: {
          by_event_type: Map<String, Int>
          by_severity: Map<String, Int>
          by_result: Map<String, Int>
        }?
      }
    }
    
    temporal {
      response within 500ms (p99)
    }
  }
  
  behavior GetEventDetails {
    description: "Get detailed view of a single audit event"
    
    actors {
      Admin { must: authenticated, permission: "audit:read" }
    }
    
    input {
      event_id: UUID
    }
    
    output {
      success: {
        event: AuditEvent
        related_events: List<AuditEvent>?
        actor_history: List<{
          event_type: EventType
          timestamp: Timestamp
          action: String
        }>?
      }
      
      errors {
        EVENT_NOT_FOUND {
          when: "Audit event does not exist"
          retriable: false
        }
        ACCESS_DENIED {
          when: "Insufficient permissions"
          retriable: false
        }
      }
    }
  }
  
  behavior ExportEvents {
    description: "Export audit events to file"
    
    actors {
      Admin { must: authenticated, permission: "audit:export" }
    }
    
    input {
      event_types: List<EventType>?
      from_date: Timestamp
      to_date: Timestamp
      format: String [default: "json"]
      include_metadata: Boolean [default: true]
    }
    
    output {
      success: AuditExport
      
      errors {
        DATE_RANGE_TOO_LARGE {
          when: "Date range exceeds maximum export period"
          retriable: false
        }
        EXPORT_IN_PROGRESS {
          when: "Another export is already in progress"
          retriable: true
          retry_after: 5m
        }
      }
    }
    
    temporal {
      response within 1s
      eventually within 1h: export_completed
    }
    
    security {
      audit_log enabled
    }
  }
  
  behavior CreateRetentionPolicy {
    description: "Create an audit retention policy"
    
    actors {
      Admin { must: authenticated, permission: "audit:manage" }
    }
    
    input {
      name: String
      description: String?
      event_types: List<EventType>?
      severity_levels: List<Severity>?
      retention_days: Int
      archive_after_days: Int?
    }
    
    output {
      success: AuditRetentionPolicy
      
      errors {
        POLICY_EXISTS {
          when: "Policy with this name already exists"
          retriable: false
        }
        INVALID_RETENTION {
          when: "Retention period below minimum required"
          retriable: false
        }
      }
    }
    
    compliance {
      minimum_retention: 90 days for security events
      minimum_retention: 7 years for financial events
    }
  }
  
  behavior ApplyRetention {
    description: "Apply retention policies and archive/delete old events"
    
    actors {
      System { }
    }
    
    input {
      dry_run: Boolean [default: false]
    }
    
    output {
      success: {
        archived_count: Int
        deleted_count: Int
        errors_count: Int
      }
    }
    
    temporal {
      runs daily at 02:00 UTC
    }
  }
  
  behavior GetComplianceReport {
    description: "Generate compliance report for audit logs"
    
    actors {
      Admin { must: authenticated, permission: "audit:compliance" }
      Auditor { must: authenticated }
    }
    
    input {
      from_date: Timestamp
      to_date: Timestamp
      compliance_framework: String [values: ["SOC2", "GDPR", "HIPAA", "PCI"]]
    }
    
    output {
      success: {
        framework: String
        period: { start: Timestamp, end: Timestamp }
        total_events: Int
        events_by_category: Map<String, Int>
        anomalies: List<{
          type: String
          count: Int
          description: String
        }>
        recommendations: List<String>
        compliance_score: Decimal
      }
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios LogEvent {
    scenario "log user login" {
      when {
        result = LogEvent(
          event_type: "auth.login",
          severity: INFO,
          actor_id: user.id,
          actor_ip: "192.168.1.1",
          action: "login",
          result: SUCCESS,
          metadata: { "method": "password" }
        )
      }
      
      then {
        result is success
        AuditEvent.exists(result.id)
        result.event_type == "auth.login"
      }
    }
    
    scenario "log failed permission check" {
      when {
        result = LogEvent(
          event_type: "auth.permission_denied",
          severity: WARNING,
          actor_id: user.id,
          resource_type: "document",
          resource_id: doc.id,
          action: "delete",
          result: DENIED
        )
      }
      
      then {
        result is success
        result.severity == WARNING
        result.result == DENIED
      }
    }
    
    scenario "log data modification" {
      when {
        result = LogEvent(
          event_type: "data.update",
          severity: INFO,
          actor_id: user.id,
          resource_type: "user",
          resource_id: target_user.id,
          action: "update_profile",
          result: SUCCESS,
          old_values: { "name": "Old Name" },
          new_values: { "name": "New Name" }
        )
      }
      
      then {
        result is success
        result.changes != null
        result.changes[0].field == "name"
      }
    }
  }
}
