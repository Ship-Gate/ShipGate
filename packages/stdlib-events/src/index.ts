/**
 * @packageDocumentation
 * @isl-lang/stdlib-events
 *
 * Strongly-typed event system: EventBus, EventEmitter, EventStore (in-memory),
 * aggregate rehydration, replay/snapshots, projections, and middleware.
 */

// Core types
export type {
  EventId,
  StreamId,
  EventVersion,
  GlobalPosition,
  CorrelationId,
  CausationId,
  EventEnvelope,
  EventMap,
  EventFilter,
  Snapshot,
  Result,
  Ok,
  Err,
  Actor,
} from './types.js';
export { ok, err, ActorType } from './types.js';

// Errors
export { EventError, EventErrorCode, concurrencyConflict, streamNotFound } from './errors.js';

// Emitter
export { EventEmitter } from './emitter.js';
export type { Handler, SyncHandler, AsyncHandler, Unsubscribe } from './emitter.js';

// Middleware
export type { Middleware, MiddlewareContext, NextFn } from './middleware.js';
export { composeMiddleware } from './middleware.js';

// Bus
export type { EventBus } from './bus.js';
export { createEventBus } from './bus.js';

// Event Store
export type { EventStore, AppendResult, NewEvent } from './sourcing/store.js';
export { InMemoryEventStore } from './sourcing/store.js';

// Aggregate
export type { Aggregate, AggregateDefinition, ApplyFn } from './sourcing/aggregate.js';
export { AggregateRoot, createAggregate } from './sourcing/aggregate.js';

// Projection
export type { Projection, ProjectionHandler, ProjectionDefinition } from './sourcing/projection.js';
export { ProjectionBuilder, createProjection } from './sourcing/projection.js';

// Snapshot
export { createSnapshot, shouldSnapshot } from './sourcing/snapshot.js';

// Replay
export { replayAggregate, replayProjection, collectEvents } from './replay.js';
