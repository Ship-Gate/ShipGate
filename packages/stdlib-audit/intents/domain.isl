// ============================================================================
// ISL Standard Library - Audit Log Domain
// @stdlib/audit
// ============================================================================

domain AuditLog {
  version: "1.0.0"
  owner: "compliance-team@company.com"
  
  // ============================================================================
  // CORE TYPES
  // ============================================================================
  
  type AuditEventId = UUID {
    generation: timestamp_random
    sortable: true
  }
  
  type ActorId = String {
    max_length: 255
  }
  
  type ResourceId = String {
    max_length: 255
  }
  
  // ============================================================================
  // ENUMS
  // ============================================================================
  
  /**
   * Categories of audit events for filtering and retention policies
   */
  enum EventCategory {
    AUTHENTICATION      // Login, logout, password changes
    AUTHORIZATION       // Permission checks, role changes
    DATA_ACCESS         // Read operations on sensitive data
    DATA_MODIFICATION   // Create, update, delete operations
    ADMIN_ACTION        // Administrative operations
    SYSTEM_EVENT        // System-level events
    SECURITY_EVENT      // Security-related events
  }
  
  /**
   * Outcome of the audited action
   */
  enum EventOutcome {
    SUCCESS
    FAILURE
    UNKNOWN
  }
  
  /**
   * Type of actor performing the action
   */
  enum ActorType {
    USER        // Human user
    SERVICE     // Service account / API client
    SYSTEM      // Internal system process
    ANONYMOUS   // Unauthenticated actor
  }
  
  // ============================================================================
  // COMPLEX TYPES
  // ============================================================================
  
  /**
   * Information about who performed the action
   */
  type Actor = {
    id: ActorId
    type: ActorType
    name: String? { max_length: 255 }
    email: String? [pii] { format: /^[^\s@]+@[^\s@]+$/ }
    ip_address: String? [pii]
    user_agent: String? { max_length: 1000 }
    session_id: String?
    
    // Additional context
    roles: List<String>?
    organization_id: String?
  }
  
  /**
   * Information about the affected resource
   */
  type Resource = {
    type: String { max_length: 100 }
    id: ResourceId
    name: String? { max_length: 255 }
    owner_id: String?
    
    // Resource hierarchy
    parent_type: String?
    parent_id: String?
  }
  
  /**
   * Information about the source of the event
   */
  type Source = {
    service: String { max_length: 100 }
    version: String?
    environment: String?
    instance_id: String?
    request_id: String?
    
    // Network context
    host: String?
    port: Int?
  }
  
  /**
   * Represents a single field change
   */
  type Change = {
    field: String { max_length: 255 }
    old_value: Any? [sensitive]
    new_value: Any? [sensitive]
    
    // For complex nested changes
    path: String?
  }
  
  /**
   * Pagination parameters
   */
  type Pagination = {
    page: Int { min: 1 }
    page_size: Int { min: 1, max: 1000 }
  }
  
  /**
   * Sort order for queries
   */
  type SortOrder = {
    field: String
    direction: SortDirection
  }
  
  enum SortDirection { ASC, DESC }
  
  // ============================================================================
  // MAIN ENTITY
  // ============================================================================
  
  /**
   * Core audit event entity
   */
  entity AuditEvent {
    id: AuditEventId [immutable, unique]
    
    // What happened
    action: String { max_length: 255 }
    category: EventCategory
    outcome: EventOutcome
    description: String? { max_length: 1000 }
    
    // Who did it
    actor: Actor
    
    // What was affected
    resource: Resource?
    
    // Context
    source: Source
    metadata: Map<String, Any>?
    tags: List<String>?
    
    // Changes (for modifications)
    changes: List<Change>?
    
    // Error details (for failures)
    error_code: String?
    error_message: String?
    
    // Timing
    timestamp: Timestamp [immutable, indexed]
    duration_ms: Int?
    
    // Compliance
    retention_until: Timestamp?
    compliance_flags: List<String>?
    
    // Immutability proof
    hash: String? [immutable]
    previous_hash: String?
    
    invariants {
      timestamp <= now()
      duration_ms >= 0 or duration_ms == null
      retention_until >= timestamp or retention_until == null
    }
  }
  
  // ============================================================================
  // QUERY TYPES
  // ============================================================================
  
  /**
   * Filters for querying audit events
   */
  type AuditFilters = {
    // Actor filters
    actor_id: ActorId?
    actor_type: ActorType?
    actor_email: String? [pii]
    
    // Resource filters
    resource_type: String?
    resource_id: ResourceId?
    
    // Event filters
    action: String?
    action_prefix: String?
    category: EventCategory?
    categories: List<EventCategory>?
    outcome: EventOutcome?
    
    // Time filters
    timestamp_start: Timestamp?
    timestamp_end: Timestamp?
    
    // Source filters
    service: String?
    environment: String?
    request_id: String?
    
    // Full-text search
    search: String?
    
    // Tag filters
    tags: List<String>?
    tags_match: TagMatch?
  }
  
  enum TagMatch { ALL, ANY }
  
  /**
   * Result of an audit query
   */
  type AuditQueryResult = {
    events: List<AuditEvent>
    total_count: Int
    page: Int
    page_size: Int
    has_more: Boolean
  }
  
  // ============================================================================
  // EXPORT TYPES
  // ============================================================================
  
  enum ExportFormat {
    CSV
    JSON
    NDJSON
    PARQUET
  }
  
  type ExportResult = {
    export_id: String
    format: ExportFormat
    event_count: Int
    file_size_bytes: Int
    download_url: String?
    expires_at: Timestamp?
  }
  
  // ============================================================================
  // RETENTION POLICY
  // ============================================================================
  
  type RetentionPolicy = {
    category: EventCategory
    retention_days: Int { min: 1 }
    archive_after_days: Int?
    compliance_standard: String?
  }
}
