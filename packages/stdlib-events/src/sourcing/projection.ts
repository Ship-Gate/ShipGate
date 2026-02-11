// ============================================================================
// Projection builder — fold events into a read model
// ============================================================================

import type { EventEnvelope } from '../types.js';

/**
 * A handler that folds one event type into the projection state.
 */
export type ProjectionHandler<TState> = (
  state: TState,
  event: EventEnvelope,
) => TState | Promise<TState>;

export interface Projection<TState> {
  readonly name: string;
  readonly state: TState;
  readonly position: number;

  process(event: EventEnvelope): Promise<void>;
  reset(): void;
}

export interface ProjectionDefinition<TState> {
  readonly name: string;
  readonly initialState: TState;
  readonly handlers: ReadonlyMap<string, ProjectionHandler<TState>>;
}

/**
 * Fluent builder for projections.
 *
 * ```ts
 * const totals = createProjection<{ count: number }>('order-totals', { count: 0 })
 *   .on('OrderPlaced', (s) => ({ count: s.count + 1 }))
 *   .on('OrderCancelled', (s) => ({ count: s.count - 1 }))
 *   .build();
 * ```
 */
export class ProjectionBuilder<TState> {
  private _handlers = new Map<string, ProjectionHandler<TState>>();

  constructor(
    private readonly _name: string,
    private readonly _initialState: TState,
  ) {}

  on(eventType: string, handler: ProjectionHandler<TState>): this {
    this._handlers.set(eventType, handler);
    return this;
  }

  build(): Projection<TState> {
    return new InMemoryProjection<TState>({
      name: this._name,
      initialState: this._initialState,
      handlers: new Map(this._handlers),
    });
  }
}

export function createProjection<TState>(
  name: string,
  initialState: TState,
): ProjectionBuilder<TState> {
  return new ProjectionBuilder(name, initialState);
}

// ============================================================================
// In-memory projection
// ============================================================================

class InMemoryProjection<TState> implements Projection<TState> {
  private _state: TState;
  private _position = 0;
  private readonly _initialState: TState;
  private readonly _handlers: ReadonlyMap<string, ProjectionHandler<TState>>;

  readonly name: string;

  constructor(def: ProjectionDefinition<TState>) {
    this.name = def.name;
    this._initialState = def.initialState;
    this._state = def.initialState;
    this._handlers = def.handlers;
  }

  get state(): TState {
    return this._state;
  }

  get position(): number {
    return this._position;
  }

  async process(event: EventEnvelope): Promise<void> {
    const handler = this._handlers.get(event.type);
    if (handler) {
      this._state = await handler(this._state, event);
    }
    this._position = event.position;
  }

  reset(): void {
    this._state = this._initialState;
    this._position = 0;
  }
}
