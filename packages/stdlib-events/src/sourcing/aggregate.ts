// ============================================================================
// Aggregate base — apply events, rehydrate from events/snapshot
// ============================================================================

import type { EventEnvelope, EventVersion, Snapshot, StreamId } from '../types.js';

/**
 * Handler that folds a single event into the aggregate state.
 */
export type ApplyFn<TState, TEvent extends EventEnvelope = EventEnvelope> = (
  state: TState,
  event: TEvent,
) => TState;

/**
 * Abstract aggregate root.
 *
 * Subclass or use `createAggregate()` to define a concrete aggregate.
 */
export abstract class AggregateRoot<TState> {
  private _state: TState;
  private _version: EventVersion = 0;
  private _uncommitted: EventEnvelope[] = [];

  constructor(
    public readonly streamId: StreamId,
    initialState: TState,
  ) {
    this._state = initialState;
  }

  get state(): TState {
    return this._state;
  }

  get version(): EventVersion {
    return this._version;
  }

  get uncommittedEvents(): ReadonlyArray<EventEnvelope> {
    return this._uncommitted;
  }

  /**
   * Override to define how each event type mutates state.
   */
  protected abstract applyEvent(state: TState, event: EventEnvelope): TState;

  /**
   * Apply a new event (records it as uncommitted).
   */
  apply(event: EventEnvelope): void {
    this._state = this.applyEvent(this._state, event);
    this._version = event.version;
    this._uncommitted.push(event);
  }

  /**
   * Rehydrate from a stream of persisted events (or from a snapshot + events).
   */
  rehydrate(events: Iterable<EventEnvelope>, snapshot?: Snapshot<TState>): void {
    if (snapshot) {
      this._state = snapshot.state;
      this._version = snapshot.version;
    }

    for (const event of events) {
      this._state = this.applyEvent(this._state, event);
      this._version = event.version;
    }
  }

  /**
   * Mark all uncommitted events as committed.
   */
  clearUncommitted(): void {
    this._uncommitted = [];
  }

  /**
   * Create a snapshot of the current state.
   */
  toSnapshot(): Snapshot<TState> {
    return {
      streamId: this.streamId,
      version: this._version,
      state: this._state,
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// Functional aggregate helper (no subclassing needed)
// ============================================================================

export interface AggregateDefinition<TState> {
  readonly streamId: StreamId;
  readonly initialState: TState;
  readonly apply: ApplyFn<TState>;
}

export interface Aggregate<TState> {
  readonly streamId: StreamId;
  readonly state: TState;
  readonly version: EventVersion;
  readonly uncommittedEvents: ReadonlyArray<EventEnvelope>;

  apply(event: EventEnvelope): void;
  rehydrate(events: Iterable<EventEnvelope>, snapshot?: Snapshot<TState>): void;
  clearUncommitted(): void;
  toSnapshot(): Snapshot<TState>;
}

/**
 * Create an aggregate without subclassing.
 *
 * ```ts
 * const agg = createAggregate({
 *   streamId: 'account-123',
 *   initialState: { balance: 0 },
 *   apply: (state, event) => {
 *     if (event.type === 'Deposited') return { balance: state.balance + (event.data as any).amount };
 *     return state;
 *   },
 * });
 * ```
 */
export function createAggregate<TState>(
  def: AggregateDefinition<TState>,
): Aggregate<TState> {
  let state = def.initialState;
  let version: EventVersion = 0;
  let uncommitted: EventEnvelope[] = [];

  return {
    get streamId() {
      return def.streamId;
    },
    get state() {
      return state;
    },
    get version() {
      return version;
    },
    get uncommittedEvents() {
      return uncommitted as ReadonlyArray<EventEnvelope>;
    },

    apply(event: EventEnvelope): void {
      state = def.apply(state, event);
      version = event.version;
      uncommitted.push(event);
    },

    rehydrate(
      events: Iterable<EventEnvelope>,
      snapshot?: Snapshot<TState>,
    ): void {
      if (snapshot) {
        state = snapshot.state;
        version = snapshot.version;
      }
      for (const event of events) {
        state = def.apply(state, event);
        version = event.version;
      }
    },

    clearUncommitted(): void {
      uncommitted = [];
    },

    toSnapshot(): Snapshot<TState> {
      return {
        streamId: def.streamId,
        version,
        state,
        timestamp: new Date(),
      };
    },
  };
}
