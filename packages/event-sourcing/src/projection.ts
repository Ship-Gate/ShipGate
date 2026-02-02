/**
 * Projection
 *
 * Build read models from event streams.
 */

import { EventStore, StoredEvent } from './event-store.js';

export interface ProjectionOptions {
  /** Event store instance */
  eventStore: EventStore;
  /** Projection name */
  name: string;
  /** Event types to handle */
  eventTypes?: string[];
  /** Start from position */
  startPosition?: number;
}

export interface ProjectionState {
  /** Projection name */
  name: string;
  /** Current position in event stream */
  position: number;
  /** Last processed timestamp */
  lastProcessed: string | null;
  /** Read model state */
  state: unknown;
}

type ProjectionHandler<TState, TPayload> = (
  state: TState,
  event: StoredEvent<TPayload>
) => TState;

export class Projection<TState = Record<string, unknown>> {
  private eventStore: EventStore;
  private options: Required<ProjectionOptions>;
  private handlers: Map<string, ProjectionHandler<TState, unknown>>;
  private state: TState;
  private position: number;
  private lastProcessed: string | null;
  private unsubscribe: (() => void) | null;
  private running: boolean;

  constructor(
    initialState: TState,
    options: ProjectionOptions
  ) {
    this.eventStore = options.eventStore;
    this.options = {
      eventStore: options.eventStore,
      name: options.name,
      eventTypes: options.eventTypes ?? [],
      startPosition: options.startPosition ?? 0,
    };

    this.handlers = new Map();
    this.state = initialState;
    this.position = options.startPosition ?? 0;
    this.lastProcessed = null;
    this.unsubscribe = null;
    this.running = false;
  }

  /**
   * Register an event handler
   */
  when<TPayload>(
    eventType: string,
    handler: ProjectionHandler<TState, TPayload>
  ): this {
    this.handlers.set(eventType, handler as ProjectionHandler<TState, unknown>);
    return this;
  }

  /**
   * Start the projection
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Catch up with existing events
    await this.catchUp();

    // Subscribe to new events
    if (this.options.eventTypes.length > 0) {
      for (const eventType of this.options.eventTypes) {
        this.eventStore.subscribe(eventType, this.handleEvent.bind(this));
      }
    } else {
      this.unsubscribe = this.eventStore.subscribeAll(this.handleEvent.bind(this));
    }
  }

  /**
   * Stop the projection
   */
  stop(): void {
    this.running = false;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Catch up with historical events
   */
  async catchUp(): Promise<number> {
    let events = await this.eventStore.getAllEvents(this.position);

    // Filter by event types if specified
    if (this.options.eventTypes.length > 0) {
      events = events.filter((e) => this.options.eventTypes.includes(e.type));
    }

    for (const event of events) {
      await this.handleEvent(event);
    }

    return events.length;
  }

  /**
   * Handle a single event
   */
  private async handleEvent(event: StoredEvent): Promise<void> {
    const handler = this.handlers.get(event.type);

    if (handler) {
      try {
        this.state = handler(this.state, event);
        this.lastProcessed = event.timestamp;
      } catch (error) {
        console.error(
          `Error in projection ${this.options.name} handling ${event.type}:`,
          error
        );
      }
    }

    this.position = (await this.eventStore.getAllEvents()).length;
  }

  /**
   * Get current state
   */
  getState(): TState {
    return this.state;
  }

  /**
   * Get projection status
   */
  getStatus(): ProjectionState {
    return {
      name: this.options.name,
      position: this.position,
      lastProcessed: this.lastProcessed,
      state: this.state,
    };
  }

  /**
   * Reset projection to initial state
   */
  reset(initialState: TState): void {
    this.state = initialState;
    this.position = 0;
    this.lastProcessed = null;
  }

  /**
   * Rebuild projection from scratch
   */
  async rebuild(initialState: TState): Promise<number> {
    this.reset(initialState);
    return this.catchUp();
  }
}

/**
 * Create a projection builder
 */
export function createProjection<TState>(
  name: string,
  eventStore: EventStore,
  initialState: TState
): Projection<TState> {
  return new Projection<TState>(initialState, { eventStore, name });
}

/**
 * Common projection patterns
 */
export const ProjectionPatterns = {
  /**
   * Count events by type
   */
  countByType<TState extends Record<string, number>>(
    _eventType: string
  ): ProjectionHandler<TState, unknown> {
    return (state, event) => ({
      ...state,
      [event.type]: (state[event.type] ?? 0) + 1,
    });
  },

  /**
   * Collect items in a list
   */
  collectItems<TState extends { items: unknown[] }, TPayload>(
    extractor: (payload: TPayload) => unknown
  ): ProjectionHandler<TState, TPayload> {
    return (state, event) => ({
      ...state,
      items: [...state.items, extractor(event.payload)],
    });
  },

  /**
   * Upsert item by ID
   */
  upsertById<TState extends { items: Record<string, unknown> }, TPayload extends { id: string }>(
    extractor: (payload: TPayload) => unknown
  ): ProjectionHandler<TState, TPayload> {
    return (state, event) => ({
      ...state,
      items: {
        ...state.items,
        [event.payload.id]: extractor(event.payload),
      },
    });
  },

  /**
   * Remove item by ID
   */
  removeById<TState extends { items: Record<string, unknown> }, TPayload extends { id: string }>(): ProjectionHandler<TState, TPayload> {
    return (state, event) => {
      const { [event.payload.id]: removed, ...remaining } = state.items;
      return { ...state, items: remaining };
    };
  },

  /**
   * Sum a numeric field
   */
  sumField<TState extends Record<string, number>, TPayload>(
    field: string,
    extractor: (payload: TPayload) => number
  ): ProjectionHandler<TState, TPayload> {
    return (state, event) => ({
      ...state,
      [field]: (state[field] ?? 0) + extractor(event.payload),
    });
  },
};
