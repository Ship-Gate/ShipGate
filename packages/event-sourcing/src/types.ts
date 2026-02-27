/**
 * Event sourcing type definitions
 */

/**
 * Domain event - the fundamental unit of change
 */
export interface DomainEvent<T = unknown> {
  /** Unique event ID */
  id: string;
  /** Event type (e.g., "OrderPlaced", "PaymentReceived") */
  type: string;
  /** Aggregate ID this event belongs to */
  aggregateId: string;
  /** Aggregate type */
  aggregateType: string;
  /** Event payload */
  data: T;
  /** Event metadata */
  metadata: EventMetadata;
  /** Sequence number within the aggregate */
  sequence: number;
  /** Global sequence number in the event store */
  globalSequence: number;
  /** Event timestamp */
  timestamp: number;
  /** Event version for schema evolution */
  version: number;
}

/**
 * Event metadata
 */
export interface EventMetadata {
  /** Correlation ID for tracing */
  correlationId: string;
  /** Causation ID - what caused this event */
  causationId?: string;
  /** User/actor who caused the event */
  userId?: string;
  /** Tenant ID for multi-tenancy */
  tenantId?: string;
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Event envelope for transport
 */
export interface EventEnvelope<T = unknown> {
  event: DomainEvent<T>;
  headers: Record<string, string>;
  timestamp: number;
}

/**
 * Command - request to change state
 */
export interface Command<T = unknown> {
  /** Command type */
  type: string;
  /** Target aggregate ID */
  aggregateId: string;
  /** Command payload */
  data: T;
  /** Command metadata */
  metadata: CommandMetadata;
  /** Timestamp */
  timestamp: number;
}

/**
 * Command metadata
 */
export interface CommandMetadata {
  /** Correlation ID */
  correlationId: string;
  /** User ID */
  userId?: string;
  /** Expected version for optimistic concurrency */
  expectedVersion?: number;
  /** Idempotency key */
  idempotencyKey?: string;
}

/**
 * Command result
 */
export interface CommandResult {
  success: boolean;
  events: DomainEvent[];
  error?: CommandError;
}

/**
 * Command error
 */
export interface CommandError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Aggregate state
 */
export interface AggregateState {
  id: string;
  type: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Snapshot for aggregate state
 */
export interface Snapshot<T extends AggregateState = AggregateState> {
  aggregateId: string;
  aggregateType: string;
  state: T;
  version: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Event stream
 */
export interface EventStream {
  aggregateId: string;
  aggregateType: string;
  events: DomainEvent[];
  version: number;
}

/**
 * Stream position
 */
export interface StreamPosition {
  /** Global position in the event store */
  global: number;
  /** Position within a specific stream */
  stream?: number;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Start position */
  fromPosition?: StreamPosition;
  /** Filter by event types */
  eventTypes?: string[];
  /** Filter by aggregate types */
  aggregateTypes?: string[];
  /** Batch size for reading */
  batchSize?: number;
  /** Max retry attempts */
  maxRetries?: number;
}

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void> | void;

/**
 * Event store configuration
 */
export interface EventStoreConfig {
  /** Storage backend */
  storage: 'memory' | 'postgres' | 'dynamodb' | 'eventstore';
  /** Connection string/config */
  connection?: string | Record<string, unknown>;
  /** Enable snapshotting */
  snapshotting: boolean;
  /** Snapshot interval (events) */
  snapshotInterval: number;
  /** Enable event versioning */
  versioning: boolean;
  /** Enable encryption */
  encryption: boolean;
}

/**
 * Query for reading events
 */
export interface EventQuery {
  /** Aggregate ID */
  aggregateId?: string;
  /** Aggregate type */
  aggregateType?: string;
  /** Event types */
  eventTypes?: string[];
  /** From timestamp */
  fromTimestamp?: number;
  /** To timestamp */
  toTimestamp?: number;
  /** From sequence */
  fromSequence?: number;
  /** To sequence */
  toSequence?: number;
  /** Limit */
  limit?: number;
  /** Offset */
  offset?: number;
}
