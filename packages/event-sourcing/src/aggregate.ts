/**
 * Aggregate
 *
 * Base class for event-sourced aggregates.
 */

import { EventStore, StoredEvent, EventMetadata } from './event-store.js';

export interface AggregateOptions {
  /** Event store instance */
  eventStore: EventStore;
  /** Aggregate type name */
  aggregateType: string;
}

export interface AggregateRoot<TState = Record<string, unknown>> {
  /** Aggregate ID */
  id: string;
  /** Aggregate type */
  type: string;
  /** Current version */
  version: number;
  /** Current state */
  state: TState;
  /** Uncommitted events */
  uncommittedEvents: DomainEvent[];
}

export interface DomainEvent<T = unknown> {
  type: string;
  payload: T;
}

type EventApplier<TState, TPayload> = (state: TState, payload: TPayload) => TState;

export class Aggregate<TState = Record<string, unknown>> {
  private eventStore: EventStore;
  private aggregateType: string;
  private appliers: Map<string, EventApplier<TState, unknown>>;
  private initialState: TState;

  protected root: AggregateRoot<TState>;

  constructor(
    id: string,
    options: AggregateOptions,
    initialState: TState
  ) {
    this.eventStore = options.eventStore;
    this.aggregateType = options.aggregateType;
    this.appliers = new Map();
    this.initialState = initialState;

    this.root = {
      id,
      type: this.aggregateType,
      version: 0,
      state: { ...initialState },
      uncommittedEvents: [],
    };
  }

  /**
   * Register an event applier
   */
  registerApplier<TPayload>(
    eventType: string,
    applier: EventApplier<TState, TPayload>
  ): void {
    this.appliers.set(eventType, applier as EventApplier<TState, unknown>);
  }

  /**
   * Load aggregate from event store
   */
  async load(): Promise<void> {
    const events = await this.eventStore.getEvents(this.root.id);

    for (const event of events) {
      this.applyEvent(event.type, event.payload);
      this.root.version = event.version;
    }
  }

  /**
   * Apply a new event
   */
  protected apply<TPayload>(event: DomainEvent<TPayload>): void {
    this.applyEvent(event.type, event.payload);
    this.root.uncommittedEvents.push(event);
  }

  /**
   * Apply event to state
   */
  private applyEvent(type: string, payload: unknown): void {
    const applier = this.appliers.get(type);
    if (applier) {
      this.root.state = applier(this.root.state, payload);
    }
  }

  /**
   * Save uncommitted events to store
   */
  async save(metadata?: EventMetadata): Promise<void> {
    if (this.root.uncommittedEvents.length === 0) {
      return;
    }

    const events = await this.eventStore.append(
      this.aggregateType,
      this.root.id,
      this.root.uncommittedEvents,
      metadata
    );

    // Update version
    this.root.version = events[events.length - 1].version;

    // Clear uncommitted events
    this.root.uncommittedEvents = [];
  }

  /**
   * Get current state
   */
  getState(): TState {
    return { ...this.root.state };
  }

  /**
   * Get aggregate ID
   */
  getId(): string {
    return this.root.id;
  }

  /**
   * Get current version
   */
  getVersion(): number {
    return this.root.version;
  }

  /**
   * Get uncommitted events
   */
  getUncommittedEvents(): DomainEvent[] {
    return [...this.root.uncommittedEvents];
  }

  /**
   * Check if there are uncommitted events
   */
  hasUncommittedEvents(): boolean {
    return this.root.uncommittedEvents.length > 0;
  }

  /**
   * Clear uncommitted events without saving
   */
  clearUncommittedEvents(): void {
    this.root.uncommittedEvents = [];
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.root.state = { ...this.initialState };
    this.root.version = 0;
    this.root.uncommittedEvents = [];
  }
}

/**
 * Create an aggregate factory
 */
export function createAggregateFactory<TState>(
  aggregateType: string,
  eventStore: EventStore,
  initialState: TState,
  setup: (aggregate: Aggregate<TState>) => void
): (id: string) => Aggregate<TState> {
  return (id: string) => {
    const aggregate = new Aggregate<TState>(
      id,
      { eventStore, aggregateType },
      initialState
    );
    setup(aggregate);
    return aggregate;
  };
}
