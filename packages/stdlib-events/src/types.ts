// ============================================================================
// Core Event Types for stdlib-events
// ============================================================================

/** Unique identifier for an event */
export type EventId = string;

/** Identifier for an event stream */
export type StreamId = string;

/** Version number for events in a stream (0 = no events yet) */
export type EventVersion = number;

/** Correlation ID for tracing related events */
export type CorrelationId = string;

/** Causation ID linking events to their cause */
export type CausationId = string;

/** Global position in the all-events log */
export type GlobalPosition = number;

/** Actor type enumeration */
export enum ActorType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  SERVICE = 'SERVICE',
  ANONYMOUS = 'ANONYMOUS',
}

/** Actor information */
export interface Actor {
  readonly id: string;
  readonly type: ActorType;
  readonly metadata?: Record<string, string>;
}

// ============================================================================
// Result type (compatible with stdlib-core patterns)
// ============================================================================

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// ============================================================================
// Event Envelope — wraps any event with store metadata
// ============================================================================

export interface EventEnvelope<TData = unknown> {
  /** Unique event identifier */
  readonly eventId: EventId;
  /** Stream this event belongs to */
  readonly streamId: StreamId;
  /** Version within the stream (1-based) */
  readonly version: EventVersion;
  /** Global position across all streams */
  readonly position: GlobalPosition;
  /** Event type discriminator */
  readonly type: string;
  /** When the event was recorded */
  readonly timestamp: Date;
  /** Event payload */
  readonly data: TData;
  /** Tracing metadata */
  readonly correlationId?: CorrelationId;
  readonly causationId?: CausationId;
  readonly actor?: Actor;
  readonly metadata?: Record<string, unknown>;
}

// ============================================================================
// Event map — used to strongly type bus and handlers
// ============================================================================

/**
 * An event map is a record from event-type string to its payload type.
 * Example:
 *   type MyEvents = {
 *     UserCreated: { name: string; email: string };
 *     UserDeleted: { userId: string };
 *   };
 */
export type EventMap = Record<string, unknown>;

// ============================================================================
// Snapshot
// ============================================================================

export interface Snapshot<TState = unknown> {
  readonly streamId: StreamId;
  readonly version: EventVersion;
  readonly state: TState;
  readonly timestamp: Date;
}

// ============================================================================
// Event filter for queries
// ============================================================================

export interface EventFilter {
  readonly eventTypes?: string[];
  readonly streamIds?: string[];
  readonly correlationId?: CorrelationId;
  readonly since?: Date;
  readonly until?: Date;
}
