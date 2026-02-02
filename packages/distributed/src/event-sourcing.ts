/**
 * ISL Event Sourcing Implementation
 * 
 * Event-driven state management with full audit trail
 */

import type {
  DomainEvent,
  EventMetadata,
  Aggregate,
  EventStore,
  Projection,
} from './types';

/**
 * In-memory event store for development/testing
 */
export class InMemoryEventStore implements EventStore {
  private events: DomainEvent[] = [];
  private subscribers: ((event: DomainEvent) => Promise<void>)[] = [];
  private position = 0;

  async append(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.events.push(event);
      this.position++;

      // Notify subscribers
      for (const subscriber of this.subscribers) {
        await subscriber(event);
      }
    }
  }

  async getEvents(aggregateId: string, fromVersion = 0): Promise<DomainEvent[]> {
    return this.events.filter(
      e => e.aggregateId === aggregateId && e.metadata.version >= fromVersion
    );
  }

  async getAllEvents(fromPosition = 0): Promise<DomainEvent[]> {
    return this.events.slice(fromPosition);
  }

  subscribe(handler: (event: DomainEvent) => Promise<void>): () => void {
    this.subscribers.push(handler);
    return () => {
      const index = this.subscribers.indexOf(handler);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  // For testing
  clear(): void {
    this.events = [];
    this.position = 0;
  }
}

/**
 * Aggregate repository for loading and saving aggregates
 */
export class AggregateRepository<TState, TEvent extends DomainEvent> {
  constructor(
    private eventStore: EventStore,
    private aggregateType: string,
    private initialState: TState,
    private applyEvent: (state: TState, event: TEvent) => TState
  ) {}

  /**
   * Load an aggregate by ID
   */
  async load(id: string): Promise<Aggregate<TState>> {
    const events = await this.eventStore.getEvents(id);

    let state = this.initialState;
    let version = 0;

    for (const event of events) {
      state = this.applyEvent(state, event as TEvent);
      version = event.metadata.version;
    }

    return {
      id,
      type: this.aggregateType,
      version,
      state,
    };
  }

  /**
   * Save events for an aggregate
   */
  async save(aggregateId: string, events: TEvent[], expectedVersion: number): Promise<void> {
    // Check for concurrent modification
    const existingEvents = await this.eventStore.getEvents(aggregateId);
    const currentVersion = existingEvents.length > 0
      ? existingEvents[existingEvents.length - 1]!.metadata.version
      : 0;

    if (currentVersion !== expectedVersion) {
      throw new ConcurrentModificationError(aggregateId, expectedVersion, currentVersion);
    }

    // Assign version numbers
    const eventsWithVersion = events.map((event, index) => ({
      ...event,
      metadata: {
        ...event.metadata,
        version: expectedVersion + index + 1,
      },
    }));

    await this.eventStore.append(eventsWithVersion);
  }
}

/**
 * Concurrent modification error
 */
export class ConcurrentModificationError extends Error {
  constructor(
    public aggregateId: string,
    public expectedVersion: number,
    public actualVersion: number
  ) {
    super(
      `Concurrent modification detected for aggregate ${aggregateId}. ` +
      `Expected version ${expectedVersion}, but found ${actualVersion}`
    );
    this.name = 'ConcurrentModificationError';
  }
}

/**
 * Create a domain event
 */
export function createEvent<TPayload>(
  type: string,
  aggregateId: string,
  aggregateType: string,
  payload: TPayload,
  metadata?: Partial<EventMetadata>
): DomainEvent<TPayload> {
  return {
    type,
    aggregateId,
    aggregateType,
    payload,
    metadata: {
      eventId: metadata?.eventId ?? crypto.randomUUID(),
      version: metadata?.version ?? 0,
      timestamp: metadata?.timestamp ?? Date.now(),
      correlationId: metadata?.correlationId,
      causationId: metadata?.causationId,
      userId: metadata?.userId,
    },
  };
}

/**
 * Projection runner
 */
export class ProjectionRunner<TState> {
  private state: TState;
  private position = 0;

  constructor(
    private projection: Projection<TState>,
    private eventStore: EventStore
  ) {
    this.state = projection.initialState;
  }

  /**
   * Run the projection from the beginning
   */
  async rebuild(): Promise<void> {
    this.state = this.projection.initialState;
    this.position = 0;

    const events = await this.eventStore.getAllEvents();
    for (const event of events) {
      this.applyEvent(event);
    }
  }

  /**
   * Subscribe to new events
   */
  subscribe(): () => void {
    return this.eventStore.subscribe(async (event) => {
      this.applyEvent(event);
    });
  }

  /**
   * Apply an event to the projection
   */
  private applyEvent(event: DomainEvent<unknown>): void {
    const handler = this.projection.handlers[event.type];
    if (handler) {
      this.state = handler(this.state, event);
    }
    this.position++;
  }

  /**
   * Get current state
   */
  getState(): TState {
    return this.state;
  }

  /**
   * Get current position
   */
  getPosition(): number {
    return this.position;
  }
}

/**
 * Create a projection
 */
export function projection<TState>(
  name: string,
  initialState: TState,
  handlers: Projection<TState>['handlers']
): Projection<TState> {
  return {
    name,
    initialState,
    handlers,
  };
}

/**
 * Generate ISL specification for event
 */
export function eventToISL(type: string, aggregateType: string, payloadType: string): string {
  return `
event ${type} {
  aggregate: ${aggregateType};
  payload: ${payloadType};
  
  // Event is immutable once created
  immutable;
  
  // Event ordering within aggregate
  ordered_by version;
}
`.trim();
}

/**
 * Generate ISL specification for aggregate
 */
export function aggregateToISL(
  type: string,
  stateType: string,
  events: string[]
): string {
  return `
aggregate ${type} {
  state: ${stateType};
  
  events {
    ${events.map(e => `${e};`).join('\n    ')}
  }
  
  invariants {
    // Add aggregate invariants
  }
}
`.trim();
}

/**
 * Snapshot store for performance optimization
 */
export class SnapshotStore<TState> {
  private snapshots = new Map<string, { state: TState; version: number }>();

  async save(aggregateId: string, state: TState, version: number): Promise<void> {
    this.snapshots.set(aggregateId, { state, version });
  }

  async load(aggregateId: string): Promise<{ state: TState; version: number } | null> {
    return this.snapshots.get(aggregateId) ?? null;
  }

  async delete(aggregateId: string): Promise<void> {
    this.snapshots.delete(aggregateId);
  }
}

/**
 * Aggregate repository with snapshot support
 */
export class SnapshottingAggregateRepository<TState, TEvent extends DomainEvent> {
  constructor(
    private eventStore: EventStore,
    private snapshotStore: SnapshotStore<TState>,
    private aggregateType: string,
    private initialState: TState,
    private applyEvent: (state: TState, event: TEvent) => TState,
    private snapshotFrequency: number = 100
  ) {}

  async load(id: string): Promise<Aggregate<TState>> {
    // Try to load from snapshot
    const snapshot = await this.snapshotStore.load(id);
    
    let state = snapshot?.state ?? this.initialState;
    let version = snapshot?.version ?? 0;

    // Load events since snapshot
    const events = await this.eventStore.getEvents(id, version + 1);

    for (const event of events) {
      state = this.applyEvent(state, event as TEvent);
      version = event.metadata.version;
    }

    // Create snapshot if needed
    if (events.length >= this.snapshotFrequency) {
      await this.snapshotStore.save(id, state, version);
    }

    return {
      id,
      type: this.aggregateType,
      version,
      state,
    };
  }

  async save(aggregateId: string, events: TEvent[], expectedVersion: number): Promise<void> {
    const existingEvents = await this.eventStore.getEvents(aggregateId);
    const currentVersion = existingEvents.length > 0
      ? existingEvents[existingEvents.length - 1]!.metadata.version
      : 0;

    if (currentVersion !== expectedVersion) {
      throw new ConcurrentModificationError(aggregateId, expectedVersion, currentVersion);
    }

    const eventsWithVersion = events.map((event, index) => ({
      ...event,
      metadata: {
        ...event.metadata,
        version: expectedVersion + index + 1,
      },
    }));

    await this.eventStore.append(eventsWithVersion);
  }
}
