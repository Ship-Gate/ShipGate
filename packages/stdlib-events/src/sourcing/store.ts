// ============================================================================
// EventStore — in-memory, concurrency-safe, AsyncIterable reads
// ============================================================================

import type {
  EventEnvelope,
  EventVersion,
  GlobalPosition,
  Result,
  Snapshot,
  StreamId,
} from '../types.js';
import { err, ok } from '../types.js';
import { EventErrorCode, EventError, concurrencyConflict } from '../errors.js';

// ============================================================================
// Public interfaces
// ============================================================================

export interface AppendResult {
  readonly streamId: StreamId;
  readonly newVersion: EventVersion;
  readonly positions: GlobalPosition[];
}

export interface EventStore {
  append(
    streamId: StreamId,
    events: ReadonlyArray<NewEvent>,
    expectedVersion?: EventVersion,
  ): Result<AppendResult, EventError>;

  read(
    streamId: StreamId,
    fromVersion?: EventVersion,
  ): AsyncIterable<EventEnvelope>;

  readAll(fromPosition?: GlobalPosition): AsyncIterable<EventEnvelope>;

  getSnapshot<TState>(streamId: StreamId): Snapshot<TState> | undefined;

  saveSnapshot<TState>(snapshot: Snapshot<TState>): void;
}

export interface NewEvent {
  readonly type: string;
  readonly data: unknown;
  readonly metadata?: Record<string, unknown>;
  readonly correlationId?: string;
  readonly causationId?: string;
}

// ============================================================================
// In-memory implementation
// ============================================================================

interface StreamState {
  version: EventVersion;
  events: EventEnvelope[];
}

export class InMemoryEventStore implements EventStore {
  private _streams = new Map<StreamId, StreamState>();
  private _allEvents: EventEnvelope[] = [];
  private _snapshots = new Map<StreamId, Snapshot>();
  private _globalPosition: GlobalPosition = 0;

  // --- append (synchronous, concurrency-safe) ---
  append(
    streamId: StreamId,
    events: ReadonlyArray<NewEvent>,
    expectedVersion?: EventVersion,
  ): Result<AppendResult, EventError> {
    if (events.length === 0) {
      return err(
        new EventError(EventErrorCode.INVALID_EVENT, 'No events to append'),
      );
    }

    let stream = this._streams.get(streamId);
    if (!stream) {
      stream = { version: 0, events: [] };
      this._streams.set(streamId, stream);
    }

    if (expectedVersion !== undefined && stream.version !== expectedVersion) {
      return err(concurrencyConflict(streamId, expectedVersion, stream.version));
    }

    const positions: GlobalPosition[] = [];
    const envelopes: EventEnvelope[] = [];

    for (const evt of events) {
      stream.version += 1;
      this._globalPosition += 1;

      const envelope: EventEnvelope = {
        eventId: crypto.randomUUID(),
        streamId,
        version: stream.version,
        position: this._globalPosition,
        type: evt.type,
        timestamp: new Date(),
        data: evt.data,
        correlationId: evt.correlationId,
        causationId: evt.causationId,
        metadata: evt.metadata,
      };

      stream.events.push(envelope);
      this._allEvents.push(envelope);
      envelopes.push(envelope);
      positions.push(this._globalPosition);
    }

    return ok({
      streamId,
      newVersion: stream.version,
      positions,
    });
  }

  // --- read (AsyncIterable over a single stream) ---
  async *read(
    streamId: StreamId,
    fromVersion: EventVersion = 0,
  ): AsyncIterable<EventEnvelope> {
    const stream = this._streams.get(streamId);
    if (!stream) {
      return; // empty iterable for non-existent stream
    }

    for (const evt of stream.events) {
      if (evt.version > fromVersion) {
        yield evt;
      }
    }
  }

  // --- readAll (AsyncIterable across all streams) ---
  async *readAll(
    fromPosition: GlobalPosition = 0,
  ): AsyncIterable<EventEnvelope> {
    for (const evt of this._allEvents) {
      if (evt.position > fromPosition) {
        yield evt;
      }
    }
  }

  // --- snapshots ---
  getSnapshot<TState>(streamId: StreamId): Snapshot<TState> | undefined {
    return this._snapshots.get(streamId) as Snapshot<TState> | undefined;
  }

  saveSnapshot<TState>(snapshot: Snapshot<TState>): void {
    this._snapshots.set(snapshot.streamId, snapshot as Snapshot);
  }

  // --- helpers for testing ---
  streamVersion(streamId: StreamId): EventVersion {
    return this._streams.get(streamId)?.version ?? 0;
  }

  get globalPosition(): GlobalPosition {
    return this._globalPosition;
  }

  clear(): void {
    this._streams.clear();
    this._allEvents = [];
    this._snapshots.clear();
    this._globalPosition = 0;
  }
}
