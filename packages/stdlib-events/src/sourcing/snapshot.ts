// ============================================================================
// Snapshot helpers
// ============================================================================

import type { EventVersion, Snapshot, StreamId } from '../types.js';

/**
 * Create a snapshot value.
 */
export function createSnapshot<TState>(
  streamId: StreamId,
  version: EventVersion,
  state: TState,
): Snapshot<TState> {
  return {
    streamId,
    version,
    state,
    timestamp: new Date(),
  };
}

/**
 * Determine whether a new snapshot should be taken.
 *
 * @param currentVersion  Current aggregate version
 * @param snapshotVersion Version at last snapshot (0 if none)
 * @param interval        How many events between snapshots (default 100)
 */
export function shouldSnapshot(
  currentVersion: EventVersion,
  snapshotVersion: EventVersion,
  interval = 100,
): boolean {
  return currentVersion - snapshotVersion >= interval;
}
