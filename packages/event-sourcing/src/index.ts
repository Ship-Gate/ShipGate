/**
 * ISL Event Sourcing
 *
 * Generate event sourcing infrastructure from ISL specifications.
 * Supports CQRS pattern, event stores, projections, and snapshots.
 */

export { EventStore, type EventStoreOptions, type StoredEvent } from './event-store.js';
export { Aggregate, type AggregateOptions, type AggregateRoot } from './aggregate.js';
export { Projection, type ProjectionOptions, type ProjectionState } from './projection.js';
export { EventBus, type EventBusOptions, type EventHandler } from './event-bus.js';
export { EventGenerator, type EventGeneratorOptions } from './generator.js';
export { SnapshotStore, type SnapshotOptions } from './snapshot.js';
export { CommandBus, type Command, type CommandHandler } from './command-bus.js';
