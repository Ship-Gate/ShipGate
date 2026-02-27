// ============================================================================
// Analytics Domain - Event Tracking & Metrics
// Version: 1.0.0
// ============================================================================

domain Analytics {
  version: "1.0.0"
  owner: "IntentOS Standard Library"
  
  // ============================================================================
  // CORE TYPES
  // ============================================================================
  
  type EventId = UUID
  type UserId = UUID
  type SessionId = UUID
  type TrackingId = String { pattern: /^[a-zA-Z0-9_-]+$/, max_length: 64 }
  
  type EventName = String { 
    pattern: /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/  // e.g., "user.signup", "order.completed"
    max_length: 128
  }
  
  type PropertyName = String { pattern: /^[a-z][a-z0-9_]*$/, max_length: 64 }
  type MetricName = String { pattern: /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, max_length: 128 }
  
  // ============================================================================
  // ENUMS
  // ============================================================================
  
  enum EventType {
    TRACK          // Generic event
    PAGE           // Page view
    SCREEN         // Mobile screen view
    IDENTIFY       // User identification
    GROUP          // Group/org association
    ALIAS          // User alias
  }
  
  enum MetricType {
    COUNTER        // Monotonically increasing
    GAUGE          // Point-in-time value
    HISTOGRAM      // Distribution
    SUMMARY        // Percentiles
  }
  
  enum AggregationPeriod {
    MINUTE
    HOUR
    DAY
    WEEK
    MONTH
    QUARTER
    YEAR
  }
  
  // ============================================================================
  // EVENT ENTITY
  // ============================================================================
  
  entity Event {
    id: EventId [immutable, unique, indexed]
    
    // Event info
    type: EventType
    name: EventName [indexed]
    
    // User/session
    user_id: UserId? [indexed]
    anonymous_id: TrackingId? [indexed]
    session_id: SessionId? [indexed]
    
    // Properties
    properties: Map<PropertyName, Any>
    
    // Context
    context: EventContext
    
    // Timing
    timestamp: Timestamp [indexed]
    received_at: Timestamp [immutable]
    
    // Source
    source: String?
    sdk_version: String?
    
    // Deduplication
    message_id: String? [unique]
    
    invariants {
      // Must have either user_id or anonymous_id
      user_id != null or anonymous_id != null
      
      // Timestamp should be reasonable
      timestamp >= received_at - 30.days
      timestamp <= received_at + 1.hour
    }
  }
  
  type EventContext = {
    // Device
    device: DeviceContext?
    
    // Location
    location: LocationContext?
    
    // App/Web
    app: AppContext?
    page: PageContext?
    
    // Campaign
    campaign: CampaignContext?
    
    // Network
    network: NetworkContext?
    
    // Custom
    custom: Map<String, Any>?
  }
  
  type DeviceContext = {
    id: String?
    manufacturer: String?
    model: String?
    name: String?
    type: String?  // mobile, tablet, desktop
    
    // OS
    os_name: String?
    os_version: String?
    
    // Screen
    screen_width: Int?
    screen_height: Int?
    screen_density: Decimal?
    
    // User agent
    user_agent: String?
  }
  
  type LocationContext = {
    ip: String?
    country: String?
    region: String?
    city: String?
    latitude: Decimal?
    longitude: Decimal?
    timezone: String?
  }
  
  type AppContext = {
    name: String?
    version: String?
    build: String?
    namespace: String?
  }
  
  type PageContext = {
    path: String?
    referrer: String?
    search: String?
    title: String?
    url: String?
  }
  
  type CampaignContext = {
    name: String?
    source: String?
    medium: String?
    term: String?
    content: String?
  }
  
  type NetworkContext = {
    carrier: String?
    cellular: Boolean?
    wifi: Boolean?
    bluetooth: Boolean?
  }
  
  // ============================================================================
  // USER PROFILE
  // ============================================================================
  
  entity UserProfile {
    user_id: UserId [unique, indexed]
    
    // Identity
    anonymous_ids: List<TrackingId>
    
    // Traits (user properties)
    traits: Map<PropertyName, Any>
    
    // Computed traits
    computed_traits: Map<PropertyName, Any>
    
    // Segments
    segments: List<String>
    
    // Stats
    first_seen_at: Timestamp [immutable]
    last_seen_at: Timestamp
    event_count: Int
    session_count: Int
    
    // Attribution
    first_touch: AttributionData?
    last_touch: AttributionData?
    
    updated_at: Timestamp
  }
  
  type AttributionData = {
    timestamp: Timestamp
    campaign: CampaignContext?
    referrer: String?
    landing_page: String?
  }
  
  // ============================================================================
  // SESSION ENTITY
  // ============================================================================
  
  entity Session {
    id: SessionId [unique, indexed]
    
    user_id: UserId? [indexed]
    anonymous_id: TrackingId? [indexed]
    
    // Timing
    started_at: Timestamp [immutable]
    ended_at: Timestamp?
    duration: Duration?
    
    // Stats
    event_count: Int
    page_views: Int
    
    // Entry/exit
    entry_page: String?
    exit_page: String?
    
    // Context
    device: DeviceContext?
    location: LocationContext?
    campaign: CampaignContext?
    
    // Engagement
    engaged: Boolean
    bounced: Boolean
    
    computed {
      is_active: Boolean = ended_at == null
      is_bounced: Boolean = page_views == 1 and event_count <= 1
    }
  }
  
  // ============================================================================
  // METRIC ENTITY
  // ============================================================================
  
  entity Metric {
    name: MetricName [indexed]
    type: MetricType
    
    // Labels/dimensions
    labels: Map<String, String>
    
    // Value (depends on type)
    value: Decimal           // For COUNTER, GAUGE
    count: Int?              // For HISTOGRAM, SUMMARY
    sum: Decimal?            // For HISTOGRAM, SUMMARY
    buckets: Map<Decimal, Int>?  // For HISTOGRAM
    quantiles: Map<Decimal, Decimal>?  // For SUMMARY
    
    timestamp: Timestamp [indexed]
  }
  
  // ============================================================================
  // FUNNEL ENTITY
  // ============================================================================
  
  entity Funnel {
    id: UUID [unique]
    name: String
    
    // Steps
    steps: List<FunnelStep>
    
    // Settings
    conversion_window: Duration
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  type FunnelStep = {
    name: String
    event_name: EventName
    filter: EventFilter?
  }
  
  type EventFilter = {
    property: PropertyName
    operator: FilterOperator
    value: Any
  }
  
  enum FilterOperator {
    EQUALS
    NOT_EQUALS
    CONTAINS
    NOT_CONTAINS
    GREATER_THAN
    LESS_THAN
    IS_SET
    IS_NOT_SET
  }
  
  // ============================================================================
  // COHORT ENTITY
  // ============================================================================
  
  entity Cohort {
    id: UUID [unique]
    name: String
    description: String?
    
    // Definition
    type: CohortType
    definition: CohortDefinition
    
    // Members
    user_count: Int
    
    // Sync
    last_computed_at: Timestamp?
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }
  
  enum CohortType {
    STATIC       // Fixed list of users
    DYNAMIC      // Query-based, auto-updating
    BEHAVIORAL   // Based on event patterns
  }
  
  type CohortDefinition = {
    // For DYNAMIC cohorts
    query: CohortQuery?
    
    // For BEHAVIORAL cohorts
    behavior: BehavioralCriteria?
    
    // For STATIC cohorts
    user_ids: List<UserId>?
  }
  
  type CohortQuery = {
    trait_filters: List<TraitFilter>?
    event_filters: List<EventCriteria>?
    operator: LogicalOperator
  }
  
  type TraitFilter = {
    trait: PropertyName
    operator: FilterOperator
    value: Any
  }
  
  type EventCriteria = {
    event_name: EventName
    operator: EventOperator
    count: Int?
    time_window: Duration?
    property_filters: List<EventFilter>?
  }
  
  enum EventOperator {
    PERFORMED
    NOT_PERFORMED
    PERFORMED_COUNT
  }
  
  enum LogicalOperator {
    AND
    OR
  }
  
  type BehavioralCriteria = {
    performed: List<EventName>?
    not_performed: List<EventName>?
    within: Duration?
    frequency: FrequencyCriteria?
  }
  
  type FrequencyCriteria = {
    event: EventName
    operator: ComparisonOperator
    count: Int
    period: Duration
  }
  
  enum ComparisonOperator {
    EQUALS
    GREATER_THAN
    LESS_THAN
    BETWEEN
  }
  
  // ============================================================================
  // BEHAVIORS
  // ============================================================================
  
  behavior Track {
    description: "Track an analytics event"
    
    input {
      event: EventName
      properties: Map<PropertyName, Any>?
      
      // User identification
      user_id: UserId?
      anonymous_id: TrackingId?
      
      // Context
      context: EventContext?
      
      // Timing
      timestamp: Timestamp?
      
      // Deduplication
      message_id: String?
    }
    
    output {
      success: Event
      errors {
        INVALID_EVENT_NAME { }
        MISSING_IDENTITY { when: "Neither user_id nor anonymous_id provided" }
        DUPLICATE_EVENT { when: "Event with message_id already exists" }
        RATE_LIMITED { retriable: true }
      }
    }
    
    preconditions {
      input.user_id != null or input.anonymous_id != null
    }
    
    postconditions {
      success implies {
        Event.exists(result.id)
        result.name == input.event
      }
    }
    
    temporal {
      response within 50.ms (p99)
    }
    
    observability {
      metrics {
        events_tracked: counter { labels: [event_name, source] }
        event_latency: histogram { }
      }
    }
  }
  
  behavior Page {
    description: "Track a page view"
    
    input {
      name: String?
      category: String?
      properties: Map<PropertyName, Any>?
      
      user_id: UserId?
      anonymous_id: TrackingId?
      context: EventContext?
    }
    
    output {
      success: Event
      errors {
        MISSING_IDENTITY { }
      }
    }
  }
  
  behavior Identify {
    description: "Identify a user and set traits"
    
    input {
      user_id: UserId
      anonymous_id: TrackingId?
      traits: Map<PropertyName, Any>?
      context: EventContext?
    }
    
    output {
      success: UserProfile
      errors {
        INVALID_USER_ID { }
      }
    }
    
    postconditions {
      success implies {
        UserProfile.exists(user_id: input.user_id)
        
        // Anonymous ID should be linked
        input.anonymous_id != null implies {
          input.anonymous_id in UserProfile.lookup(input.user_id).anonymous_ids
        }
        
        // Traits should be merged
        input.traits != null implies {
          all(input.traits, (k, v) => 
            UserProfile.lookup(input.user_id).traits[k] == v
          )
        }
      }
    }
  }
  
  behavior Alias {
    description: "Create an alias between two user identities"
    
    input {
      previous_id: TrackingId
      user_id: UserId
    }
    
    output {
      success: Boolean
      errors {
        INVALID_ALIAS { when: "Cannot create circular alias" }
      }
    }
    
    postconditions {
      success implies {
        input.previous_id in UserProfile.lookup(input.user_id).anonymous_ids
      }
    }
  }
  
  behavior Group {
    description: "Associate user with a group/organization"
    
    input {
      user_id: UserId
      group_id: String
      traits: Map<PropertyName, Any>?
    }
    
    output {
      success: Boolean
      errors {
        USER_NOT_FOUND { }
      }
    }
  }
  
  behavior Query {
    description: "Query analytics data"
    
    input {
      // Event query
      events: List<EventName>?
      
      // Time range
      start_date: Timestamp
      end_date: Timestamp
      
      // Grouping
      group_by: List<GroupByDimension>?
      
      // Filtering
      filters: List<EventFilter>?
      
      // Aggregation
      aggregation: AggregationType?
      
      // Pagination
      limit: Int { min: 1, max: 10000 }?
      offset: Int { min: 0 }?
    }
    
    output {
      success: QueryResult
      errors {
        INVALID_QUERY { }
        QUERY_TOO_BROAD { when: "Query would scan too much data" }
      }
    }
    
    temporal {
      response within 5.seconds (p99)
    }
  }
  
  behavior FunnelAnalysis {
    description: "Analyze conversion funnel"
    
    input {
      funnel_id: UUID?
      steps: List<FunnelStep>?
      
      start_date: Timestamp
      end_date: Timestamp
      
      conversion_window: Duration?
      
      // Breakdown
      breakdown_property: PropertyName?
    }
    
    output {
      success: FunnelResult
      errors {
        FUNNEL_NOT_FOUND { }
        INVALID_STEPS { }
      }
    }
  }
  
  behavior CohortAnalysis {
    description: "Analyze cohort retention"
    
    input {
      // Cohort definition
      cohort_event: EventName      // Event that defines cohort
      return_event: EventName      // Event that defines return
      
      start_date: Timestamp
      end_date: Timestamp
      
      period: AggregationPeriod
      
      filters: List<EventFilter>?
    }
    
    output {
      success: CohortRetentionResult
      errors {
        INVALID_EVENTS { }
      }
    }
  }
  
  behavior RecordMetric {
    description: "Record a custom metric"
    
    input {
      name: MetricName
      type: MetricType
      value: Decimal?
      labels: Map<String, String>?
      timestamp: Timestamp?
      
      // For histograms
      buckets: List<Decimal>?
      // For summaries
      quantiles: List<Decimal>?
    }
    
    output {
      success: Metric
      errors {
        INVALID_METRIC_NAME { }
        INVALID_VALUE { }
      }
    }
  }
  
  // ============================================================================
  // RESULT TYPES
  // ============================================================================
  
  type QueryResult = {
    rows: List<Map<String, Any>>
    total_count: Int
    aggregations: Map<String, Decimal>?
    metadata: QueryMetadata
  }
  
  type QueryMetadata = {
    query_time_ms: Int
    scanned_rows: Int
  }
  
  type GroupByDimension = {
    field: String
    type: GroupByType
    interval: AggregationPeriod?  // For time grouping
  }
  
  enum GroupByType {
    PROPERTY
    TIME
  }
  
  enum AggregationType {
    COUNT
    COUNT_UNIQUE
    SUM
    AVERAGE
    MIN
    MAX
    PERCENTILE
  }
  
  type FunnelResult = {
    steps: List<FunnelStepResult>
    overall_conversion: Decimal
    median_time_to_convert: Duration?
  }
  
  type FunnelStepResult = {
    name: String
    count: Int
    conversion_rate: Decimal
    drop_off_rate: Decimal
    median_time_from_previous: Duration?
  }
  
  type CohortRetentionResult = {
    periods: List<RetentionPeriod>
    matrix: List<List<Decimal>>  // Retention percentages
  }
  
  type RetentionPeriod = {
    date: Timestamp
    cohort_size: Int
    retained: List<Int>
    retention_rates: List<Decimal>
  }
  
  // ============================================================================
  // PRIVACY & COMPLIANCE
  // ============================================================================
  
  behavior DeleteUserData {
    description: "Delete all analytics data for a user (GDPR)"
    
    input {
      user_id: UserId
    }
    
    output {
      success: { deleted_events: Int, deleted_profiles: Int }
      errors {
        USER_NOT_FOUND { }
      }
    }
    
    temporal {
      eventually within 24.hours: all_data_deleted
    }
    
    compliance {
      gdpr { this satisfies right_to_erasure }
    }
  }
  
  behavior ExportUserData {
    description: "Export all analytics data for a user (GDPR)"
    
    input {
      user_id: UserId
      format: ExportFormat
    }
    
    output {
      success: { download_url: String, expires_at: Timestamp }
      errors {
        USER_NOT_FOUND { }
      }
    }
    
    compliance {
      gdpr { this satisfies right_to_portability }
    }
  }
  
  enum ExportFormat {
    JSON
    CSV
  }
}
