// ============================================================================
// Domain Events
// ============================================================================

import type {
  EventId,
  StreamId,
  EventVersion,
  CorrelationId,
  CausationId,
  Actor,
} from './types.js';

/**
 * Base interface for all domain events
 */
export interface DomainEvent<TData = Record<string, unknown>> {
  /** Unique event identifier */
  readonly id: EventId;

  /** Stream this event belongs to */
  readonly streamId: StreamId;

  /** Version within the stream */
  readonly version: EventVersion;

  /** Event type identifier */
  readonly eventType: string;

  /** When the event occurred */
  readonly timestamp: Date;

  /** Correlation ID for tracing */
  readonly correlationId?: CorrelationId;

  /** ID of the event that caused this one */
  readonly causationId?: CausationId;

  /** Actor who triggered the event */
  readonly actor?: Actor;

  /** Event payload */
  readonly data: TData;

  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Create a new domain event
 */
export function createDomainEvent<TData = Record<string, unknown>>(
  params: Omit<DomainEvent<TData>, 'id' | 'timestamp'> & {
    id?: EventId;
    timestamp?: Date;
  }
): DomainEvent<TData> {
  return {
    id: params.id ?? globalThis.crypto.randomUUID(),
    streamId: params.streamId,
    version: params.version,
    eventType: params.eventType,
    timestamp: params.timestamp ?? new Date(),
    correlationId: params.correlationId,
    causationId: params.causationId,
    actor: params.actor,
    data: params.data,
    metadata: params.metadata,
  };
}

/**
 * Event stream information
 */
export interface EventStream {
  id: StreamId;
  aggregateType: string;
  aggregateId: string;
  version: EventVersion;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new event stream
 */
export function createEventStream(
  params: Omit<EventStream, 'createdAt' | 'updatedAt' | 'version'>
): EventStream {
  const now = new Date();
  return {
    id: params.id,
    aggregateType: params.aggregateType,
    aggregateId: params.aggregateId,
    version: 0,
    createdAt: now,
    updatedAt: now,
    metadata: params.metadata,
  };
}

/**
 * Check if an object is a valid domain event
 */
export function isDomainEvent(value: unknown): value is DomainEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const event = value as Record<string, unknown>;
  return (
    typeof event.id === 'string' &&
    typeof event.streamId === 'string' &&
    typeof event.version === 'number' &&
    typeof event.eventType === 'string' &&
    event.timestamp instanceof Date &&
    typeof event.data === 'object'
  );
}

/**
 * Generate a stream ID from aggregate type and ID
 */
export function generateStreamId(aggregateType: string, aggregateId: string): StreamId {
  return `${aggregateType}-${aggregateId}`;
}

/**
 * Parse a stream ID into aggregate type and ID
 */
export function parseStreamId(streamId: StreamId): { aggregateType: string; aggregateId: string } | null {
  const separatorIndex = streamId.indexOf('-');
  if (separatorIndex === -1) {
    return null;
  }

  return {
    aggregateType: streamId.slice(0, separatorIndex),
    aggregateId: streamId.slice(separatorIndex + 1),
  };
}
