// ============================================================================
// Event Store
// ============================================================================

import type {
  EventId,
  StreamId,
  EventVersion,
  EventFilter,
  Snapshot,
} from './types.js';
import type { DomainEvent } from './events.js';

/**
 * Result of appending events to a stream
 */
export interface AppendResult {
  streamId: StreamId;
  newVersion: EventVersion;
  eventIds: EventId[];
}

/**
 * Error codes for event store operations
 */
export enum EventStoreErrorCode {
  CONCURRENCY_CONFLICT = 'CONCURRENCY_CONFLICT',
  STREAM_NOT_FOUND = 'STREAM_NOT_FOUND',
  STREAM_DELETED = 'STREAM_DELETED',
  INVALID_EVENT = 'INVALID_EVENT',
}

/**
 * Event store error
 */
export class EventStoreError extends Error {
  constructor(
    public readonly code: EventStoreErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'EventStoreError';
  }
}

/**
 * Options for reading events
 */
export interface ReadOptions {
  fromVersion?: EventVersion;
  toVersion?: EventVersion;
  maxCount?: number;
}

/**
 * Result of reading events
 */
export interface ReadResult<TData = Record<string, unknown>> {
  events: DomainEvent<TData>[];
  streamVersion: EventVersion;
  isEndOfStream: boolean;
}

/**
 * Options for reading all events
 */
export interface ReadAllOptions {
  fromPosition?: number;
  maxCount?: number;
  filter?: EventFilter;
}

/**
 * Result of reading all events
 */
export interface ReadAllResult<TData = Record<string, unknown>> {
  events: DomainEvent<TData>[];
  nextPosition: number;
  isEnd: boolean;
}

/**
 * Subscription handler
 */
export type EventHandler<TData = Record<string, unknown>> = (
  event: DomainEvent<TData>
) => void | Promise<void>;

/**
 * Subscription options
 */
export interface SubscribeOptions {
  streamId?: StreamId;
  fromVersion?: EventVersion;
  filter?: EventFilter;
}

/**
 * Subscription interface
 */
export interface Subscription {
  unsubscribe(): void;
}

/**
 * Event store interface
 */
export interface IEventStore {
  /**
   * Append events to a stream
   */
  append(
    streamId: StreamId,
    events: DomainEvent[],
    expectedVersion?: EventVersion
  ): Promise<AppendResult>;

  /**
   * Read events from a stream
   */
  read(streamId: StreamId, options?: ReadOptions): Promise<ReadResult>;

  /**
   * Read events from all streams
   */
  readAll(options?: ReadAllOptions): Promise<ReadAllResult>;

  /**
   * Subscribe to events
   */
  subscribe(handler: EventHandler, options?: SubscribeOptions): Subscription;

  /**
   * Get a snapshot for a stream
   */
  getSnapshot<TState>(streamId: StreamId): Promise<Snapshot<TState> | null>;

  /**
   * Save a snapshot for a stream
   */
  saveSnapshot<TState>(streamId: StreamId, snapshot: Snapshot<TState>): Promise<void>;
}

/**
 * In-memory event store implementation for testing
 */
export class InMemoryEventStore implements IEventStore {
  private streams = new Map<StreamId, DomainEvent[]>();
  private allEvents: DomainEvent[] = [];
  private snapshots = new Map<StreamId, Snapshot>();
  private subscribers = new Set<{
    handler: EventHandler;
    options?: SubscribeOptions;
  }>();

  async append(
    streamId: StreamId,
    events: DomainEvent[],
    expectedVersion?: EventVersion
  ): Promise<AppendResult> {
    const stream = this.streams.get(streamId) ?? [];
    const currentVersion = stream.length;

    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      throw new EventStoreError(
        EventStoreErrorCode.CONCURRENCY_CONFLICT,
        `Expected version ${expectedVersion}, but current version is ${currentVersion}`,
        { expected: expectedVersion, actual: currentVersion }
      );
    }

    const versionedEvents = events.map((event, index) => ({
      ...event,
      version: currentVersion + index + 1,
    }));

    stream.push(...versionedEvents);
    this.streams.set(streamId, stream);
    this.allEvents.push(...versionedEvents);

    // Notify subscribers
    for (const { handler, options } of this.subscribers) {
      if (options?.streamId && options.streamId !== streamId) {
        continue;
      }

      for (const event of versionedEvents) {
        if (this.matchesFilter(event, options?.filter)) {
          await handler(event);
        }
      }
    }

    return {
      streamId,
      newVersion: currentVersion + events.length,
      eventIds: versionedEvents.map((e) => e.id),
    };
  }

  async read(streamId: StreamId, options?: ReadOptions): Promise<ReadResult> {
    const stream = this.streams.get(streamId);

    if (!stream) {
      throw new EventStoreError(
        EventStoreErrorCode.STREAM_NOT_FOUND,
        `Stream ${streamId} not found`
      );
    }

    const fromVersion = options?.fromVersion ?? 0;
    const toVersion = options?.toVersion ?? stream.length;
    const maxCount = options?.maxCount ?? 1000;

    const events = stream
      .filter((e) => e.version > fromVersion && e.version <= toVersion)
      .slice(0, maxCount);

    return {
      events,
      streamVersion: stream.length,
      isEndOfStream: events.length < maxCount || toVersion >= stream.length,
    };
  }

  async readAll(options?: ReadAllOptions): Promise<ReadAllResult> {
    const fromPosition = options?.fromPosition ?? 0;
    const maxCount = options?.maxCount ?? 1000;

    let events = this.allEvents.slice(fromPosition, fromPosition + maxCount);

    if (options?.filter) {
      events = events.filter((e) => this.matchesFilter(e, options.filter));
    }

    return {
      events,
      nextPosition: fromPosition + events.length,
      isEnd: fromPosition + maxCount >= this.allEvents.length,
    };
  }

  subscribe(handler: EventHandler, options?: SubscribeOptions): Subscription {
    const subscriber = { handler, options };
    this.subscribers.add(subscriber);

    return {
      unsubscribe: () => {
        this.subscribers.delete(subscriber);
      },
    };
  }

  async getSnapshot<TState>(streamId: StreamId): Promise<Snapshot<TState> | null> {
    return (this.snapshots.get(streamId) as Snapshot<TState>) ?? null;
  }

  async saveSnapshot<TState>(streamId: StreamId, snapshot: Snapshot<TState>): Promise<void> {
    this.snapshots.set(streamId, snapshot as Snapshot);
  }

  private matchesFilter(event: DomainEvent, filter?: EventFilter): boolean {
    if (!filter) {
      return true;
    }

    if (filter.eventTypes && !filter.eventTypes.includes(event.eventType)) {
      return false;
    }

    if (filter.correlationId && event.correlationId !== filter.correlationId) {
      return false;
    }

    if (filter.since && event.timestamp < filter.since) {
      return false;
    }

    if (filter.until && event.timestamp > filter.until) {
      return false;
    }

    return true;
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.streams.clear();
    this.allEvents = [];
    this.snapshots.clear();
  }
}
