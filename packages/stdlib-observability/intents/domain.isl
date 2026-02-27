# Observability Standard Library
# Logging, Metrics, Tracing, and Alerting

domain Observability {
  version: "1.0.0"
  description: "Three pillars of observability: logs, metrics, traces"
  
  imports {
    core from "@intentos/stdlib-core"
  }
  
  # ============================================
  # LOGGING
  # ============================================
  
  type LogId = UUID
  type TraceId = String [pattern: "[a-f0-9]{32}"]
  type SpanId = String [pattern: "[a-f0-9]{16}"]
  
  enum LogLevel {
    TRACE = 0
    DEBUG = 1
    INFO = 2
    WARN = 3
    ERROR = 4
    FATAL = 5
  }
  
  entity LogEntry {
    id: LogId [auto_generated]
    timestamp: Timestamp [auto_generated]
    level: LogLevel
    
    # Message
    message: String
    template: String?  # Structured log template
    
    # Context
    service: String
    environment: String
    host: String?
    
    # Correlation
    trace_id: TraceId?
    span_id: SpanId?
    correlation_id: UUID?
    request_id: UUID?
    
    # Structured data
    attributes: Map<String, Any>?
    
    # Error info
    error: {
      type: String
      message: String
      stack_trace: String?
    }?
    
    # Source
    source: {
      file: String?
      line: Int?
      function: String?
    }?
    
    invariants {
      level in [TRACE, DEBUG, INFO, WARN, ERROR, FATAL]
      message.length > 0
    }
  }
  
  behavior Log {
    description: "Write a log entry"
    
    input {
      level: LogLevel
      message: String
      attributes: Map<String, Any>?
      error: Error?
    }
    
    output {
      success: { id: LogId }
    }
    
    postconditions {
      level >= configured_min_level implies log_written
    }
    
    temporal {
      within 10ms: log buffered
    }
    
    invariants {
      # Sensitive data never logged in plaintext
      not attributes.values.any(v => v.contains_sensitive_data)
    }
  }
  
  # ============================================
  # METRICS
  # ============================================
  
  type MetricName = String [pattern: "[a-z][a-z0-9_]*"]
  type LabelName = String [pattern: "[a-z][a-z0-9_]*"]
  type LabelValue = String
  
  enum MetricType {
    COUNTER     { description: "Monotonically increasing value" }
    GAUGE       { description: "Value that can go up or down" }
    HISTOGRAM   { description: "Distribution of values" }
    SUMMARY     { description: "Pre-calculated percentiles" }
  }
  
  entity MetricDefinition {
    name: MetricName [unique]
    type: MetricType
    description: String
    unit: MetricUnit?
    
    labels: List<LabelName>?
    
    # For histograms
    buckets: List<Float>?
    
    # For summaries
    objectives: Map<Float, Float>?  # quantile -> error
    max_age: Duration?
  }
  
  enum MetricUnit {
    # Time
    SECONDS
    MILLISECONDS
    MICROSECONDS
    
    # Size
    BYTES
    KILOBYTES
    MEGABYTES
    
    # Count
    COUNT
    PERCENT
    RATIO
    
    # Rate
    PER_SECOND
    PER_MINUTE
  }
  
  entity MetricSample {
    name: MetricName
    timestamp: Timestamp
    value: Float
    labels: Map<LabelName, LabelValue>?
  }
  
  behavior IncrementCounter {
    input {
      name: MetricName
      value: Float = 1.0 [min: 0]
      labels: Map<LabelName, LabelValue>?
    }
    
    output {
      success: { }
    }
    
    postconditions {
      counter_value == old(counter_value) + input.value
    }
  }
  
  behavior SetGauge {
    input {
      name: MetricName
      value: Float
      labels: Map<LabelName, LabelValue>?
    }
    
    output {
      success: { }
    }
  }
  
  behavior ObserveHistogram {
    input {
      name: MetricName
      value: Float
      labels: Map<LabelName, LabelValue>?
    }
    
    output {
      success: { }
    }
    
    effects {
      updates histogram buckets
      increments _count
      adds to _sum
    }
  }
  
  behavior RecordTiming {
    description: "Record a duration measurement"
    
    input {
      name: MetricName
      start_time: Timestamp
      end_time: Timestamp?
      labels: Map<LabelName, LabelValue>?
    }
    
    output {
      success: { duration_ms: Float }
    }
  }
  
  # ============================================
  # TRACING (Distributed)
  # ============================================
  
  entity Trace {
    trace_id: TraceId [immutable, unique]
    
    # Root span info
    name: String
    service: String
    
    # Timing
    start_time: Timestamp
    end_time: Timestamp?
    duration_ms: Float?
    
    # Status
    status: SpanStatus
    
    # Spans
    spans: List<Span>
    
    derived {
      span_count: Int = spans.length
      error_count: Int = spans.count(s => s.status == ERROR)
      services: List<String> = spans.map(s => s.service).distinct
    }
  }
  
  entity Span {
    span_id: SpanId [immutable, unique]
    trace_id: TraceId [immutable]
    parent_span_id: SpanId?
    
    # Identity
    name: String
    kind: SpanKind
    
    # Service
    service: String
    
    # Timing
    start_time: Timestamp
    end_time: Timestamp?
    duration_ms: Float?
    
    # Status
    status: SpanStatus
    status_message: String?
    
    # Attributes
    attributes: Map<String, Any>?
    
    # Events
    events: List<SpanEvent>?
    
    # Links to other traces
    links: List<SpanLink>?
    
    # Resource
    resource: {
      service_name: String
      service_version: String?
      host: String?
      container_id: String?
    }?
  }
  
  enum SpanKind {
    INTERNAL  { description: "Default, internal operation" }
    SERVER    { description: "Handling a remote request" }
    CLIENT    { description: "Making a remote request" }
    PRODUCER  { description: "Creating a message" }
    CONSUMER  { description: "Processing a message" }
  }
  
  enum SpanStatus {
    UNSET
    OK
    ERROR
  }
  
  type SpanEvent = {
    name: String
    timestamp: Timestamp
    attributes: Map<String, Any>?
  }
  
  type SpanLink = {
    trace_id: TraceId
    span_id: SpanId
    attributes: Map<String, Any>?
  }
  
  behavior StartSpan {
    description: "Start a new span"
    
    input {
      name: String
      kind: SpanKind = INTERNAL
      parent_context: SpanContext?
      attributes: Map<String, Any>?
      links: List<SpanLink>?
    }
    
    output {
      success: {
        span: Span
        context: SpanContext
      }
    }
    
    effects {
      creates Span
      propagates trace context
    }
  }
  
  behavior EndSpan {
    input {
      span_id: SpanId
      status: SpanStatus?
      status_message: String?
    }
    
    output {
      success: { span: Span }
    }
    
    postconditions {
      span.end_time != null
      span.duration_ms == span.end_time - span.start_time
    }
    
    effects {
      exports span to backend
    }
  }
  
  behavior AddSpanEvent {
    input {
      span_id: SpanId
      name: String
      attributes: Map<String, Any>?
    }
    
    output {
      success: { }
    }
  }
  
  behavior SetSpanAttribute {
    input {
      span_id: SpanId
      key: String
      value: Any
    }
    
    output {
      success: { }
    }
  }
  
  type SpanContext = {
    trace_id: TraceId
    span_id: SpanId
    trace_flags: Int
    trace_state: String?
    remote: Boolean
  }
  
  # Context propagation
  behavior InjectContext {
    description: "Inject trace context into carrier (headers)"
    
    input {
      context: SpanContext
      carrier: Map<String, String>
      format: PropagationFormat = W3C_TRACE_CONTEXT
    }
    
    output {
      success: { carrier: Map<String, String> }
    }
  }
  
  behavior ExtractContext {
    description: "Extract trace context from carrier"
    
    input {
      carrier: Map<String, String>
      format: PropagationFormat = W3C_TRACE_CONTEXT
    }
    
    output {
      success: { context: SpanContext? }
    }
  }
  
  enum PropagationFormat {
    W3C_TRACE_CONTEXT
    W3C_BAGGAGE
    B3_SINGLE
    B3_MULTI
    JAEGER
    XRAY
  }
  
  # ============================================
  # ALERTING
  # ============================================
  
  entity AlertRule {
    id: UUID [unique]
    name: String
    description: String?
    
    # Condition
    query: String  # PromQL, LogQL, etc.
    threshold: AlertThreshold
    
    # Timing
    for_duration: Duration?  # Must be true for this long
    evaluation_interval: Duration = 1.minute
    
    # State
    state: AlertState
    active_since: Timestamp?
    
    # Routing
    severity: AlertSeverity
    labels: Map<String, String>?
    annotations: Map<String, String>?
    
    # Notification
    notification_channels: List<String>
    
    # Silencing
    silenced_until: Timestamp?
    
    lifecycle {
      INACTIVE -> PENDING [on: threshold_exceeded]
      PENDING -> FIRING [on: duration_exceeded]
      FIRING -> RESOLVED [on: threshold_normal]
      PENDING -> INACTIVE [on: threshold_normal]
    }
  }
  
  type AlertThreshold = {
    operator: ComparisonOperator
    value: Float
  }
  
  enum ComparisonOperator {
    GREATER_THAN
    GREATER_THAN_OR_EQUAL
    LESS_THAN
    LESS_THAN_OR_EQUAL
    EQUAL
    NOT_EQUAL
  }
  
  enum AlertState {
    INACTIVE
    PENDING
    FIRING
    RESOLVED
  }
  
  enum AlertSeverity {
    CRITICAL
    WARNING
    INFO
  }
  
  entity Alert {
    id: UUID [unique]
    rule_id: UUID
    
    # State
    state: AlertState
    started_at: Timestamp
    ended_at: Timestamp?
    
    # Context
    labels: Map<String, String>
    annotations: Map<String, String>?
    
    # Value that triggered
    value: Float
    
    # Notifications sent
    notifications: List<{
      channel: String
      sent_at: Timestamp
      acknowledged_at: Timestamp?
      acknowledged_by: String?
    }>
  }
  
  behavior CreateAlertRule {
    input {
      name: String
      query: String
      threshold: AlertThreshold
      severity: AlertSeverity
      notification_channels: List<String>
      for_duration: Duration?
    }
    
    output {
      success: { rule: AlertRule }
      errors {
        INVALID_QUERY { }
        CHANNEL_NOT_FOUND { }
      }
    }
  }
  
  behavior AcknowledgeAlert {
    input {
      alert_id: UUID
      acknowledged_by: String
      comment: String?
    }
    
    output {
      success: { alert: Alert }
      errors {
        ALERT_NOT_FOUND { }
        ALREADY_ACKNOWLEDGED { }
      }
    }
  }
  
  behavior SilenceAlert {
    input {
      rule_id: UUID
      until: Timestamp
      reason: String
      created_by: String
    }
    
    output {
      success: { }
    }
  }
  
  # ============================================
  # HEALTH CHECKS
  # ============================================
  
  entity HealthCheck {
    name: String [unique]
    description: String?
    
    # Check configuration
    type: HealthCheckType
    endpoint: String?
    timeout: Duration = 5.seconds
    interval: Duration = 30.seconds
    
    # State
    status: HealthStatus
    last_check_at: Timestamp?
    last_success_at: Timestamp?
    last_failure_at: Timestamp?
    
    # Thresholds
    unhealthy_threshold: Int = 3
    healthy_threshold: Int = 2
    
    consecutive_failures: Int = 0
    consecutive_successes: Int = 0
    
    lifecycle {
      UNKNOWN -> HEALTHY [on: check_success]
      UNKNOWN -> UNHEALTHY [on: threshold_failures]
      HEALTHY -> UNHEALTHY [on: threshold_failures]
      UNHEALTHY -> HEALTHY [on: threshold_successes]
    }
  }
  
  enum HealthCheckType {
    HTTP
    TCP
    GRPC
    COMMAND
    CUSTOM
  }
  
  enum HealthStatus {
    UNKNOWN
    HEALTHY
    DEGRADED
    UNHEALTHY
  }
  
  behavior CheckHealth {
    input {
      checks: List<String>?  # null = all checks
    }
    
    output {
      success: {
        status: HealthStatus
        checks: Map<String, {
          status: HealthStatus
          message: String?
          duration_ms: Float
        }>
      }
    }
  }
  
  # ============================================
  # SLO (Service Level Objectives)
  # ============================================
  
  entity SLO {
    id: UUID [unique]
    name: String
    description: String?
    
    # Indicator
    sli: {
      type: SLIType
      query: String
      good_query: String?
      total_query: String?
    }
    
    # Objective
    target: Float [min: 0, max: 100]  # percentage
    window: Duration
    
    # Current state
    current_value: Float?
    error_budget_remaining: Float?
    
    # Burn rate alerts
    burn_rate_alerts: List<{
      window: Duration
      threshold: Float
      severity: AlertSeverity
    }>?
  }
  
  enum SLIType {
    AVAILABILITY
    LATENCY
    ERROR_RATE
    THROUGHPUT
    CUSTOM
  }
  
  behavior CalculateSLO {
    input {
      slo_id: UUID
      window: Duration?
    }
    
    output {
      success: {
        value: Float
        target: Float
        error_budget_total: Float
        error_budget_remaining: Float
        error_budget_consumed_percent: Float
        burn_rate: Float
      }
    }
  }
}
