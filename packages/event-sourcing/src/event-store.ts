/**
 * Event Store
 *
 * Persistent storage for domain events.
 */

import { v4 as uuidv4 } from 'uuid';

export interface StoredEvent<T = unknown> {
  /** Event ID */
  id: string;
  /** Event type */
  type: string;
  /** Aggregate ID */
  aggregateId: string;
  /** Aggregate type */
  aggregateType: string;
  /** Event version (sequence number) */
  version: number;
  /** Event payload */
  payload: T;
  /** Event metadata */
  metadata: EventMetadata;
  /** Timestamp */
  timestamp: string;
}

export interface EventMetadata {
  /** User who triggered the event */
  userId?: string;
  /** Correlation ID for tracking */
  correlationId?: string;
  /** Causation ID (event that caused this event) */
  causationId?: string;
  /** Custom metadata */
  [key: string]: unknown;
}

export interface EventStoreOptions {
  /** Storage adapter */
  adapter?: EventStoreAdapter;
  /** Enable snapshots */
  snapshotEnabled?: boolean;
  /** Snapshot frequency (every N events) */
  snapshotFrequency?: number;
}

export interface EventStoreAdapter {
  /** Append events to stream */
  append(events: StoredEvent[]): Promise<void>;
  /** Get events for aggregate */
  getEvents(aggregateId: string, fromVersion?: number): Promise<StoredEvent[]>;
  /** Get all events of a type */
  getEventsByType(eventType: string, fromTimestamp?: string): Promise<StoredEvent[]>;
  /** Get all events */
  getAllEvents(fromPosition?: number): Promise<StoredEvent[]>;
  /** Get current version for aggregate */
  getVersion(aggregateId: string): Promise<number>;
}

/**
 * In-memory event store adapter for development/testing
 */
export class InMemoryEventStoreAdapter implements EventStoreAdapter {
  private events: StoredEvent[] = [];
  private aggregateVersions: Map<string, number> = new Map();

  async append(events: StoredEvent[]): Promise<void> {
    for (const event of events) {
      this.events.push(event);
      this.aggregateVersions.set(event.aggregateId, event.version);
    }
  }

  async getEvents(aggregateId: string, fromVersion: number = 0): Promise<StoredEvent[]> {
    return this.events.filter(
      (e) => e.aggregateId === aggregateId && e.version > fromVersion
    );
  }

  async getEventsByType(eventType: string, fromTimestamp?: string): Promise<StoredEvent[]> {
    let events = this.events.filter((e) => e.type === eventType);
    if (fromTimestamp) {
      events = events.filter((e) => e.timestamp > fromTimestamp);
    }
    return events;
  }

  async getAllEvents(fromPosition: number = 0): Promise<StoredEvent[]> {
    return this.events.slice(fromPosition);
  }

  async getVersion(aggregateId: string): Promise<number> {
    return this.aggregateVersions.get(aggregateId) ?? 0;
  }

  /** Clear all events (for testing) */
  clear(): void {
    this.events = [];
    this.aggregateVersions.clear();
  }

  /** Get total event count */
  count(): number {
    return this.events.length;
  }
}

export class EventStore {
  private adapter: EventStoreAdapter;
  private options: Required<EventStoreOptions>;
  private eventHandlers: Map<string, Array<(event: StoredEvent) => Promise<void>>>;

  constructor(options: EventStoreOptions = {}) {
    this.options = {
      adapter: options.adapter ?? new InMemoryEventStoreAdapter(),
      snapshotEnabled: options.snapshotEnabled ?? true,
      snapshotFrequency: options.snapshotFrequency ?? 100,
    };

    this.adapter = this.options.adapter;
    this.eventHandlers = new Map();
  }

  /**
   * Append events to the store
   */
  async append<T>(
    aggregateType: string,
    aggregateId: string,
    events: Array<{ type: string; payload: T }>,
    metadata: EventMetadata = {}
  ): Promise<StoredEvent<T>[]> {
    const currentVersion = await this.adapter.getVersion(aggregateId);
    const correlationId = metadata.correlationId ?? uuidv4();

    const storedEvents: StoredEvent<T>[] = events.map((event, index) => ({
      id: uuidv4(),
      type: event.type,
      aggregateId,
      aggregateType,
      version: currentVersion + index + 1,
      payload: event.payload,
      metadata: {
        ...metadata,
        correlationId,
      },
      timestamp: new Date().toISOString(),
    }));

    await this.adapter.append(storedEvents);

    // Notify handlers
    for (const event of storedEvents) {
      await this.notifyHandlers(event);
    }

    return storedEvents;
  }

  /**
   * Get events for an aggregate
   */
  async getEvents(aggregateId: string, fromVersion?: number): Promise<StoredEvent[]> {
    return this.adapter.getEvents(aggregateId, fromVersion);
  }

  /**
   * Get events by type
   */
  async getEventsByType(eventType: string, fromTimestamp?: string): Promise<StoredEvent[]> {
    return this.adapter.getEventsByType(eventType, fromTimestamp);
  }

  /**
   * Get all events
   */
  async getAllEvents(fromPosition?: number): Promise<StoredEvent[]> {
    return this.adapter.getAllEvents(fromPosition);
  }

  /**
   * Get current version for aggregate
   */
  async getVersion(aggregateId: string): Promise<number> {
    return this.adapter.getVersion(aggregateId);
  }

  /**
   * Subscribe to events
   */
  subscribe(eventType: string, handler: (event: StoredEvent) => Promise<void>): () => void {
    const handlers = this.eventHandlers.get(eventType) ?? [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);

    return () => {
      const current = this.eventHandlers.get(eventType) ?? [];
      const index = current.indexOf(handler);
      if (index >= 0) {
        current.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: (event: StoredEvent) => Promise<void>): () => void {
    return this.subscribe('*', handler);
  }

  private async notifyHandlers(event: StoredEvent): Promise<void> {
    // Notify type-specific handlers
    const typeHandlers = this.eventHandlers.get(event.type) ?? [];
    for (const handler of typeHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    }

    // Notify wildcard handlers
    const allHandlers = this.eventHandlers.get('*') ?? [];
    for (const handler of allHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Error in wildcard event handler:`, error);
      }
    }
  }

  /**
   * Replay events to a handler
   */
  async replay(
    handler: (event: StoredEvent) => Promise<void>,
    options?: { fromPosition?: number; types?: string[] }
  ): Promise<number> {
    let events = await this.adapter.getAllEvents(options?.fromPosition);

    if (options?.types) {
      events = events.filter((e) => options.types!.includes(e.type));
    }

    for (const event of events) {
      await handler(event);
    }

    return events.length;
  }
}

/**
 * Create an event store instance
 */
export function createEventStore(options?: EventStoreOptions): EventStore {
  return new EventStore(options);
}
