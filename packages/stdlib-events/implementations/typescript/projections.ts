// ============================================================================
// Projections (Read Models)
// ============================================================================

import {
  ProjectionStatus,
  BackoffStrategy,
} from './types.js';
import type {
  ProjectionError,
  RetryPolicy,
} from './types.js';
import type { DomainEvent } from './events.js';

/**
 * Projection configuration
 */
export interface ProjectionConfig {
  name: string;
  description?: string;
  sourceStreams?: string[];
  eventTypes: string[];
  retryPolicy?: RetryPolicy;
}

/**
 * Projection state
 */
export interface ProjectionState {
  name: string;
  status: ProjectionStatus;
  position: number;
  lastProcessedAt?: Date;
  error?: ProjectionError;
}

/**
 * Projection event handler
 */
export type ProjectionHandler<TState, TData = Record<string, unknown>> = (
  state: TState,
  event: DomainEvent<TData>
) => TState | Promise<TState>;

/**
 * Projection interface
 */
export interface IProjection<TState> {
  readonly name: string;
  readonly status: ProjectionStatus;
  readonly position: number;
  readonly state: TState;

  start(): Promise<void>;
  stop(): Promise<void>;
  reset(): Promise<void>;
}

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  delayMs: 1000,
  backoff: BackoffStrategy.EXPONENTIAL,
};

/**
 * Calculate delay based on retry policy
 */
export function calculateRetryDelay(policy: RetryPolicy, retryCount: number): number {
  switch (policy.backoff) {
    case BackoffStrategy.FIXED:
      return policy.delayMs;
    case BackoffStrategy.LINEAR:
      return policy.delayMs * (retryCount + 1);
    case BackoffStrategy.EXPONENTIAL:
      return policy.delayMs * Math.pow(2, retryCount);
    default:
      return policy.delayMs;
  }
}

/**
 * In-memory projection implementation
 */
export class InMemoryProjection<TState> implements IProjection<TState> {
  private _status: ProjectionStatus = ProjectionStatus.STOPPED;
  private _position = 0;
  private _state: TState;
  private _error?: ProjectionError;

  constructor(
    public readonly name: string,
    private readonly initialState: TState,
    private readonly handlers: Map<string, ProjectionHandler<TState>>,
    private readonly config?: Partial<ProjectionConfig>
  ) {
    this._state = initialState;
  }

  get status(): ProjectionStatus {
    return this._status;
  }

  get position(): number {
    return this._position;
  }

  get state(): TState {
    return this._state;
  }

  get error(): ProjectionError | undefined {
    return this._error;
  }

  async start(): Promise<void> {
    if (this._status === ProjectionStatus.RUNNING || this._status === ProjectionStatus.LIVE) {
      return;
    }

    this._status = ProjectionStatus.RUNNING;
    this._error = undefined;
  }

  async stop(): Promise<void> {
    this._status = ProjectionStatus.STOPPED;
  }

  async reset(): Promise<void> {
    this._state = this.initialState;
    this._position = 0;
    this._error = undefined;
    this._status = ProjectionStatus.STOPPED;
  }

  /**
   * Process an event
   */
  async process(event: DomainEvent): Promise<void> {
    if (this._status !== ProjectionStatus.RUNNING && this._status !== ProjectionStatus.LIVE) {
      return;
    }

    const handler = this.handlers.get(event.eventType);
    if (!handler) {
      // Skip events we don't handle
      this._position = event.version;
      return;
    }

    const retryPolicy = this.config?.retryPolicy ?? DEFAULT_RETRY_POLICY;
    let retryCount = 0;

    while (retryCount <= retryPolicy.maxRetries) {
      try {
        this._state = await handler(this._state, event);
        this._position = event.version;
        this._error = undefined;
        return;
      } catch (err) {
        retryCount++;

        if (retryCount > retryPolicy.maxRetries) {
          this._status = ProjectionStatus.FAULTED;
          this._error = {
            message: err instanceof Error ? err.message : String(err),
            eventId: event.id,
            timestamp: new Date(),
            retryCount,
          };
          throw err;
        }

        const delay = calculateRetryDelay(retryPolicy, retryCount);
        await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
      }
    }
  }
}

/**
 * Create a projection builder
 */
export function createProjection<TState>(
  name: string,
  initialState: TState
): ProjectionBuilder<TState> {
  return new ProjectionBuilder(name, initialState);
}

/**
 * Builder for creating projections
 */
export class ProjectionBuilder<TState> {
  private handlers = new Map<string, ProjectionHandler<TState>>();
  private config: Partial<ProjectionConfig> = {};

  constructor(
    private readonly name: string,
    private readonly initialState: TState
  ) {}

  /**
   * Add an event handler
   */
  on<TData = Record<string, unknown>>(
    eventType: string,
    handler: ProjectionHandler<TState, TData>
  ): this {
    this.handlers.set(eventType, handler as ProjectionHandler<TState>);
    return this;
  }

  /**
   * Set retry policy
   */
  withRetryPolicy(policy: RetryPolicy): this {
    this.config.retryPolicy = policy;
    return this;
  }

  /**
   * Build the projection
   */
  build(): InMemoryProjection<TState> {
    return new InMemoryProjection(
      this.name,
      this.initialState,
      this.handlers,
      this.config
    );
  }
}
