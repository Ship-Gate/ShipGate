/**
 * Snapshot Store
 *
 * Store and retrieve aggregate snapshots for performance optimization.
 */

export interface Snapshot<TState = unknown> {
  /** Aggregate ID */
  aggregateId: string;
  /** Aggregate type */
  aggregateType: string;
  /** Snapshot version (event version at time of snapshot) */
  version: number;
  /** State at snapshot */
  state: TState;
  /** Timestamp */
  timestamp: string;
}

export interface SnapshotOptions {
  /** Storage adapter */
  adapter?: SnapshotAdapter;
  /** Snapshot frequency (every N events) */
  frequency?: number;
  /** Maximum snapshots to keep per aggregate */
  maxSnapshots?: number;
}

export interface SnapshotAdapter {
  /** Save snapshot */
  save(snapshot: Snapshot): Promise<void>;
  /** Get latest snapshot */
  getLatest(aggregateId: string): Promise<Snapshot | null>;
  /** Get snapshot at version */
  getAtVersion(aggregateId: string, version: number): Promise<Snapshot | null>;
  /** Delete old snapshots */
  cleanup(aggregateId: string, keepCount: number): Promise<number>;
}

/**
 * In-memory snapshot adapter
 */
export class InMemorySnapshotAdapter implements SnapshotAdapter {
  private snapshots: Map<string, Snapshot[]> = new Map();

  async save(snapshot: Snapshot): Promise<void> {
    const existing = this.snapshots.get(snapshot.aggregateId) ?? [];
    existing.push(snapshot);
    // Sort by version descending
    existing.sort((a, b) => b.version - a.version);
    this.snapshots.set(snapshot.aggregateId, existing);
  }

  async getLatest(aggregateId: string): Promise<Snapshot | null> {
    const snapshots = this.snapshots.get(aggregateId);
    return snapshots?.[0] ?? null;
  }

  async getAtVersion(aggregateId: string, version: number): Promise<Snapshot | null> {
    const snapshots = this.snapshots.get(aggregateId);
    if (!snapshots) return null;

    // Find closest snapshot at or before version
    return snapshots.find((s) => s.version <= version) ?? null;
  }

  async cleanup(aggregateId: string, keepCount: number): Promise<number> {
    const snapshots = this.snapshots.get(aggregateId);
    if (!snapshots || snapshots.length <= keepCount) return 0;

    const toRemove = snapshots.length - keepCount;
    this.snapshots.set(aggregateId, snapshots.slice(0, keepCount));
    return toRemove;
  }

  /** Clear all snapshots */
  clear(): void {
    this.snapshots.clear();
  }
}

export class SnapshotStore {
  private adapter: SnapshotAdapter;
  private options: Required<SnapshotOptions>;

  constructor(options: SnapshotOptions = {}) {
    this.options = {
      adapter: options.adapter ?? new InMemorySnapshotAdapter(),
      frequency: options.frequency ?? 100,
      maxSnapshots: options.maxSnapshots ?? 5,
    };
    this.adapter = this.options.adapter;
  }

  /**
   * Save a snapshot
   */
  async save<TState>(
    aggregateType: string,
    aggregateId: string,
    version: number,
    state: TState
  ): Promise<Snapshot<TState>> {
    const snapshot: Snapshot<TState> = {
      aggregateId,
      aggregateType,
      version,
      state,
      timestamp: new Date().toISOString(),
    };

    await this.adapter.save(snapshot);

    // Cleanup old snapshots
    await this.adapter.cleanup(aggregateId, this.options.maxSnapshots);

    return snapshot;
  }

  /**
   * Get latest snapshot for aggregate
   */
  async getLatest<TState>(aggregateId: string): Promise<Snapshot<TState> | null> {
    return this.adapter.getLatest(aggregateId) as Promise<Snapshot<TState> | null>;
  }

  /**
   * Get snapshot at or before specific version
   */
  async getAtVersion<TState>(
    aggregateId: string,
    version: number
  ): Promise<Snapshot<TState> | null> {
    return this.adapter.getAtVersion(aggregateId, version) as Promise<Snapshot<TState> | null>;
  }

  /**
   * Check if snapshot should be taken
   */
  shouldSnapshot(currentVersion: number, lastSnapshotVersion: number): boolean {
    return currentVersion - lastSnapshotVersion >= this.options.frequency;
  }

  /**
   * Delete old snapshots
   */
  async cleanup(aggregateId: string): Promise<number> {
    return this.adapter.cleanup(aggregateId, this.options.maxSnapshots);
  }

  /**
   * Get snapshot frequency
   */
  getFrequency(): number {
    return this.options.frequency;
  }

  /**
   * Set snapshot frequency
   */
  setFrequency(frequency: number): void {
    this.options.frequency = frequency;
  }
}

/**
 * Create a snapshot store
 */
export function createSnapshotStore(options?: SnapshotOptions): SnapshotStore {
  return new SnapshotStore(options);
}
