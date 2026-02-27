// ============================================================================
// Core Event Types
// ============================================================================

/** Unique identifier for an event */
export type EventId = string;

/** Identifier for an event stream */
export type StreamId = string;

/** Version number for events in a stream */
export type EventVersion = number;

/** Correlation ID for tracing related events */
export type CorrelationId = string;

/** Causation ID linking events to their cause */
export type CausationId = string;

/** Actor type enumeration */
export enum ActorType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  SERVICE = 'SERVICE',
  ANONYMOUS = 'ANONYMOUS',
}

/** Actor information */
export interface Actor {
  id: string;
  type: ActorType;
  metadata?: Record<string, string>;
}

/** Projection status enumeration */
export enum ProjectionStatus {
  STOPPED = 'STOPPED',
  RUNNING = 'RUNNING',
  CATCHING_UP = 'CATCHING_UP',
  LIVE = 'LIVE',
  FAULTED = 'FAULTED',
}

/** Process manager status enumeration */
export enum ProcessStatus {
  STARTED = 'STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  TIMED_OUT = 'TIMED_OUT',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
}

/** Delivery status for integration events */
export enum DeliveryStatus {
  PENDING = 'PENDING',
  DELIVERING = 'DELIVERING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  DEAD_LETTERED = 'DEAD_LETTERED',
}

/** Outbox message status */
export enum OutboxStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  DEAD_LETTERED = 'DEAD_LETTERED',
}

/** Backoff strategy for retries */
export enum BackoffStrategy {
  FIXED = 'FIXED',
  LINEAR = 'LINEAR',
  EXPONENTIAL = 'EXPONENTIAL',
}

/** Retry policy configuration */
export interface RetryPolicy {
  maxRetries: number;
  delayMs: number;
  backoff: BackoffStrategy;
}

/** Event filter for queries */
export interface EventFilter {
  eventTypes?: string[];
  aggregateTypes?: string[];
  correlationId?: CorrelationId;
  since?: Date;
  until?: Date;
}

/** Snapshot of aggregate state */
export interface Snapshot<TState = unknown> {
  version: EventVersion;
  state: TState;
  timestamp: Date;
}

/** Projection error information */
export interface ProjectionError {
  message: string;
  eventId?: EventId;
  timestamp: Date;
  retryCount: number;
}
