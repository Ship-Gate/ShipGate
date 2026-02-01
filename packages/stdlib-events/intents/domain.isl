# Event Sourcing & CQRS Standard Library
# Event-driven architecture patterns

domain Events {
  version: "1.0.0"
  description: "Event sourcing, CQRS, and domain events"
  
  imports {
    core from "@intentos/stdlib-core"
  }
  
  # ============================================
  # Core Event Types
  # ============================================
  
  type EventId = UUID
  type StreamId = String
  type EventVersion = Int [min: 0]
  type CorrelationId = UUID
  type CausationId = UUID
  
  # ============================================
  # Base Event
  # ============================================
  
  abstract entity DomainEvent {
    id: EventId [immutable, unique, auto_generated]
    stream_id: StreamId [immutable]
    version: EventVersion [immutable]
    
    # Event metadata
    event_type: String [immutable]
    timestamp: Timestamp [immutable, auto_generated]
    
    # Tracing
    correlation_id: CorrelationId?
    causation_id: CausationId?
    
    # Actor
    actor: {
      id: String
      type: ActorType
      metadata: Map<String, String>?
    }?
    
    # Payload
    data: Map<String, Any>
    metadata: Map<String, Any>?
    
    invariants {
      version >= 0
      event_type.is_valid_identifier
    }
  }
  
  enum ActorType {
    USER
    SYSTEM
    SERVICE
    ANONYMOUS
  }
  
  # ============================================
  # Event Stream
  # ============================================
  
  entity EventStream {
    id: StreamId [immutable, unique]
    aggregate_type: String
    aggregate_id: UUID
    
    version: EventVersion
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    # Stream metadata
    metadata: Map<String, Any>?
    
    # Snapshot
    snapshot: Snapshot?
    snapshot_frequency: Int = 100
    
    invariants {
      version >= 0
      snapshot == null or snapshot.version <= version
    }
    
    derived {
      events_since_snapshot: Int = version - (snapshot?.version ?? 0)
      needs_snapshot: Boolean = events_since_snapshot >= snapshot_frequency
    }
  }
  
  type Snapshot = {
    version: EventVersion
    state: Any
    timestamp: Timestamp
  }
  
  # ============================================
  # Aggregate Root
  # ============================================
  
  abstract entity AggregateRoot {
    id: UUID [immutable, unique]
    version: EventVersion
    
    # Uncommitted changes
    pending_events: List<DomainEvent> [transient]
    
    behavior apply(event: DomainEvent) {
      postconditions {
        version == old(version) + 1
        pending_events.contains(event)
      }
    }
    
    behavior commit() {
      postconditions {
        pending_events.is_empty
        events persisted to stream
      }
    }
    
    behavior load(events: List<DomainEvent>) {
      postconditions {
        version == events.length
        state reflects all events
      }
    }
  }
  
  # ============================================
  # Event Store
  # ============================================
  
  entity EventStore {
    name: String
    
    behavior append {
      input {
        stream_id: StreamId
        events: List<DomainEvent> [min_length: 1]
        expected_version: EventVersion?
      }
      
      output {
        success: {
          stream_id: StreamId
          new_version: EventVersion
          event_ids: List<EventId>
        }
        errors {
          CONCURRENCY_CONFLICT {
            when: "Stream version doesn't match expected"
            fields {
              expected: EventVersion
              actual: EventVersion
            }
          }
          STREAM_DELETED {
            when: "Stream has been deleted"
          }
        }
      }
      
      preconditions {
        expected_version == null or 
        stream.version == expected_version
      }
      
      postconditions {
        success implies {
          stream.version == old(stream.version) + events.length
          events.all(e => EventStore.contains(e.id))
        }
      }
      
      effects {
        persists events
        emits EventsAppended
        may_create_snapshot
      }
    }
    
    behavior read {
      input {
        stream_id: StreamId
        from_version: EventVersion? = 0
        to_version: EventVersion?
        max_count: Int? = 1000
      }
      
      output {
        success: {
          events: List<DomainEvent>
          stream_version: EventVersion
          is_end_of_stream: Boolean
        }
        errors {
          STREAM_NOT_FOUND { }
        }
      }
    }
    
    behavior read_all {
      description: "Read events across all streams"
      
      input {
        from_position: Int? = 0
        max_count: Int? = 1000
        filter: EventFilter?
      }
      
      output {
        success: {
          events: List<DomainEvent>
          next_position: Int
          is_end: Boolean
        }
      }
    }
    
    behavior subscribe {
      description: "Subscribe to events in real-time"
      
      input {
        stream_id: StreamId?  # null = all streams
        from_version: EventVersion?
        filter: EventFilter?
      }
      
      output {
        success: Stream<DomainEvent>
      }
    }
  }
  
  type EventFilter = {
    event_types: List<String>?
    aggregate_types: List<String>?
    correlation_id: CorrelationId?
    since: Timestamp?
    until: Timestamp?
  }
  
  # ============================================
  # Projections (Read Models)
  # ============================================
  
  entity Projection {
    name: String [unique]
    description: String?
    
    # Source
    source_streams: List<String>?  # null = all streams
    event_types: List<String>
    
    # State
    status: ProjectionStatus
    position: Int
    last_processed_at: Timestamp?
    
    # Error handling
    error: ProjectionError?
    retry_policy: RetryPolicy?
    
    lifecycle {
      STOPPED -> RUNNING [on: start]
      RUNNING -> STOPPED [on: stop]
      RUNNING -> FAULTED [on: error]
      FAULTED -> RUNNING [on: retry]
    }
  }
  
  enum ProjectionStatus {
    STOPPED
    RUNNING
    CATCHING_UP
    LIVE
    FAULTED
  }
  
  type ProjectionError = {
    message: String
    event_id: EventId?
    timestamp: Timestamp
    retry_count: Int
  }
  
  type RetryPolicy = {
    max_retries: Int
    delay: Duration
    backoff: BackoffStrategy
  }
  
  enum BackoffStrategy {
    FIXED
    LINEAR
    EXPONENTIAL
  }
  
  # ============================================
  # CQRS Command
  # ============================================
  
  abstract entity Command {
    id: UUID [immutable, unique, auto_generated]
    aggregate_id: UUID
    
    timestamp: Timestamp [auto_generated]
    correlation_id: CorrelationId?
    
    actor: {
      id: String
      type: ActorType
    }
    
    # Execution metadata
    idempotency_key: String?
    expected_version: EventVersion?
  }
  
  behavior ExecuteCommand<TCommand, TAggregate> {
    input {
      command: TCommand
    }
    
    output {
      success: {
        aggregate_id: UUID
        new_version: EventVersion
        events: List<DomainEvent>
      }
      errors {
        VALIDATION_ERROR {
          fields { errors: List<String> }
        }
        AGGREGATE_NOT_FOUND { }
        CONCURRENCY_CONFLICT {
          fields { 
            expected: EventVersion
            actual: EventVersion 
          }
        }
        BUSINESS_RULE_VIOLATION {
          fields { rule: String, message: String }
        }
      }
    }
    
    effects {
      loads TAggregate from event store
      validates command
      executes command on aggregate
      appends new events
    }
  }
  
  # ============================================
  # Saga / Process Manager
  # ============================================
  
  abstract entity ProcessManager {
    id: UUID [unique]
    name: String
    
    status: ProcessStatus
    current_step: String?
    
    # Correlation
    correlation_id: CorrelationId
    
    # State
    state: Map<String, Any>
    
    # History
    handled_events: List<EventId>
    dispatched_commands: List<UUID>
    
    # Timeout
    timeout_at: Timestamp?
    
    lifecycle {
      STARTED -> IN_PROGRESS -> COMPLETED
      IN_PROGRESS -> FAILED
      IN_PROGRESS -> TIMED_OUT
      FAILED -> COMPENSATING -> COMPENSATED
    }
  }
  
  enum ProcessStatus {
    STARTED
    IN_PROGRESS
    COMPLETED
    FAILED
    TIMED_OUT
    COMPENSATING
    COMPENSATED
  }
  
  # ============================================
  # Integration Events
  # ============================================
  
  entity IntegrationEvent extends DomainEvent {
    # Target systems
    destination: String?
    
    # Delivery
    delivery_status: DeliveryStatus
    delivery_attempts: Int = 0
    last_attempt_at: Timestamp?
    delivered_at: Timestamp?
    
    # Ordering
    partition_key: String?
    
    lifecycle {
      PENDING -> DELIVERING -> DELIVERED
      DELIVERING -> FAILED -> DELIVERING  # retry
      FAILED -> DEAD_LETTERED
    }
  }
  
  enum DeliveryStatus {
    PENDING
    DELIVERING
    DELIVERED
    FAILED
    DEAD_LETTERED
  }
  
  # ============================================
  # Outbox Pattern
  # ============================================
  
  entity OutboxMessage {
    id: UUID [unique]
    
    aggregate_type: String
    aggregate_id: UUID
    event_type: String
    payload: Any
    
    created_at: Timestamp
    processed_at: Timestamp?
    
    status: OutboxStatus
    retry_count: Int = 0
    error: String?
    
    lifecycle {
      PENDING -> PROCESSING -> PROCESSED
      PROCESSING -> FAILED -> PROCESSING
      FAILED -> DEAD_LETTERED
    }
  }
  
  enum OutboxStatus {
    PENDING
    PROCESSING
    PROCESSED
    FAILED
    DEAD_LETTERED
  }
}
