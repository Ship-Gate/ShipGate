/**
 * Snapshot Management
 * 
 * Core snapshot storage, retrieval, and comparison functionality.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { dirname, join, basename, relative } from 'path';
import { createHash } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Snapshot metadata */
export interface SnapshotMetadata {
  /** Snapshot name/key */
  name: string;
  /** Test file that created this snapshot */
  testFile: string;
  /** Test name */
  testName: string;
  /** Snapshot index within test */
  index: number;
  /** When snapshot was created/updated */
  updatedAt: string;
  /** Content hash for integrity */
  hash: string;
  /** Snapshot type */
  type: SnapshotType;
}

/** Supported snapshot types */
export type SnapshotType = 'isl' | 'generated' | 'json' | 'text' | 'binary';

/** Snapshot data */
export interface Snapshot {
  metadata: SnapshotMetadata;
  content: string;
}

/** Snapshot file format */
export interface SnapshotFile {
  version: number;
  snapshots: Record<string, Snapshot>;
}

/** Snapshot comparison result */
export interface SnapshotComparisonResult {
  match: boolean;
  expected: string;
  actual: string;
  diff?: string;
  metadata?: SnapshotMetadata;
}

/** Options for snapshot operations */
export interface SnapshotOptions {
  /** Base directory for snapshots */
  snapshotDir?: string;
  /** Update snapshots instead of comparing */
  update?: boolean;
  /** Custom serializer */
  serializer?: (value: unknown) => string;
  /** Custom comparator */
  comparator?: (expected: string, actual: string) => boolean;
  /** Snapshot type */
  type?: SnapshotType;
  /** Snapshot name override */
  name?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_EXTENSION = '.snap';
export const DEFAULT_SNAPSHOT_DIR = '__snapshots__';

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate content hash for integrity checking
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Generate snapshot key from test context
 */
export function generateSnapshotKey(testFile: string, testName: string, index: number): string {
  const safeTestName = testName.replace(/[^a-zA-Z0-9-_]/g, '-');
  return `${safeTestName}-${index}`;
}

/**
 * Get snapshot file path for a test file
 */
export function getSnapshotPath(testFile: string, snapshotDir?: string): string {
  const dir = snapshotDir ?? join(dirname(testFile), DEFAULT_SNAPSHOT_DIR);
  const name = basename(testFile, '.ts').replace('.test', '') + SNAPSHOT_EXTENSION;
  return join(dir, name);
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Store
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory snapshot store for a test run
 */
export class SnapshotStore {
  private snapshots = new Map<string, SnapshotFile>();
  private counters = new Map<string, number>();
  private dirty = new Set<string>();
  private snapshotDir: string;

  constructor(snapshotDir?: string) {
    this.snapshotDir = snapshotDir ?? DEFAULT_SNAPSHOT_DIR;
  }

  /**
   * Load snapshot file
   */
  load(testFile: string): SnapshotFile {
    const path = getSnapshotPath(testFile, this.snapshotDir);
    
    if (this.snapshots.has(path)) {
      return this.snapshots.get(path)!;
    }

    let file: SnapshotFile;
    
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf-8');
        file = JSON.parse(content);
        
        // Validate version
        if (file.version !== SNAPSHOT_VERSION) {
          console.warn(`Snapshot file ${path} has outdated version, will be regenerated`);
          file = { version: SNAPSHOT_VERSION, snapshots: {} };
        }
      } catch {
        file = { version: SNAPSHOT_VERSION, snapshots: {} };
      }
    } else {
      file = { version: SNAPSHOT_VERSION, snapshots: {} };
    }

    this.snapshots.set(path, file);
    return file;
  }

  /**
   * Get snapshot by key
   */
  get(testFile: string, key: string): Snapshot | undefined {
    const file = this.load(testFile);
    return file.snapshots[key];
  }

  /**
   * Set snapshot
   */
  set(
    testFile: string,
    testName: string,
    content: string,
    options: SnapshotOptions = {}
  ): Snapshot {
    const path = getSnapshotPath(testFile, this.snapshotDir);
    const file = this.load(testFile);
    
    // Get or increment counter for this test
    const counterKey = `${path}:${testName}`;
    const index = this.counters.get(counterKey) ?? 0;
    this.counters.set(counterKey, index + 1);

    const key = options.name ?? generateSnapshotKey(testFile, testName, index);
    
    const snapshot: Snapshot = {
      metadata: {
        name: key,
        testFile: relative(process.cwd(), testFile),
        testName,
        index,
        updatedAt: new Date().toISOString(),
        hash: hashContent(content),
        type: options.type ?? 'text',
      },
      content,
    };

    file.snapshots[key] = snapshot;
    this.dirty.add(path);

    return snapshot;
  }

  /**
   * Get next snapshot index for a test
   */
  getNextIndex(testFile: string, testName: string): number {
    const path = getSnapshotPath(testFile, this.snapshotDir);
    const counterKey = `${path}:${testName}`;
    return this.counters.get(counterKey) ?? 0;
  }

  /**
   * Reset counter for a test (called at start of each test)
   */
  resetCounter(testFile: string, testName: string): void {
    const path = getSnapshotPath(testFile, this.snapshotDir);
    const counterKey = `${path}:${testName}`;
    this.counters.set(counterKey, 0);
  }

  /**
   * Save all dirty snapshot files
   */
  saveAll(): void {
    for (const path of this.dirty) {
      const file = this.snapshots.get(path);
      if (!file) continue;

      ensureDir(dirname(path));
      
      const content = JSON.stringify(file, null, 2);
      writeFileSync(path, content, 'utf-8');
    }

    this.dirty.clear();
  }

  /**
   * Check if there are unsaved changes
   */
  hasPendingChanges(): boolean {
    return this.dirty.size > 0;
  }

  /**
   * Get list of obsolete snapshots (not accessed during test run)
   */
  getObsoleteSnapshots(testFile: string, accessedKeys: Set<string>): string[] {
    const file = this.load(testFile);
    const allKeys = Object.keys(file.snapshots);
    return allKeys.filter(key => !accessedKeys.has(key));
  }

  /**
   * Remove obsolete snapshots
   */
  removeObsolete(testFile: string, keys: string[]): void {
    const path = getSnapshotPath(testFile, this.snapshotDir);
    const file = this.load(testFile);
    
    for (const key of keys) {
      delete file.snapshots[key];
    }

    if (keys.length > 0) {
      this.dirty.add(path);
    }
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.snapshots.clear();
    this.counters.clear();
    this.dirty.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Store Instance
// ─────────────────────────────────────────────────────────────────────────────

let globalStore: SnapshotStore | null = null;

/**
 * Get or create global snapshot store
 */
export function getSnapshotStore(): SnapshotStore {
  if (!globalStore) {
    globalStore = new SnapshotStore();
  }
  return globalStore;
}

/**
 * Set custom snapshot store
 */
export function setSnapshotStore(store: SnapshotStore): void {
  globalStore = store;
}

/**
 * Reset snapshot store
 */
export function resetSnapshotStore(): void {
  globalStore?.clear();
  globalStore = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Match value against snapshot
 */
export function matchSnapshot(
  value: unknown,
  testFile: string,
  testName: string,
  options: SnapshotOptions = {}
): SnapshotComparisonResult {
  const store = getSnapshotStore();
  const serializer = options.serializer ?? defaultSerializer;
  const comparator = options.comparator ?? defaultComparator;
  
  const actual = serializer(value);
  const index = store.getNextIndex(testFile, testName);
  const key = options.name ?? generateSnapshotKey(testFile, testName, index);
  
  const existing = store.get(testFile, key);
  
  if (options.update || !existing) {
    // Update mode or new snapshot
    const snapshot = store.set(testFile, testName, actual, options);
    return {
      match: true,
      expected: actual,
      actual,
      metadata: snapshot.metadata,
    };
  }
  
  // Compare
  const expected = existing.content;
  const match = comparator(expected, actual);
  
  // Increment counter even on comparison
  store.set(testFile, testName, existing.content, { ...options, type: existing.metadata.type });
  
  return {
    match,
    expected,
    actual,
    metadata: existing.metadata,
  };
}

/**
 * Update snapshot (force)
 */
export function updateSnapshot(
  value: unknown,
  testFile: string,
  testName: string,
  options: SnapshotOptions = {}
): Snapshot {
  const store = getSnapshotStore();
  const serializer = options.serializer ?? defaultSerializer;
  const content = serializer(value);
  
  return store.set(testFile, testName, content, { ...options, type: options.type ?? 'text' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Serializer and Comparator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default value serializer
 */
export function defaultSerializer(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  
  if (value === null) {
    return 'null';
  }
  
  if (value === undefined) {
    return 'undefined';
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  
  return String(value);
}

/**
 * Default comparator (exact match)
 */
export function defaultComparator(expected: string, actual: string): boolean {
  return expected === actual;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export { SnapshotStore as Store };
