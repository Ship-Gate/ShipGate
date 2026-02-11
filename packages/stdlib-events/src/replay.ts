// ============================================================================
// Replay — replay events through an aggregate or projection
// ============================================================================

import type { EventEnvelope, Snapshot } from './types.js';
import type { Aggregate } from './sourcing/aggregate.js';
import type { Projection } from './sourcing/projection.js';
import type { EventStore } from './sourcing/store.js';

/**
 * Replay events from a store into an aggregate, optionally starting from a snapshot.
 */
export async function replayAggregate<TState>(
  store: EventStore,
  aggregate: Aggregate<TState>,
  snapshot?: Snapshot<TState>,
): Promise<void> {
  const fromVersion = snapshot ? snapshot.version : 0;

  if (snapshot) {
    aggregate.rehydrate([], snapshot);
  }

  const events: EventEnvelope[] = [];
  for await (const event of store.read(aggregate.streamId, fromVersion)) {
    events.push(event);
  }

  aggregate.rehydrate(events);
}

/**
 * Replay all events from a store into a projection.
 */
export async function replayProjection<TState>(
  store: EventStore,
  projection: Projection<TState>,
  fromPosition = 0,
): Promise<void> {
  for await (const event of store.readAll(fromPosition)) {
    await projection.process(event);
  }
}

/**
 * Collect all events from an AsyncIterable into an array.
 * Useful for testing or small streams.
 */
export async function collectEvents(
  iterable: AsyncIterable<EventEnvelope>,
): Promise<EventEnvelope[]> {
  const result: EventEnvelope[] = [];
  for await (const event of iterable) {
    result.push(event);
  }
  return result;
}
