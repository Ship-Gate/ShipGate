/**
 * Snapshot Updater
 * 
 * Handles snapshot update operations and cleanup.
 */

import { existsSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { 
  getSnapshotStore,
  getSnapshotPath,
  DEFAULT_SNAPSHOT_DIR,
  SNAPSHOT_EXTENSION,
  type Snapshot,
  type SnapshotStore,
} from './snapshot.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Update result */
export interface UpdateResult {
  updated: number;
  added: number;
  removed: number;
  unchanged: number;
  errors: string[];
}

/** Update options */
export interface UpdateOptions {
  /** Only update specified test files */
  testFiles?: string[];
  /** Remove obsolete snapshots */
  removeObsolete?: boolean;
  /** Dry run - don't actually write changes */
  dryRun?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/** Snapshot summary */
export interface SnapshotSummary {
  total: number;
  byType: Record<string, number>;
  byTestFile: Record<string, number>;
  obsolete: number;
  lastUpdated: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Update Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Track accessed snapshots during a test run
 */
const accessedSnapshots = new Map<string, Set<string>>();

/**
 * Mark a snapshot as accessed
 */
export function markAccessed(testFile: string, key: string): void {
  if (!accessedSnapshots.has(testFile)) {
    accessedSnapshots.set(testFile, new Set());
  }
  accessedSnapshots.get(testFile)!.add(key);
}

/**
 * Get accessed snapshots for a test file
 */
export function getAccessedSnapshots(testFile: string): Set<string> {
  return accessedSnapshots.get(testFile) ?? new Set();
}

/**
 * Clear accessed snapshots tracking
 */
export function clearAccessedSnapshots(): void {
  accessedSnapshots.clear();
}

/**
 * Save all pending snapshot changes
 */
export function saveSnapshots(): void {
  const store = getSnapshotStore();
  store.saveAll();
}

/**
 * Check if in update mode
 */
export function isUpdateMode(): boolean {
  return process.env.UPDATE_SNAPSHOTS === 'true' || 
         process.argv.includes('-u') || 
         process.argv.includes('--update') ||
         process.argv.includes('--updateSnapshot');
}

/**
 * Find all snapshot files in a directory
 */
export function findSnapshotFiles(dir: string): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === DEFAULT_SNAPSHOT_DIR) {
        // Found snapshot directory
        const snapshotFiles = readdirSync(fullPath)
          .filter(f => f.endsWith(SNAPSHOT_EXTENSION))
          .map(f => join(fullPath, f));
        files.push(...snapshotFiles);
      } else if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        // Recurse into subdirectory
        files.push(...findSnapshotFiles(fullPath));
      }
    }
  }

  return files;
}

/**
 * Get snapshot summary for a directory
 */
export function getSnapshotSummary(dir: string): SnapshotSummary {
  const files = findSnapshotFiles(dir);
  const store = getSnapshotStore();
  
  const summary: SnapshotSummary = {
    total: 0,
    byType: {},
    byTestFile: {},
    obsolete: 0,
    lastUpdated: null,
  };

  for (const file of files) {
    try {
      const content = require('fs').readFileSync(file, 'utf-8');
      const data = JSON.parse(content);
      
      if (!data.snapshots) continue;

      for (const snapshot of Object.values(data.snapshots) as Snapshot[]) {
        summary.total++;
        
        // Count by type
        const type = snapshot.metadata?.type ?? 'unknown';
        summary.byType[type] = (summary.byType[type] ?? 0) + 1;
        
        // Count by test file
        const testFile = snapshot.metadata?.testFile ?? 'unknown';
        summary.byTestFile[testFile] = (summary.byTestFile[testFile] ?? 0) + 1;
        
        // Track latest update
        const updated = snapshot.metadata?.updatedAt;
        if (updated && (!summary.lastUpdated || updated > summary.lastUpdated)) {
          summary.lastUpdated = updated;
        }
      }
    } catch {
      // Skip invalid files
    }
  }

  return summary;
}

/**
 * Remove obsolete snapshots
 */
export function removeObsoleteSnapshots(
  testFile: string,
  options: UpdateOptions = {}
): string[] {
  const store = getSnapshotStore();
  const accessed = getAccessedSnapshots(testFile);
  const obsolete = store.getObsoleteSnapshots(testFile, accessed);

  if (obsolete.length > 0 && !options.dryRun) {
    store.removeObsolete(testFile, obsolete);
  }

  if (options.verbose && obsolete.length > 0) {
    console.log(`Removed ${obsolete.length} obsolete snapshot(s) from ${testFile}`);
    for (const key of obsolete) {
      console.log(`  - ${key}`);
    }
  }

  return obsolete;
}

/**
 * Clean empty snapshot directories
 */
export function cleanEmptySnapshotDirs(baseDir: string): number {
  let removed = 0;

  function cleanDir(dir: string): boolean {
    if (!existsSync(dir)) return true;

    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = join(dir, entry.name);
        const isEmpty = cleanDir(fullPath);
        
        if (isEmpty && entry.name === DEFAULT_SNAPSHOT_DIR) {
          try {
            require('fs').rmdirSync(fullPath);
            removed++;
          } catch {
            // Directory not empty
          }
        }
      }
    }

    // Check if current dir is empty
    const remaining = readdirSync(dir);
    return remaining.length === 0;
  }

  cleanDir(baseDir);
  return removed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Statistics
// ─────────────────────────────────────────────────────────────────────────────

/** Test run statistics */
export interface TestRunStats {
  passed: number;
  failed: number;
  added: number;
  updated: number;
  removed: number;
  obsolete: number;
}

let currentStats: TestRunStats = {
  passed: 0,
  failed: 0,
  added: 0,
  updated: 0,
  removed: 0,
  obsolete: 0,
};

/**
 * Reset statistics
 */
export function resetStats(): void {
  currentStats = {
    passed: 0,
    failed: 0,
    added: 0,
    updated: 0,
    removed: 0,
    obsolete: 0,
  };
}

/**
 * Record a passed snapshot
 */
export function recordPassed(): void {
  currentStats.passed++;
}

/**
 * Record a failed snapshot
 */
export function recordFailed(): void {
  currentStats.failed++;
}

/**
 * Record an added snapshot
 */
export function recordAdded(): void {
  currentStats.added++;
}

/**
 * Record an updated snapshot
 */
export function recordUpdated(): void {
  currentStats.updated++;
}

/**
 * Record removed snapshots
 */
export function recordRemoved(count: number): void {
  currentStats.removed += count;
}

/**
 * Record obsolete snapshots
 */
export function recordObsolete(count: number): void {
  currentStats.obsolete += count;
}

/**
 * Get current statistics
 */
export function getStats(): TestRunStats {
  return { ...currentStats };
}

/**
 * Format statistics for display
 */
export function formatStats(stats: TestRunStats): string {
  const lines: string[] = ['Snapshot Summary:'];
  
  if (stats.passed > 0) {
    lines.push(`  ${stats.passed} snapshot${stats.passed === 1 ? '' : 's'} passed`);
  }
  
  if (stats.failed > 0) {
    lines.push(`  ${stats.failed} snapshot${stats.failed === 1 ? '' : 's'} failed`);
  }
  
  if (stats.added > 0) {
    lines.push(`  ${stats.added} snapshot${stats.added === 1 ? '' : 's'} added`);
  }
  
  if (stats.updated > 0) {
    lines.push(`  ${stats.updated} snapshot${stats.updated === 1 ? '' : 's'} updated`);
  }
  
  if (stats.removed > 0) {
    lines.push(`  ${stats.removed} snapshot${stats.removed === 1 ? '' : 's'} removed`);
  }
  
  if (stats.obsolete > 0) {
    lines.push(`  ${stats.obsolete} obsolete snapshot${stats.obsolete === 1 ? '' : 's'}`);
  }

  return lines.join('\n');
}
